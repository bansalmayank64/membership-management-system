import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Alert,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CleaningServices as CleanIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  EventSeat as SeatIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import api from '../services/api';

function AdminPanel() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [users, setUsers] = useState([]);
  const [seats, setSeats] = useState([]);
  const [feesConfig, setFeesConfig] = useState([]);
  const [tempFeesConfig, setTempFeesConfig] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: '', data: null });
  
  const { user } = useAuth();

  // Global error handler for API calls
  const handleApiError = (error, fallbackMessage = 'An error occurred') => {
    if (error?.response?.data?.error === 'TOKEN_EXPIRED') {
      // Let the global interceptor handle token expiration
      return;
    }
    setMessage({ 
      type: 'error', 
      text: error?.response?.data?.message || error?.message || fallbackMessage 
    });
  };

  // User form state
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'user',
    permissions: {
      canManageUsers: false,
      canImportData: false,
      canExportData: false,
      canDeleteData: false,
      canManageSeats: true,
      canManageStudents: true,
      canManagePayments: true,
      canManageExpenses: true
    }
  });

  // Seat form state
  const [seatForm, setSeatForm] = useState({
    seatNumber: '',
    occupantSex: ''
  });

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' });

  useEffect(() => {
    fetchUsers();
    fetchSeats();
    fetchFeesConfig();
  }, []);

  const fetchUsers = async () => {
    try {
  const response = await fetch(`/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUsers(userData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setMessage({ type: 'error', text: 'Failed to fetch users' });
    }
  };

  const fetchSeats = async () => {
    try {
  const response = await fetch(`/api/admin/seats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const seatData = await response.json();
        setSeats(seatData);
      }
    } catch (error) {
      console.error('Error fetching seats:', error);
    }
  };

  const fetchFeesConfig = async () => {
    try {
      const response = await fetch(`/api/admin/fees-config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const feesData = await response.json();
        setFeesConfig(feesData);
        // Initialize temporary state with current values
        const tempConfig = {};
        feesData.forEach(config => {
          tempConfig[config.gender] = config.monthly_fees;
        });
        setTempFeesConfig(tempConfig);
      }
    } catch (error) {
      console.error('Error fetching fees config:', error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setMessage({ type: '', text: '' });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setImportFile(file);
      setMessage({ type: '', text: '' });
    } else {
      setMessage({ type: 'error', text: 'Please select a valid Excel (.xlsx) file' });
    }
  };

  const handleImportData = async () => {
    if (!importFile) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    setLoading(true);
    setImportProgress({ current: 0, total: 0, status: 'Starting import...' });

    const formData = new FormData();
    formData.append('file', importFile);

    try {
  const response = await fetch(`/api/admin/import-excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setMessage({ 
          type: 'success', 
          text: `Import completed successfully! ${result.imported} records processed.` 
        });
        setImportFile(null);
        // Reset file input
        const fileInput = document.getElementById('excel-file-input');
        if (fileInput) fileInput.value = '';
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
      setImportProgress({ current: 0, total: 0, status: '' });
    }
  };

  const handleUserDialog = (type, user = null) => {
    setDialogType(type);
    setSelectedUser(user);
    if (user) {
      setUserForm({
        username: user.username,
        password: '',
        role: user.role || 'user',
        permissions: user.permissions || {
          canManageUsers: false,
          canImportData: false,
          canExportData: false,
          canDeleteData: false,
          canManageSeats: true,
          canManageStudents: true,
          canManagePayments: true,
          canManageExpenses: true
        }
      });
    } else {
      setUserForm({
        username: '',
        password: '',
        role: 'user',
        permissions: {
          canManageUsers: false,
          canImportData: false,
          canExportData: false,
          canDeleteData: false,
          canManageSeats: true,
          canManageStudents: true,
          canManagePayments: true,
          canManageExpenses: true
        }
      });
    }
    setDialogOpen(true);
  };

  const handleSaveUser = async () => {
    setLoading(true);
    try {
      const url = selectedUser 
  ? `/api/admin/users/${selectedUser.id}`
  : `/api/auth/register`;
      
      const method = selectedUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userForm)
      });

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `User ${selectedUser ? 'updated' : 'created'} successfully!` 
        });
        setDialogOpen(false);
        fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Operation failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    setLoading(true);
    try {
  const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'User deleted successfully!' });
        fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: '', data: null });
    }
  };

  const handleSeatDialog = (type, seat = null) => {
    setDialogType(type === 'add' ? 'addSeat' : 'editSeat');
    setSelectedSeat(seat);
    if (seat) {
      setSeatForm({
        seatNumber: seat.seat_number,
        occupantSex: seat.occupant_sex || ''
      });
    } else {
      setSeatForm({
        seatNumber: '',
        occupantSex: ''
      });
    }
    setDialogOpen(true);
  };

  const handleStudentDialog = (seat) => {
    setDialogType('viewStudent');
    setSelectedSeat(seat);
    setDialogOpen(true);
  };

  const handleSaveSeat = async () => {
    // Additional validation for editing occupied seats
    if (dialogType === 'editSeat' && selectedSeat && selectedSeat.status === 'occupied' && selectedSeat.student_name) {
      // Check if we're trying to change the gender restriction to something that conflicts with current occupant
      const currentOccupantGender = selectedSeat.student_sex || selectedSeat.sex; // student gender from API
      const newRestriction = seatForm.occupantSex;
      
      if (newRestriction && currentOccupantGender && newRestriction !== currentOccupantGender) {
        setMessage({ 
          type: 'error', 
          text: `Cannot change restriction to "${newRestriction}" - seat is occupied by a ${currentOccupantGender} student (${selectedSeat.student_name})` 
        });
        return;
      }
    }

    setLoading(true);
    try {
      const url = selectedSeat 
  ? `/api/admin/seats/${selectedSeat.seat_number}`
  : `/api/admin/seats`;
      
      const method = selectedSeat ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(seatForm)
      });

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Seat ${selectedSeat ? 'updated' : 'added'} successfully!` 
        });
        setDialogOpen(false);
        fetchSeats();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Operation failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSeat = async (seatNumber) => {
    setLoading(true);
    try {
  const response = await fetch(`/api/admin/seats/${seatNumber}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Seat deleted successfully!' });
        fetchSeats();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: '', data: null });
    }
  };

  const handleCleanDatabase = async () => {
    setLoading(true);
    try {
  const response = await fetch(`/api/admin/clean-database`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Database cleaned successfully! Fresh start completed.' });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Clean operation failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: '', data: null });
    }
  };

  const handleExportData = async () => {
    setLoading(true);
    try {
  const response = await fetch(`/api/admin/export-excel`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `library-data-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Data exported successfully!' });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFees = async () => {
    setLoading(true);
    try {
      const updates = [];
      
      // Check which fees have changed
      feesConfig.forEach(config => {
        const tempValue = tempFeesConfig[config.gender];
        if (tempValue !== undefined && tempValue !== config.monthly_fees) {
          updates.push({
            gender: config.gender,
            monthly_fees: parseFloat(tempValue)
          });
        }
      });

      if (updates.length === 0) {
        setMessage({ 
          type: 'info', 
          text: 'No changes to update.' 
        });
        setLoading(false);
        return;
      }

      // Update each changed fee
      for (const update of updates) {
        const response = await fetch(`/api/admin/fees-config/${update.gender}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ monthly_fees: update.monthly_fees })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to update ${update.gender} fees`);
        }
      }

      setMessage({ 
        type: 'success', 
        text: `Monthly fees updated successfully for ${updates.map(u => u.gender).join(', ')} students!` 
      });
      fetchFeesConfig(); // Refresh the data
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTempFeesChange = (gender, value) => {
    setTempFeesConfig(prev => ({
      ...prev,
      [gender]: parseFloat(value) || 0
    }));
  };

  const ConfirmationDialog = ({ open, title, content, onConfirm, onCancel }) => (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography>{content}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">Please log in to access the admin panel.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" />
          Admin Control Panel
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Welcome, {user.username}! Manage your library system from this central dashboard.
        </Typography>

        {message.text && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              '& .MuiTab-root': {
                minWidth: { xs: 80, sm: 160 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }
            }}
          >
            <Tab 
              label="Import/Export" 
              icon={<UploadIcon />} 
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
            <Tab 
              label="Users" 
              icon={<PeopleIcon />}
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
            <Tab 
              label="Seats" 
              icon={<SeatIcon />}
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
            <Tab 
              label="Fees" 
              icon={<MoneyIcon />}
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
            <Tab 
              label="System" 
              icon={<StorageIcon />}
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
          </Tabs>
        </Box>

        {/* Data Import/Export Tab */}
        {tabValue === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <UploadIcon color="primary" />
                    Import Excel Data
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Upload an Excel file with 'Library Members' and 'Renewals' sheets to import data.
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <input
                      id="excel-file-input"
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="excel-file-input">
                      <Button variant="outlined" component="span" fullWidth sx={{ mb: 1 }}>
                        Select Excel File (.xlsx)
                      </Button>
                    </label>
                    {importFile && (
                      <Typography variant="body2" color="success.main">
                        Selected: {importFile.name}
                      </Typography>
                    )}
                  </Box>

                  <Button
                    variant="contained"
                    onClick={handleImportData}
                    disabled={!importFile || loading}
                    fullWidth
                    startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
                  >
                    {loading ? 'Importing...' : 'Import Data'}
                  </Button>

                  {importProgress.status && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">{importProgress.status}</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DownloadIcon color="primary" />
                    Export Data
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Download all library data as an Excel file for backup or analysis.
                  </Typography>
                  
                  <Button
                    variant="contained"
                    onClick={handleExportData}
                    disabled={loading}
                    fullWidth
                    startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
                  >
                    {loading ? 'Exporting...' : 'Export to Excel'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Excel File Format Requirements:
                </Typography>
                <Typography variant="body2">
                  <strong>Sheet 1 - "Library Members":</strong> ID, Seat Number, Sex, Name_Student, Father_Name, Contact Number, Membership_Date, Total_Paid, Membership_Till, Membership_Status, Last_Payment_date
                  <br />
                  <strong>Sheet 2 - "Renewals":</strong> ID, Seat_Number, Amount_paid, Payment_date, Payment_mode
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        )}

        {/* User Management Tab */}
        {tabValue === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon color="primary" />
                System Users
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleUserDialog('add')}
              >
                Add User
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <Chip 
                          label={user.role || 'User'} 
                          color={user.role === 'admin' ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip label="Active" color="success" size="small" />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleUserDialog('edit', user)}
                          color="primary"
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                        {user.username !== 'admin' && (
                          <IconButton
                            onClick={() => setConfirmDialog({
                              open: true,
                              action: 'deleteUser',
                              data: user.id,
                              title: 'Delete User',
                              content: `Are you sure you want to delete user "${user.username}"? This action cannot be undone.`
                            })}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Seat Management Tab */}
        {tabValue === 2 && (
          <Box>
            <Grid container spacing={3}>
              {/* Add New Seat */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon color="primary" />
                      Add New Seat
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => handleSeatDialog('add')}
                      fullWidth
                    >
                      Add Seat
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              {/* Seats Table */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SeatIcon color="primary" />
                      All Seats
                    </Typography>
                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Seat#</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Student</TableCell>
                            <TableCell>Restriction</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {seats.map((seat) => (
                            <TableRow key={seat.seat_number}>
                              <TableCell>
                                <Typography variant="subtitle2" fontWeight="bold">
                                  {seat.seat_number}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={seat.status === 'occupied' ? 'Occupied' : 'Available'} 
                                  color={seat.status === 'occupied' ? 'error' : 'success'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                {seat.status === 'occupied' && seat.student_name ? (
                                  <Button
                                    variant="text"
                                    color="primary"
                                    onClick={() => handleStudentDialog(seat)}
                                    sx={{ 
                                      textTransform: 'none',
                                      justifyContent: 'flex-start',
                                      p: 0.5,
                                      minWidth: 'auto'
                                    }}
                                  >
                                    {seat.student_name}
                                  </Button>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    -
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {seat.occupant_sex ? (
                                  <Chip 
                                    label={seat.occupant_sex} 
                                    color={seat.occupant_sex === 'male' ? 'info' : 'secondary'}
                                    size="small"
                                  />
                                ) : (
                                  <Chip label="No restriction" variant="outlined" size="small" />
                                )}
                              </TableCell>
                              <TableCell>
                                <IconButton
                                  onClick={() => handleSeatDialog('edit', seat)}
                                  color="primary"
                                  size="small"
                                  title="Edit Seat"
                                >
                                  <EditIcon />
                                </IconButton>
                                {seat.status === 'available' && (
                                  <IconButton
                                    onClick={() => setConfirmDialog({
                                      open: true,
                                      action: 'deleteSeat',
                                      data: seat.seat_number,
                                      title: 'Delete Seat',
                                      content: `Are you sure you want to delete seat "${seat.seat_number}"? This action cannot be undone.`
                                    })}
                                    color="error"
                                    size="small"
                                    title="Delete Seat"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Monthly Fees Management Tab */}
        {tabValue === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <MoneyIcon color="primary" />
              Monthly Fees Configuration
            </Typography>
            
            <Grid container spacing={3}>
              {feesConfig.map((config) => (
                <Grid item xs={12} md={6} key={config.gender}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MoneyIcon color={config.gender === 'male' ? 'info' : 'secondary'} />
                        {config.gender.charAt(0).toUpperCase() + config.gender.slice(1)} Students
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                        <TextField
                          label="Monthly Fees (₹)"
                          type="number"
                          value={tempFeesConfig[config.gender] !== undefined ? tempFeesConfig[config.gender] : config.monthly_fees}
                          inputProps={{ min: 0, step: 10 }}
                          onChange={(e) => handleTempFeesChange(config.gender, e.target.value)}
                          fullWidth
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Current fees: ₹{config.monthly_fees} per month
                        {tempFeesConfig[config.gender] !== undefined && tempFeesConfig[config.gender] !== config.monthly_fees && (
                          <span style={{ color: 'orange', fontWeight: 'bold' }}> → ₹{tempFeesConfig[config.gender]} (pending)</span>
                        )}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            
            {/* Update Button */}
            {feesConfig.length > 0 && (
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleUpdateFees}
                  disabled={loading || !Object.keys(tempFeesConfig).some(gender => {
                    const config = feesConfig.find(c => c.gender === gender);
                    return config && tempFeesConfig[gender] !== config.monthly_fees;
                  })}
                  sx={{ minWidth: 150, py: 1.5 }}
                >
                  {loading ? 'Updating...' : 'Update Fees'}
                </Button>
              </Box>
            )}
            
            {feesConfig.length === 0 && (
              <Alert severity="info">
                No fees configuration found. Default fees will be applied.
              </Alert>
            )}
          </Box>
        )}

        {/* System Management Tab */}
        {tabValue === 4 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CleanIcon color="warning" />
                    Database Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Clean the entire database and start fresh. This will remove all data except admin users.
                  </Typography>
                  
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={() => setConfirmDialog({
                      open: true,
                      action: 'cleanDatabase',
                      title: 'Clean Database',
                      content: 'This will permanently delete ALL data (students, payments, expenses, seats) but keep user accounts. Are you absolutely sure?'
                    })}
                    disabled={loading}
                    fullWidth
                    startIcon={<CleanIcon />}
                  >
                    Clean Database
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StorageIcon color="primary" />
                    System Information
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Current system status and configuration.
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      <strong>Database:</strong> PostgreSQL (Neon)
                    </Typography>
                    <Typography variant="body2">
                      <strong>Authentication:</strong> JWT Tokens
                    </Typography>
                    <Typography variant="body2">
                      <strong>Current User:</strong> {user.username}
                    </Typography>
                    <Typography variant="body2">
                      <strong>System Status:</strong> <Chip label="Operational" color="success" size="small" />
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* User Dialog */}
        <Dialog open={dialogOpen && (dialogType === 'add' || dialogType === 'edit') && !dialogType.includes('seat') && dialogType !== 'changeSeat'} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {dialogType === 'add' ? 'Add New User' : 'Edit User'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Username"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Password"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                fullWidth
                required={dialogType === 'add'}
                helperText={dialogType === 'edit' ? 'Leave blank to keep current password' : ''}
              />
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              
              <Divider />
              <Typography variant="h6">Permissions</Typography>
              
              {Object.entries(userForm.permissions).map(([key, value]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      checked={value}
                      onChange={(e) => setUserForm({
                        ...userForm,
                        permissions: {
                          ...userForm.permissions,
                          [key]: e.target.checked
                        }
                      })}
                    />
                  }
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                />
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveUser} 
              variant="contained"
              disabled={loading || !userForm.username}
            >
              {loading ? <CircularProgress size={20} /> : (dialogType === 'add' ? 'Create' : 'Update')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Seat Dialog */}
        <Dialog open={dialogOpen && (dialogType === 'addSeat' || dialogType === 'editSeat')} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {dialogType === 'addSeat' ? 'Add New Seat' : 'Edit Seat'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Seat Number"
                value={seatForm.seatNumber}
                onChange={(e) => setSeatForm({ ...seatForm, seatNumber: e.target.value })}
                fullWidth
                required
                disabled={!!selectedSeat}
                helperText="Examples: 1, 2, 5-A, 5-B, 10-A"
              />
              
              {/* Show warning if seat is occupied */}
              {dialogType === 'editSeat' && selectedSeat && selectedSeat.status === 'occupied' && selectedSeat.student_name && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    <strong>Information:</strong> This seat is currently occupied by {selectedSeat.student_name}. 
                    No changes can be made to the seat configuration while it is occupied.
                  </Typography>
                </Alert>
              )}
              
              <FormControl fullWidth>
                <InputLabel>Gender Restriction</InputLabel>
                <Select
                  value={seatForm.occupantSex}
                  onChange={(e) => setSeatForm({ ...seatForm, occupantSex: e.target.value })}
                  disabled={dialogType === 'editSeat' && selectedSeat && selectedSeat.status === 'occupied' && selectedSeat.student_name}
                >
                  <MenuItem value="">No restriction</MenuItem>
                  <MenuItem value="male">Male only</MenuItem>
                  <MenuItem value="female">Female only</MenuItem>
                </Select>
                {dialogType === 'editSeat' && selectedSeat && selectedSeat.status === 'occupied' && selectedSeat.student_name && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    All seat settings are locked because the seat is currently occupied
                  </Typography>
                )}
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveSeat} 
              variant="contained"
              disabled={
                loading || 
                !seatForm.seatNumber || 
                (dialogType === 'editSeat' && selectedSeat && selectedSeat.status === 'occupied' && selectedSeat.student_name)
              }
            >
              {loading ? <CircularProgress size={20} /> : (dialogType === 'addSeat' ? 'Add Seat' : 'Update Seat')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Student Details Dialog */}
        <Dialog open={dialogOpen && dialogType === 'viewStudent'} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Student Details
          </DialogTitle>
          <DialogContent>
            {selectedSeat && selectedSeat.student_name && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                  <Typography variant="h6" color="primary.contrastText">
                    Seat {selectedSeat.seat_number}
                  </Typography>
                  <Chip 
                    label="Occupied" 
                    color="error" 
                    size="small"
                  />
                </Box>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Student Name
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedSeat.student_name}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Student ID
                    </Typography>
                    <Typography variant="body1">
                      {selectedSeat.student_id}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Father's Name
                    </Typography>
                    <Typography variant="body1">
                      {selectedSeat.father_name || 'N/A'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Contact Number
                    </Typography>
                    <Typography variant="body1">
                      {selectedSeat.contact_number || 'N/A'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Membership Status
                    </Typography>
                    <Chip 
                      label={selectedSeat.membership_status || 'Active'} 
                      color={selectedSeat.membership_status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Seat Restriction
                    </Typography>
                    {selectedSeat.occupant_sex ? (
                      <Chip 
                        label={selectedSeat.occupant_sex} 
                        color={selectedSeat.occupant_sex === 'male' ? 'info' : 'secondary'}
                        size="small"
                      />
                    ) : (
                      <Chip label="No restriction" variant="outlined" size="small" />
                    )}
                  </Box>
                </Box>
                
                <Divider sx={{ my: 1 }} />
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Seat Assignment Date
                  </Typography>
                  <Typography variant="body2">
                    {selectedSeat.updated_at ? new Date(selectedSeat.updated_at).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          content={confirmDialog.content}
          onConfirm={() => {
            if (confirmDialog.action === 'deleteUser') {
              handleDeleteUser(confirmDialog.data);
            } else if (confirmDialog.action === 'cleanDatabase') {
              handleCleanDatabase();
            } else if (confirmDialog.action === 'deleteSeat') {
              handleDeleteSeat(confirmDialog.data);
            }
          }}
          onCancel={() => setConfirmDialog({ open: false, action: '', data: null })}
        />
      </Paper>
      
      <Footer />
    </Container>
  );
}

export default AdminPanel;
