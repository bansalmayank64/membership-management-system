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
  LinearProgress
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
import ActivityLog from './ActivityLog';

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

  const isAdmin = user && user.role === 'admin';
  // compute tab indexes dynamically so tabs work whether Activity tab is shown or not
  let __tabIdx = 0;
  const IDX_ACTIVITY = isAdmin ? __tabIdx++ : -1;
  const IDX_IMPORT = __tabIdx++;
  const IDX_USERS = __tabIdx++;
  const IDX_SEATS = __tabIdx++;
  const IDX_FEES = __tabIdx++;
  const IDX_SYSTEM = __tabIdx++;

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
    role: 'user'
  });

  // Seat form state
  const [seatForm, setSeatForm] = useState({
    seatNumber: '',
    occupantSex: ''
  });
  // Seat range support
  const [seatRangeMode, setSeatRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' });
  // Backup/Restore state
  const [restoreFile, setRestoreFile] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  // Full Data Report state
  const [reportLoading, setReportLoading] = useState(false);
  // Handle backup (download JSON)
  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await fetch('/api/admin/backup', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
  link.download = `library-backup-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}.json`;
        link.click();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Backup downloaded successfully!' });
      } else {
        throw new Error('Backup failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBackupLoading(false);
    }
  };

  // Handle restore (upload JSON)
  const handleRestore = async () => {
    if (!restoreFile) {
      setMessage({ type: 'error', text: 'Please select a backup file first' });
      return;
    }
    setRestoreLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      const response = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Restore completed successfully! Please reload the page.' });
        setRestoreFile(null);
        const fileInput = document.getElementById('restore-file-input');
        if (fileInput) fileInput.value = '';
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Restore failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setRestoreLoading(false);
    }
  };

  // Download full data report (XLSX)
  const handleDownloadFullReport = async () => {
    setReportLoading(true);
    try {
      const response = await fetch('/api/admin/full-report', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
  link.download = `full-data-report-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Full data report downloaded!' });
      } else {
        throw new Error('Failed to download report');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setReportLoading(false);
    }
  };

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
        // feesData now contains membership_type rows with male_monthly_fees and female_monthly_fees
        feesData.forEach(config => {
          tempConfig[config.membership_type] = { male: config.male_monthly_fees, female: config.female_monthly_fees };
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
        const hasErrors = result.errors && result.errors.total > 0;
        
        setMessage({ 
          type: hasErrors ? 'warning' : 'success', 
          text: hasErrors 
            ? `${result.message} Check console for details.` 
            : `${result.message} ${result.imported} records processed.`
        });
        
        if (hasErrors) {
          console.log('Import completed with errors:', result.errors);
        }
        
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
        role: user.role || 'user'
      });
    } else {
      setUserForm({
        username: '',
        password: '',
        role: 'user'
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
  // reset range inputs when opening dialog
  setSeatRangeMode(false);
  setRangeStart('');
  setRangeEnd('');

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
      if (!selectedSeat && seatRangeMode) {
        // Add a numeric range of seats (inclusive)
        const start = parseInt(rangeStart, 10);
        const end = parseInt(rangeEnd, 10);
        if (isNaN(start) || isNaN(end) || start <= 0 || end < start) {
          setMessage({ type: 'error', text: 'Please provide a valid numeric start and end (start <= end).' });
          setLoading(false);
          return;
        }

        let added = 0;
        for (let n = start; n <= end; n++) {
          const payload = { seatNumber: String(n), occupantSex: seatForm.occupantSex };
          const resp = await fetch(`/api/admin/seats`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `Failed to add seat ${n}`);
          }
          added++;
        }

        setMessage({ type: 'success', text: `Added ${added} seats (${start} to ${end}) successfully.` });
        setDialogOpen(false);
        fetchSeats();
        setLoading(false);
        return;
      }

      // Single seat add/update
      const url = selectedSeat 
        ? `/api/admin/seats/${selectedSeat.seat_number}`
        : `/api/admin/seats`;
      const method = selectedSeat ? 'PUT' : 'POST';
  const bodyPayload = selectedSeat ? { ...seatForm } : { seatNumber: seatForm.seatNumber, occupantSex: seatForm.occupantSex };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Seat ${selectedSeat ? 'updated' : 'added'} successfully!` });
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
      // Find seat object to check if occupied and get student id
      const seatObj = seats.find(s => s.seat_number === seatNumber);

      // If seat is occupied and has a linked student, unassign that student first
      if (seatObj && seatObj.status === 'occupied' && seatObj.student_id) {
        try {
          // Fetch full student record (PUT requires full payload)
          const getResp = await fetch(`/api/students/${seatObj.student_id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
            }
          });

          if (!getResp.ok) {
            const err = await getResp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to fetch student record before unassign');
          }

          const studentData = await getResp.json();
          const updatedStudent = { ...studentData, seat_number: null };

          const stuResp = await fetch(`/api/students/${seatObj.student_id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedStudent)
          });

          if (!stuResp.ok) {
            const err = await stuResp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to unassign student from seat');
          }
        } catch (err) {
          throw err;
        }
      }

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

  // Clean Database progress state
  const [cleanDbProgress, setCleanDbProgress] = useState({ running: false, status: '' });
  const handleCleanDatabase = async () => {
    setLoading(true);
    setCleanDbProgress({ running: true, status: 'Cleaning database and running setup...' });
    // Ensure progress bar is visible before fetch
    await new Promise(resolve => setTimeout(resolve, 100));
    let fetchSuccess = false;
    try {
      const response = await fetch(`/api/admin/clean-database`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Database cleaned successfully! Fresh start completed.' });
        setCleanDbProgress({ running: false, status: 'Database cleaned successfully.' });
        fetchSuccess = true;
      } else {
        const error = await response.json();
        setCleanDbProgress({ running: false, status: 'Failed to clean database.' });
        throw new Error(error.error || 'Clean operation failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      setCleanDbProgress({ running: false, status: 'Failed to clean database.' });
    } finally {
      // Keep progress bar visible for at least 1s after fetch
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
      setConfirmDialog({ open: false, action: '', data: null });
      setTimeout(() => setCleanDbProgress({ running: false, status: '' }), 2000);
    }
  };

  const handleUpdateFees = async () => {
    setLoading(true);
    try {
      const updates = [];

      // Check which membership_type fees have changed
      feesConfig.forEach(config => {
        const mType = config.membership_type;
        const temp = tempFeesConfig[mType] || {};
        const maleTemp = temp.male;
        const femaleTemp = temp.female;
        const maleOrig = config.male_monthly_fees;
        const femaleOrig = config.female_monthly_fees;

        if (maleTemp !== undefined && parseFloat(maleTemp) !== parseFloat(maleOrig)) {
          updates.push({ membership_type: mType, male_monthly_fees: parseFloat(maleTemp), female_monthly_fees: femaleOrig });
        }
        if (femaleTemp !== undefined && parseFloat(femaleTemp) !== parseFloat(femaleOrig)) {
          // If we already pushed an update for this membership_type due to male change, update that entry
          const existing = updates.find(u => u.membership_type === mType);
          if (existing) {
            existing.female_monthly_fees = parseFloat(femaleTemp);
          } else {
            updates.push({ membership_type: mType, male_monthly_fees: maleOrig, female_monthly_fees: parseFloat(femaleTemp) });
          }
        }
      });

      if (updates.length === 0) {
        setMessage({ type: 'info', text: 'No changes to update.' });
        setLoading(false);
        return;
      }

      // Update each changed membership_type row
      for (const update of updates) {
        const response = await fetch(`/api/admin/fees-config/${update.membership_type}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ male_monthly_fees: update.male_monthly_fees, female_monthly_fees: update.female_monthly_fees })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to update fees for ${update.membership_type}`);
        }
      }

      setMessage({ type: 'success', text: `Monthly fees updated successfully for ${updates.map(u => u.membership_type).join(', ')}` });
      fetchFeesConfig(); // Refresh the data
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTempFeesChange = (membershipType, gender, value) => {
    setTempFeesConfig(prev => ({
      ...prev,
      [membershipType]: {
        ...(prev[membershipType] || {}),
        [gender]: parseFloat(value) || 0
      }
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon color="primary" />
            Admin Control Panel
          </Typography>
        </Box>
        
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
            {isAdmin && (
              <Tab 
                key="activity"
                label="Activity Logs" 
                icon={<SecurityIcon />} 
                sx={{ 
                  '& .MuiTab-wrapper': { 
                    fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                  } 
                }}
              />
            )}

            <Tab 
              key="import"
              label="Import/Export" 
              icon={<UploadIcon />} 
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
            <Tab 
              key="users"
              label="Users" 
              icon={<PeopleIcon />}
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
            <Tab 
              key="seats"
              label="Seats" 
              icon={<SeatIcon />}
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
            <Tab 
              key="fees"
              label="Fees" 
              icon={<MoneyIcon />}
              sx={{ 
                '& .MuiTab-wrapper': { 
                  fontSize: { xs: '0.7rem', sm: '0.875rem' } 
                } 
              }}
            />
            <Tab 
              key="system"
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

        {/* Activity Logs Tab (admin-only) */}
        {isAdmin && tabValue === IDX_ACTIVITY && (
          <Box sx={{ my: 1 }}>
            <ActivityLog />
          </Box>
        )}

  {/* Data Import/Export Tab */}
  {tabValue === IDX_IMPORT && (
          <Grid container spacing={3}>
            {/* Import Excel */}
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
                  
                  {/* Excel Format Requirements */}
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Excel File Format Requirements:
                    </Typography>
                    <Typography variant="body2">
                      <strong>Sheet 1 - "Library Members":</strong> ID, Seat Number, Sex, Name_Student, Father_Name, Contact Number, Membership_Date, Total_Paid, Membership_Till, Membership_Status, Last_Payment_date
                      <br />
                      <strong>Sheet 2 - "Renewals":</strong> ID, Seat_Number, Amount_paid, Payment_date, Payment_mode
                      <br />
                      <em>Note: Column order can be flexible and slight variations in column names are supported.</em>
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>

            {/* Export Excel, Full Report & Backup/Restore */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DownloadIcon color="primary" />
                    Full Report & Backup
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Download a full multi-sheet report or backup/restore the entire system as JSON.
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleDownloadFullReport}
                    disabled={reportLoading}
                    fullWidth
                    sx={{ mb: 1 }}
                    startIcon={reportLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
                  >
                    {reportLoading ? 'Preparing...' : 'Download Full Data report'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleBackup}
                    disabled={backupLoading}
                    fullWidth
                    sx={{ mb: 1 }}
                    startIcon={backupLoading ? <CircularProgress size={20} /> : <StorageIcon />}
                  >
                    {backupLoading ? 'Backing up...' : 'Backup (JSON)'}
                  </Button>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                    <input
                      id="restore-file-input"
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={e => setRestoreFile(e.target.files[0])}
                    />
                    <label htmlFor="restore-file-input" style={{ flex: 1 }}>
                      <Button variant="outlined" component="span" fullWidth>
                        Select Backup File (.json)
                      </Button>
                    </label>
                    {restoreFile && (
                      <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                        {restoreFile.name}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleRestore}
                    disabled={!restoreFile || restoreLoading}
                    fullWidth
                    startIcon={restoreLoading ? <CircularProgress size={20} /> : <UploadIcon />}
                  >
                    {restoreLoading ? 'Restoring...' : 'Restore from Backup'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Backup/Restore:
                </Typography>
                <Typography variant="body2">
                  Backup will download a JSON file containing all system data (users, students, payments, seats, expenses, fees config). Restore will overwrite all data with the uploaded backup file. <strong>Use with caution!</strong>
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        )}

        {/* User Management Tab */}
  {tabValue === IDX_USERS && (
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
  {tabValue === IDX_SEATS && (
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
                                <IconButton
                                  onClick={() => setConfirmDialog({
                                    open: true,
                                    action: 'deleteSeat',
                                    data: seat.seat_number,
                                    title: 'Delete Seat',
                                    content: seat.status === 'occupied'
                                      ? `Seat "${seat.seat_number}" is currently assigned to ${seat.student_name || 'a student'}. Deleting will first unassign the student and then remove the seat. Proceed?`
                                      : `Are you sure you want to delete seat "${seat.seat_number}"? This action cannot be undone.`
                                  })}
                                  color="error"
                                  size="small"
                                  title={seat.status === 'occupied' ? 'Delete Seat (will unassign student)' : 'Delete Seat'}
                                >
                                  <DeleteIcon />
                                </IconButton>
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
  {tabValue === IDX_FEES && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <MoneyIcon color="primary" />
              Monthly Fees Configuration
            </Typography>
            
            <Grid container spacing={3}>
              {feesConfig.map((config) => (
                <Grid item xs={12} md={6} key={config.membership_type}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MoneyIcon color="primary" />
                        {config.membership_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <TextField
                          label="Male (₹)"
                          type="number"
                          value={(tempFeesConfig[config.membership_type] && tempFeesConfig[config.membership_type].male) !== undefined ? tempFeesConfig[config.membership_type].male : config.male_monthly_fees}
                          inputProps={{ min: 0, step: 10 }}
                          onChange={(e) => handleTempFeesChange(config.membership_type, 'male', e.target.value)}
                          fullWidth
                        />
                        <TextField
                          label="Female (₹)"
                          type="number"
                          value={(tempFeesConfig[config.membership_type] && tempFeesConfig[config.membership_type].female) !== undefined ? tempFeesConfig[config.membership_type].female : config.female_monthly_fees}
                          inputProps={{ min: 0, step: 10 }}
                          onChange={(e) => handleTempFeesChange(config.membership_type, 'female', e.target.value)}
                          fullWidth
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Current male fees: ₹{config.male_monthly_fees} • Current female fees: ₹{config.female_monthly_fees}
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
  {tabValue === IDX_SYSTEM && (
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
                  
                  <Box sx={{ mb: 2 }}>
                    {cleanDbProgress.running && (
                      <Box sx={{ width: '100%', mb: 2 }}>
                        <LinearProgress color="warning" />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                          {cleanDbProgress.status}
                        </Typography>
                      </Box>
                    )}
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={() => setConfirmDialog({
                        open: true,
                        action: 'cleanDatabase',
                        title: 'Clean Database',
                        content: 'This will permanently delete ALL data (students, payments, expenses, seats) but keep user accounts. Are you absolutely sure?'
                      })}
                      disabled={loading || cleanDbProgress.running}
                      fullWidth
                      startIcon={cleanDbProgress.running ? <CircularProgress size={20} color="inherit" /> : <CleanIcon />}
                    >
                      {cleanDbProgress.running ? 'Cleaning...' : 'Clean Database'}
                    </Button>
                  </Box>
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
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={<Switch checked={seatRangeMode} onChange={(e) => setSeatRangeMode(e.target.checked)} />}
                  label="Add range"
                />

                {!seatRangeMode ? (
                  <TextField
                    label="Seat Number"
                    value={seatForm.seatNumber}
                    onChange={(e) => setSeatForm({ ...seatForm, seatNumber: e.target.value })}
                    fullWidth
                    required
                    disabled={!!selectedSeat}
                    helperText="Examples: 1, 2, 5-A, 5-B, 10-A"
                  />
                ) : (
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Start (numeric)"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        type="number"
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="End (numeric)"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        type="number"
                        fullWidth
                        required
                      />
                    </Grid>
                  </Grid>
                )}
              </Box>
              
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
                (dialogType === 'addSeat' && (seatRangeMode ? (!rangeStart || !rangeEnd) : !seatForm.seatNumber)) ||
                (dialogType === 'editSeat' && selectedSeat && selectedSeat.status === 'occupied' && selectedSeat.student_name)
              }
            >
              {loading ? <CircularProgress size={20} /> : (dialogType === 'addSeat' ? 'Add Seat' : 'Update Seat')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          content={confirmDialog.content}
          onConfirm={() => {
            // Capture current action/data, close dialog immediately to avoid flicker/reopen,
            // then call the appropriate handler.
            const action = confirmDialog.action;
            const data = confirmDialog.data;
            setConfirmDialog({ open: false, action: '', data: null });
            if (action === 'deleteUser') {
              handleDeleteUser(data);
            } else if (action === 'cleanDatabase') {
              handleCleanDatabase();
            } else if (action === 'deleteSeat') {
              handleDeleteSeat(data);
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
