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
  SwapHoriz as ChangeIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

function AdminPanel() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [users, setUsers] = useState([]);
  const [seats, setSeats] = useState([]);
  const [students, setStudents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
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

  // Seat change form state
  const [seatChangeForm, setSeatChangeForm] = useState({
    studentId: '',
    newSeatNumber: ''
  });

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' });

  useEffect(() => {
    fetchUsers();
    fetchSeats();
    fetchStudents();
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

  const fetchStudents = async () => {
    try {
  const response = await fetch(`/api/students`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const studentData = await response.json();
        setStudents(studentData);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
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

  const handleSaveSeat = async () => {
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

  const handleSeatChangeDialog = (student = null) => {
    setDialogType('changeSeat');
    setSelectedStudent(student);
    if (student) {
      setSeatChangeForm({
        studentId: student.id,
        newSeatNumber: ''
      });
    } else {
      setSeatChangeForm({
        studentId: '',
        newSeatNumber: ''
      });
    }
    setDialogOpen(true);
  };

  const handleChangeSeat = async () => {
    setLoading(true);
    try {
  const response = await fetch(`/api/admin/change-seat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(seatChangeForm)
      });

      if (response.ok) {
        const result = await response.json();
        setMessage({ 
          type: 'success', 
          text: `Seat changed successfully for ${result.studentName}!` 
        });
        setDialogOpen(false);
        fetchSeats();
        fetchStudents();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Seat change failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
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
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Data Import/Export" icon={<UploadIcon />} />
            <Tab label="User Management" icon={<PeopleIcon />} />
            <Tab label="Seat Management" icon={<SeatIcon />} />
            <Tab label="System Management" icon={<StorageIcon />} />
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

              {/* Change Student Seat */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ChangeIcon color="primary" />
                      Change Student Seat
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<ChangeIcon />}
                      onClick={() => handleSeatChangeDialog()}
                      fullWidth
                    >
                      Change Seat
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
                            <TableCell>Restriction</TableCell>
                            <TableCell>Student</TableCell>
                            <TableCell>Contact</TableCell>
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
                                  label={seat.status} 
                                  color={seat.status === 'available' ? 'success' : seat.status === 'occupied' ? 'primary' : 'warning'}
                                  size="small"
                                />
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
                                {seat.student_name ? (
                                  <Box>
                                    <Typography variant="body2" fontWeight="bold">
                                      {seat.student_name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {seat.father_name}
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">-</Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {seat.contact_number || '-'}
                              </TableCell>
                              <TableCell>
                                <IconButton
                                  onClick={() => handleSeatDialog('edit', seat)}
                                  color="primary"
                                  size="small"
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
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                )}
                                {seat.student_id && (
                                  <IconButton
                                    onClick={() => handleSeatChangeDialog({ 
                                      id: seat.student_id,
                                      name: seat.student_name 
                                    })}
                                    color="secondary"
                                    size="small"
                                  >
                                    <ChangeIcon />
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

        {/* System Management Tab */}
        {tabValue === 3 && (
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
                      content: 'This will permanently delete ALL library data (students, payments, expenses, seats) but keep user accounts. Are you absolutely sure?'
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
              <FormControl fullWidth>
                <InputLabel>Gender Restriction</InputLabel>
                <Select
                  value={seatForm.occupantSex}
                  onChange={(e) => setSeatForm({ ...seatForm, occupantSex: e.target.value })}
                >
                  <MenuItem value="">No restriction</MenuItem>
                  <MenuItem value="male">Male only</MenuItem>
                  <MenuItem value="female">Female only</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveSeat} 
              variant="contained"
              disabled={loading || !seatForm.seatNumber}
            >
              {loading ? <CircularProgress size={20} /> : (dialogType === 'addSeat' ? 'Add Seat' : 'Update Seat')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Seat Change Dialog */}
        <Dialog open={dialogOpen && dialogType === 'changeSeat'} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Change Student Seat</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Student</InputLabel>
                <Select
                  value={seatChangeForm.studentId}
                  onChange={(e) => setSeatChangeForm({ ...seatChangeForm, studentId: e.target.value })}
                >
                  {students.map((student) => (
                    <MenuItem key={student.id} value={student.id}>
                      {student.name} ({student.contact_number})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>New Seat</InputLabel>
                <Select
                  value={seatChangeForm.newSeatNumber}
                  onChange={(e) => setSeatChangeForm({ ...seatChangeForm, newSeatNumber: e.target.value })}
                >
                  {seats
                    .filter(seat => seat.status === 'available' || seat.student_id === seatChangeForm.studentId)
                    .map((seat) => (
                    <MenuItem key={seat.seat_number} value={seat.seat_number}>
                      {seat.seat_number} {seat.occupant_sex && `(${seat.occupant_sex} only)`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleChangeSeat} 
              variant="contained"
              disabled={loading || !seatChangeForm.studentId || !seatChangeForm.newSeatNumber}
            >
              {loading ? <CircularProgress size={20} /> : 'Change Seat'}
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
    </Container>
  );
}

export default AdminPanel;
