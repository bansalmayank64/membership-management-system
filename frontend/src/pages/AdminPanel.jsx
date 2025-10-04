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
  AttachMoney as MoneyIcon,
  PowerSettingsNew as PowerSettingsNewIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import AIChatWidget from '../components/AIChatWidget';
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
  
  // New membership type form state
  const [newMembershipTypeForm, setNewMembershipTypeForm] = useState({
    membership_type: '',
    male_monthly_fees: '',
    female_monthly_fees: ''
  });
  
  // Edit membership type state
  const [editMembershipTypeForm, setEditMembershipTypeForm] = useState({
    original_name: '',
    new_name: '',
    male_monthly_fees: '',
    female_monthly_fees: ''
  });
  
  const [editMembershipDialogOpen, setEditMembershipDialogOpen] = useState(false);
  
  const { user } = useAuth();

  const isAdmin = user && user.role === 'admin';
  // compute tab indexes dynamically so tabs work whether Activity tab is shown or not
  let __tabIdx = 0;
  const IDX_ACTIVITY = isAdmin ? __tabIdx++ : -1;
  const IDX_IMPORT = __tabIdx++;
  const IDX_USERS = __tabIdx++;
  const IDX_SEATS = __tabIdx++;
  const IDX_FEES = __tabIdx++;
  const IDX_EXPENSE_CATEGORIES = __tabIdx++;
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
  // Expired Students Report state
  const [expiredReportLoading, setExpiredReportLoading] = useState(false);
  const [expiredPreviewLoading, setExpiredPreviewLoading] = useState(false);
  const [expiredPreviewData, setExpiredPreviewData] = useState(null);
  
  // Handle expired students report preview
  const handleExpiredStudentsPreview = async () => {
    setExpiredPreviewLoading(true);
    try {
      const response = await fetch('/api/students/reports/expired/preview', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const result = await response.json();
        setExpiredPreviewData(result);
        setMessage({ 
          type: 'info', 
          text: `Preview loaded: ${result.count} expired students found` 
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load preview');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      setExpiredPreviewData(null);
    } finally {
      setExpiredPreviewLoading(false);
    }
  };

  // Handle expired students report download
  const handleExpiredStudentsDownload = async () => {
    setExpiredReportLoading(true);
    try {
      const response = await fetch('/api/students/reports/expired', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'expired_students_report.csv';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Expired students report downloaded successfully!' });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download expired students report');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setExpiredReportLoading(false);
    }
  };

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

  // Logout specific user with progress tracking
  const [logoutProgress, setLogoutProgress] = useState({ running: false, status: '', userId: null });

  const handleLogoutUser = async (userId, username) => {
    setLoading(true);
    setLogoutProgress({ 
      running: true, 
      status: `Logging out user "${username}"...`, 
      userId: userId 
    });
    
    try {
      // Add a small delay to show the progress indicator
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setLogoutProgress({ 
        running: true, 
        status: `Invalidating sessions for "${username}"...`, 
        userId: userId 
      });
      
      const response = await fetch(`/api/admin/users/${userId}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setLogoutProgress({ 
          running: true, 
          status: `User "${username}" logged out successfully!`, 
          userId: userId 
        });
        
        // Show success status for a moment before clearing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setMessage({ 
          type: 'success', 
          text: `✅ User "${username}" has been logged out successfully. All their active sessions have been invalidated and they will need to login again to access the system.` 
        });
        
        // Optionally refresh user list to show any status changes
        fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Logout failed');
      }
    } catch (error) {
      setLogoutProgress({ 
        running: false, 
        status: `Failed to logout "${username}"`, 
        userId: null 
      });
      setMessage({ 
        type: 'error', 
        text: `❌ Failed to logout user "${username}": ${error.message}` 
      });
    } finally {
      // Clear progress after a delay
      setTimeout(() => {
        setLogoutProgress({ running: false, status: '', userId: null });
      }, 2000);
      
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

  // Expense categories state and handlers
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', description: '' });
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [editCategoryForm, setEditCategoryForm] = useState({ id: null, name: '', description: '' });

  const fetchExpenseCategories = async () => {
    setCategoriesLoading(true);
    try {
      const resp = await fetch('/api/admin/expense-categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!resp.ok) throw new Error('Failed to load categories');
      const data = await resp.json();
      setExpenseCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to load categories', err);
      setExpenseCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    // Fetch categories when admin panel mounts
    fetchExpenseCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategoryForm.name.trim()) {
      setMessage({ type: 'error', text: 'Category name is required' });
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/expense-categories', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCategoryForm)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add category');
      }
      setMessage({ type: 'success', text: 'Category added' });
      setNewCategoryForm({ name: '', description: '' });
      fetchExpenseCategories();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = (cat) => {
    setEditCategoryForm({ id: cat.id, name: cat.name, description: cat.description || '' });
    setEditCategoryDialogOpen(true);
  };

  const handleSaveEditCategory = async () => {
    if (!editCategoryForm.name.trim()) {
      setMessage({ type: 'error', text: 'Category name is required' });
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/admin/expense-categories/${editCategoryForm.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editCategoryForm.name, description: editCategoryForm.description })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update category');
      }
      setMessage({ type: 'success', text: 'Category updated' });
      setEditCategoryDialogOpen(false);
      fetchExpenseCategories();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDeleteCategory = (cat) => {
    setConfirmDialog({
      open: true,
      action: 'deleteExpenseCategory',
      data: cat.id,
      title: 'Delete Expense Category',
      content: `Are you sure you want to delete category "${cat.name}"? This cannot be undone and will fail if any expenses reference this category.`
    });
  };

  const handleDeleteCategory = async (id) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/admin/expense-categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete category');
      }
      setMessage({ type: 'success', text: 'Category deleted' });
      fetchExpenseCategories();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: '', data: null });
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

  const handleAddMembershipType = async () => {
    if (!newMembershipTypeForm.membership_type.trim()) {
      setMessage({ type: 'error', text: 'Membership type is required' });
      return;
    }

    if (!newMembershipTypeForm.male_monthly_fees || !newMembershipTypeForm.female_monthly_fees) {
      setMessage({ type: 'error', text: 'Both male and female fees are required' });
      return;
    }

    if (parseFloat(newMembershipTypeForm.male_monthly_fees) <= 0 || parseFloat(newMembershipTypeForm.female_monthly_fees) <= 0) {
      setMessage({ type: 'error', text: 'Fees must be positive numbers' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/fees-config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          membership_type: newMembershipTypeForm.membership_type.trim(),
          male_monthly_fees: parseFloat(newMembershipTypeForm.male_monthly_fees),
          female_monthly_fees: parseFloat(newMembershipTypeForm.female_monthly_fees)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add new membership type');
      }

      setMessage({ type: 'success', text: `New membership type "${newMembershipTypeForm.membership_type}" added successfully` });
      setNewMembershipTypeForm({ membership_type: '', male_monthly_fees: '', female_monthly_fees: '' });
      fetchFeesConfig(); // Refresh the data
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMembershipType = async (membershipType) => {
    if (membershipType === 'full_time') {
      setMessage({ type: 'error', text: 'Cannot delete the default full_time membership type' });
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete the "${membershipType}" membership type? This action cannot be undone.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/fees-config/${membershipType}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete membership type');
      }

      setMessage({ type: 'success', text: `Membership type "${membershipType}" deleted successfully` });
      fetchFeesConfig(); // Refresh the data
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEditMembershipType = (config) => {
    if (config.membership_type === 'full_time') {
      // For full_time, only allow fee editing, not renaming
      setEditMembershipTypeForm({
        original_name: config.membership_type,
        new_name: config.membership_type,
        male_monthly_fees: config.male_monthly_fees,
        female_monthly_fees: config.female_monthly_fees
      });
    } else {
      // For other types, allow full editing
      setEditMembershipTypeForm({
        original_name: config.membership_type,
        new_name: config.membership_type,
        male_monthly_fees: config.male_monthly_fees,
        female_monthly_fees: config.female_monthly_fees
      });
    }
    setEditMembershipDialogOpen(true);
  };

  const handleSaveEditMembershipType = async () => {
    if (!editMembershipTypeForm.new_name.trim()) {
      setMessage({ type: 'error', text: 'Membership type name is required' });
      return;
    }

    if (!editMembershipTypeForm.male_monthly_fees || !editMembershipTypeForm.female_monthly_fees) {
      setMessage({ type: 'error', text: 'Both male and female fees are required' });
      return;
    }

    if (parseFloat(editMembershipTypeForm.male_monthly_fees) <= 0 || parseFloat(editMembershipTypeForm.female_monthly_fees) <= 0) {
      setMessage({ type: 'error', text: 'Fees must be positive numbers' });
      return;
    }

    setLoading(true);
    try {
      // Check if name changed (and it's not full_time)
      const nameChanged = editMembershipTypeForm.original_name !== editMembershipTypeForm.new_name.trim() 
                         && editMembershipTypeForm.original_name !== 'full_time';

      if (nameChanged) {
        // Rename the membership type
        const renameResponse = await fetch(`/api/admin/fees-config/${editMembershipTypeForm.original_name}/rename`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            new_membership_type: editMembershipTypeForm.new_name.trim()
          })
        });

        if (!renameResponse.ok) {
          const error = await renameResponse.json();
          throw new Error(error.error || 'Failed to rename membership type');
        }
      }

      // Update the fees (use new name if renamed, otherwise use original)
      const targetName = nameChanged ? editMembershipTypeForm.new_name.trim() : editMembershipTypeForm.original_name;
      
      const feesResponse = await fetch(`/api/admin/fees-config/${targetName}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          male_monthly_fees: parseFloat(editMembershipTypeForm.male_monthly_fees),
          female_monthly_fees: parseFloat(editMembershipTypeForm.female_monthly_fees)
        })
      });

      if (!feesResponse.ok) {
        const error = await feesResponse.json();
        throw new Error(error.error || 'Failed to update fees');
      }

      const successMessage = nameChanged 
        ? `Membership type renamed to "${editMembershipTypeForm.new_name}" and fees updated successfully`
        : `Fees updated successfully for "${editMembershipTypeForm.original_name}"`;
      
      setMessage({ type: 'success', text: successMessage });
      setEditMembershipDialogOpen(false);
      setEditMembershipTypeForm({ original_name: '', new_name: '', male_monthly_fees: '', female_monthly_fees: '' });
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
              key="expense-categories"
              label="Expenses"
              icon={<WarningIcon />}
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
            <Grid item xs={12} lg={4}>
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
            <Grid item xs={12} lg={4}>
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

            {/* Expired Students Report */}
            <Grid item xs={12} lg={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="warning" />
                    Expired Students Report
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Download a detailed CSV report of all expired students with their information and payment history.
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Button
                      variant="outlined"
                      color="info"
                      onClick={handleExpiredStudentsPreview}
                      disabled={expiredPreviewLoading}
                      sx={{ flex: 1 }}
                      startIcon={expiredPreviewLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
                    >
                      {expiredPreviewLoading ? 'Loading...' : 'Preview'}
                    </Button>
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={handleExpiredStudentsDownload}
                      disabled={expiredReportLoading}
                      sx={{ flex: 1 }}
                      startIcon={expiredReportLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
                    >
                      {expiredReportLoading ? 'Downloading...' : 'Download CSV'}
                    </Button>
                  </Box>

                  {/* Preview Data Display */}
                  {expiredPreviewData && (
                    <Alert severity={expiredPreviewData.count > 0 ? "warning" : "info"} sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Preview Results:
                      </Typography>
                      <Typography variant="body2">
                        {expiredPreviewData.count > 0 
                          ? `Found ${expiredPreviewData.count} expired students ready for download.`
                          : 'No expired students found in the system.'
                        }
                      </Typography>
                      {expiredPreviewData.count > 0 && expiredPreviewData.data && expiredPreviewData.data.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Sample: {expiredPreviewData.data[0].student_name} 
                            (Seat: {expiredPreviewData.data[0].seat_number || 'None'}, 
                            Expired: {expiredPreviewData.data[0].days_expired} days)
                          </Typography>
                        </Box>
                      )}
                    </Alert>
                  )}

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Report includes:</strong> Student Name, Father Name, Mobile, Seat Number, Membership Details, Payment History, and Days Expired.
                    </Typography>
                  </Alert>
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
                          <>
                            <IconButton
                              onClick={() => setConfirmDialog({
                                open: true,
                                action: 'logoutUser',
                                data: user,
                                title: 'Logout User',
                                content: `Are you sure you want to logout user "${user.username}"? They will need to login again to access the system.`
                              })}
                              color="warning"
                              size="small"
                              title="Logout this user"
                              disabled={logoutProgress.running && logoutProgress.userId === user.id}
                            >
                              {logoutProgress.running && logoutProgress.userId === user.id ? (
                                <CircularProgress size={16} color="warning" />
                              ) : (
                                <PowerSettingsNewIcon />
                              )}
                            </IconButton>
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
                              disabled={logoutProgress.running && logoutProgress.userId === user.id}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Logout Progress Indicator */}
            {logoutProgress.running && (
              <Box sx={{ mt: 2 }}>
                <Card sx={{ backgroundColor: 'warning.light', color: 'warning.contrastText' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    <Typography variant="body2">
                      {logoutProgress.status}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            )}
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
            
            {/* Add New Membership Type Form */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AddIcon color="primary" />
                  Add New Membership Type
                </Typography>
                
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Membership Type Name"
                      value={newMembershipTypeForm.membership_type}
                      onChange={(e) => setNewMembershipTypeForm({ 
                        ...newMembershipTypeForm, 
                        membership_type: e.target.value 
                      })}
                      fullWidth
                      placeholder="e.g., student, senior_citizen, corporate"
                      helperText="Enter a unique name (no spaces, use underscore for separation)"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Male Monthly Fee (₹)"
                      type="number"
                      value={newMembershipTypeForm.male_monthly_fees}
                      onChange={(e) => setNewMembershipTypeForm({ 
                        ...newMembershipTypeForm, 
                        male_monthly_fees: e.target.value 
                      })}
                      inputProps={{ min: 0, step: 10 }}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Female Monthly Fee (₹)"
                      type="number"
                      value={newMembershipTypeForm.female_monthly_fees}
                      onChange={(e) => setNewMembershipTypeForm({ 
                        ...newMembershipTypeForm, 
                        female_monthly_fees: e.target.value 
                      })}
                      inputProps={{ min: 0, step: 10 }}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleAddMembershipType}
                      disabled={loading}
                      fullWidth
                      sx={{ height: '56px' }}
                      startIcon={<AddIcon />}
                    >
                      {loading ? 'Adding...' : 'Add'}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            {/* Existing Membership Types */}
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <EditIcon color="primary" />
              Existing Membership Types
            </Typography>
            
            <Grid container spacing={3}>
              {feesConfig.map((config) => (
                <Grid item xs={12} md={6} key={config.membership_type}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MoneyIcon color="primary" />
                          {config.membership_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          {config.membership_type === 'full_time' && (
                            <Chip label="Default" size="small" color="primary" variant="outlined" />
                          )}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditMembershipType(config)}
                            color="primary"
                            title="Edit membership type"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          
                          {config.membership_type !== 'full_time' && (
                            <IconButton 
                              size="small" 
                              onClick={() => handleDeleteMembershipType(config.membership_type)}
                              color="error"
                              title="Delete membership type"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <TextField
                          label="Male (₹)"
                          type="number"
                          value={config.male_monthly_fees}
                          inputProps={{ min: 0, step: 10, readOnly: true }}
                          fullWidth
                          disabled
                        />
                        <TextField
                          label="Female (₹)"
                          type="number"
                          value={config.female_monthly_fees}
                          inputProps={{ min: 0, step: 10, readOnly: true }}
                          fullWidth
                          disabled
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Current fees: Male ₹{config.male_monthly_fees} • Female ₹{config.female_monthly_fees}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            
            {feesConfig.length === 0 && (
              <Alert severity="info">
                No fees configuration found. Default fees will be applied.
              </Alert>
            )}
          </Box>
        )}

        {/* Expense Categories Management Tab */}
  {tabValue === IDX_EXPENSE_CATEGORIES && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <WarningIcon color="primary" />
              Expense Categories
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Add New Category</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                      <TextField
                        label="Name"
                        value={newCategoryForm.name}
                        onChange={(e) => setNewCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                        fullWidth
                      />
                      <TextField
                        label="Description (optional)"
                        value={newCategoryForm.description}
                        onChange={(e) => setNewCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                        fullWidth
                        multiline
                        rows={2}
                      />
                      <Box sx={{ mt: 1 }}>
                        <Button variant="contained" onClick={handleAddCategory} startIcon={<AddIcon />} disabled={loading} fullWidth size="large" disableElevation sx={{ width: '100%', py: 1.5 }}>Add</Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Existing Categories</Typography>
                    <TableContainer component={Paper} sx={{ mt: 1 }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {expenseCategories.map(cat => (
                            <TableRow key={cat.id}>
                              <TableCell>{cat.name}</TableCell>
                              <TableCell>{cat.description}</TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={() => handleEditCategory(cat)}><EditIcon /></IconButton>
                                <IconButton size="small" color="error" onClick={() => handleRequestDeleteCategory(cat)}><DeleteIcon /></IconButton>
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

            {/* Edit Category Dialog */}
            <Dialog open={editCategoryDialogOpen} onClose={() => setEditCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Edit Expense Category</DialogTitle>
              <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <TextField label="Name" value={editCategoryForm.name} onChange={(e) => setEditCategoryForm(prev => ({ ...prev, name: e.target.value }))} fullWidth />
                  <TextField label="Description" value={editCategoryForm.description} onChange={(e) => setEditCategoryForm(prev => ({ ...prev, description: e.target.value }))} fullWidth multiline rows={3} />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditCategoryDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveEditCategory} variant="contained" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
              </DialogActions>
            </Dialog>
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
            } else if (action === 'logoutUser') {
              handleLogoutUser(data.id, data.username);
            } else if (action === 'cleanDatabase') {
              handleCleanDatabase();
            } else if (action === 'deleteSeat') {
              handleDeleteSeat(data);
            } else if (action === 'deleteExpenseCategory') {
              // data contains the category id
              handleDeleteCategory(data);
            }
          }}
          onCancel={() => setConfirmDialog({ open: false, action: '', data: null })}
        />

        {/* Edit Membership Type Dialog */}
        <Dialog open={editMembershipDialogOpen} onClose={() => setEditMembershipDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Edit Membership Type
            {editMembershipTypeForm.original_name === 'full_time' && (
              <Chip label="Protected Type - Name cannot be changed" size="small" color="warning" sx={{ ml: 2 }} />
            )}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Membership Type Name"
                value={editMembershipTypeForm.new_name}
                onChange={(e) => setEditMembershipTypeForm({ 
                  ...editMembershipTypeForm, 
                  new_name: e.target.value 
                })}
                fullWidth
                disabled={editMembershipTypeForm.original_name === 'full_time'}
                helperText={editMembershipTypeForm.original_name === 'full_time' ? 'The full_time membership type cannot be renamed' : 'Enter the membership type name'}
              />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Male Monthly Fee (₹)"
                  type="number"
                  value={editMembershipTypeForm.male_monthly_fees}
                  onChange={(e) => setEditMembershipTypeForm({ 
                    ...editMembershipTypeForm, 
                    male_monthly_fees: e.target.value 
                  })}
                  inputProps={{ min: 0, step: 10 }}
                  fullWidth
                />
                <TextField
                  label="Female Monthly Fee (₹)"
                  type="number"
                  value={editMembershipTypeForm.female_monthly_fees}
                  onChange={(e) => setEditMembershipTypeForm({ 
                    ...editMembershipTypeForm, 
                    female_monthly_fees: e.target.value 
                  })}
                  inputProps={{ min: 0, step: 10 }}
                  fullWidth
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditMembershipDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveEditMembershipType} 
              variant="contained" 
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
      
      {/* AI Chat Widget for Admin */}
      {isAdmin && <AIChatWidget />}
      
      <Footer />
    </Container>
  );
}

export default AdminPanel;
