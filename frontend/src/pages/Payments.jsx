import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Grid,
  TableContainer,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  TablePagination,
  useTheme,
  useMediaQuery,
  Box,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import { Autocomplete } from '@mui/material';
import { Refresh as RefreshIcon, Delete as DeleteIcon } from '@mui/icons-material';
import MobileFilters from '../components/MobileFilters';
import Footer from '../components/Footer';
import AddPaymentDialog from '../components/AddPaymentDialog';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { tableStyles, loadingStyles, errorStyles, pageStyles } from '../styles/commonStyles';
import api from '../services/api';
import { todayInIST, getUtcMidnightForDateInTZ, formatDateTimeForDisplay } from '../utils/dateUtils';

// use shared utils for timezone-aware formatting

// use formatDateTimeForDisplay from shared utils

// PaymentCard component for mobile view
const PaymentCard = ({ payment, onDelete }) => {
  const { user } = useAuth();

  const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    return `₹${Math.abs(numAmount).toLocaleString()}`;
  };

  const getAmountColor = (amount) => {
    const numAmount = Number(amount) || 0;
    return numAmount < 0 ? 'error' : 'success';
  };

  const getPaymentModeIcon = (mode) => {
    return mode === 'online' ? '💳' : '💵';
  };

  return (
    <Card sx={{ mb: 1.5, boxShadow: 1, borderRadius: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header Row */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box flex={1}>
            <Typography variant="subtitle2" component="div" fontWeight="600" noWrap>
              {payment.student_name || 'N/A'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              #{payment.student_id} • 🪑{payment.seat_number || 'N/A'}
            </Typography>
          </Box>
          <Chip 
            label={formatCurrency(payment.amount)}
            color={getAmountColor(payment.amount)}
            variant="filled"
            size="small"
            sx={{ minWidth: 80, fontWeight: 600 }}
          />
        </Box>
        
        {/* Details Row */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              {getPaymentModeIcon(payment.payment_mode)} {payment.payment_mode || 'cash'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              • {payment.payment_type || 'fee'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              📅 {formatDateTimeForDisplay(payment.payment_date)}
            </Typography>
            {user && user.role === 'admin' && (
              <IconButton size="small" color="error" onClick={() => onDelete && onDelete(payment.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

function Payments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const [totalPayments, setTotalPayments] = useState(0);
  // Students list for Add Payment dropdown
  const [students, setStudents] = useState([]);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  // Default date should be today's date in Asia/Kolkata (YYYY-MM-DD)
  // re-use shared todayInIST helper
  const [paymentDataLocal, setPaymentDataLocal] = useState({ amount: '', method: 'cash', type: 'monthly_fee', date: todayInIST(), notes: '' });
  const [paymentLoadingLocal, setPaymentLoadingLocal] = useState(false);
  const [feeConfig, setFeeConfig] = useState(null);
  const [membershipExtensionDays, setMembershipExtensionDays] = useState(0);
  const [membershipCurrentTill, setMembershipCurrentTill] = useState(null);
  const [membershipNewTill, setMembershipNewTill] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 15 : 25);
  const [filters, setFilters] = useState({
    seatNumber: '',
    studentName: '',
    studentId: '',
  startDate: '',
  endDate: '',
  paymentMode: ''
  });
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState(null);

  // Global error handler for API calls
  const handleApiError = (error, fallbackMessage = 'An error occurred') => {
    if (error?.response?.data?.error === 'TOKEN_EXPIRED') {
      // Let the global interceptor handle token expiration
      return;
    }
    setError(error?.response?.data?.message || error?.message || fallbackMessage);
  };

  useEffect(() => {
  fetchPayments();
    // Prefetch students for dropdown
    fetchStudentsForDropdown();
  }, []);

  const fetchStudentsForDropdown = async () => {
    try {
      const resp = await fetch(`/api/students/with-unassigned-seats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setStudents((data && data.students) || []);
    } catch (err) {
      // ignore silently
      console.warn('Failed to load students for dropdown', err);
    }
  };

  // Fetch payments with optional overrides to avoid race conditions when updating page/size
  const fetchPayments = async (overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const pageToUse = typeof overrides.page === 'number' ? overrides.page : page;
      const pageSizeToUse = typeof overrides.pageSize === 'number' ? overrides.pageSize : rowsPerPage;
      const filtersToUse = overrides.filters || filters;

      // Build query params for server-side pagination & filters
      const params = new URLSearchParams();
      params.set('page', pageToUse);
      params.set('pageSize', pageSizeToUse);
      if (filtersToUse.seatNumber) params.set('seatNumber', filtersToUse.seatNumber);
      if (filtersToUse.studentName) params.set('studentName', filtersToUse.studentName);
      if (filtersToUse.studentId) params.set('studentId', filtersToUse.studentId);
      if (filtersToUse.startDate) params.set('startDate', filtersToUse.startDate);
      if (filtersToUse.endDate) params.set('endDate', filtersToUse.endDate);
  if (filtersToUse.paymentMode) params.set('paymentMode', filtersToUse.paymentMode);

      const response = await fetch(`/api/payments?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const payload = await response.json();
      setPayments(payload.payments || []);
      setTotalPayments(payload.total || 0);
    } catch (error) {
      console.error('Error fetching payments:', error);
      handleApiError(error, 'Failed to fetch payments');
      setPayments([]);
      setTotalPayments(0);
    } finally {
      setLoading(false);
    }
  };

  // With server-side pagination, payments already contains the current page
  const displayedPayments = payments || [];

  // (removed local formatDate — use module-level formatDateTimeIST)

  const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    return `₹${numAmount.toLocaleString()}`;
  };

  // Short date formatter like '23 Aug 2025'
  const formatShortDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    } catch (err) {
      return 'N/A';
    }
  };

  // Open Add Payment dialog
  const handleOpenAddPayment = () => {
    setSelectedStudentId('');
  setPaymentDataLocal({ amount: '', method: 'cash', type: 'monthly_fee', date: todayInIST(), notes: '' });
    setFeeConfig(null);
    setMembershipExtensionDays(0);
    setAddPaymentOpen(true);
  };

  // When student selected, fetch fee config to compute extension days
  const handleStudentSelect = async (studentId) => {
    setSelectedStudentId(studentId);
    const student = students.find(s => s.id === studentId);
    if (!student || !student.sex) {
      setFeeConfig(null);
      setMembershipExtensionDays(0);
  setMembershipCurrentTill(null);
  setMembershipNewTill(null);
      return;
    }
    try {
  const membershipType = student.membership_type;
  const resp = await fetch(`/api/students/fee-config/${membershipType}/${student.sex}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!resp.ok) {
        setFeeConfig(null);
        setMembershipExtensionDays(0);
        return;
      }
      const cfg = await resp.json();
      setFeeConfig(cfg);
      // compute membership extension days if amount present
      const amount = parseFloat(paymentDataLocal.amount || 0);
  if (amount > 0 && cfg && parseFloat(cfg.monthly_fees) > 0) {
        const days = Math.floor((amount / cfg.monthly_fees) * 30);
        setMembershipExtensionDays(days);
      } else {
        setMembershipExtensionDays(0);
      }
      // Fetch full student details to read current membership_till
      try {
        const studentResp = await fetch(`/api/students/${studentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        if (studentResp.ok) {
          const fullStudent = await studentResp.json();
          const curTill = fullStudent.membership_till || null;
          setMembershipCurrentTill(curTill);

          // compute projected new membership till based on extensionDays and payment type
          const extDays = Math.floor((parseFloat(paymentDataLocal.amount || 0) / (cfg && cfg.monthly_fees ? cfg.monthly_fees : 1)) * 30) || 0;
          let baseDate = curTill ? new Date(curTill) : new Date();
          if (isNaN(baseDate.getTime())) baseDate = new Date();
          let newDt = null;
          if (extDays > 0) {
            if (paymentDataLocal.type === 'refund') {
              newDt = new Date(baseDate);
              newDt.setDate(newDt.getDate() - extDays);
            } else {
              newDt = new Date(baseDate);
              newDt.setDate(newDt.getDate() + extDays);
            }
          }
          setMembershipNewTill(newDt ? newDt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : null);
        } else {
          setMembershipCurrentTill(null);
          setMembershipNewTill(null);
        }
      } catch (err) {
        setMembershipCurrentTill(null);
        setMembershipNewTill(null);
      }
    } catch (err) {
      setFeeConfig(null);
      setMembershipExtensionDays(0);
    }
  };

  // Update amount and recompute extension
  const handleLocalAmountChange = (val) => {
    setPaymentDataLocal(prev => ({ ...prev, amount: val }));
    const amount = parseFloat(val || 0);
  if (amount > 0 && feeConfig && parseFloat(feeConfig.monthly_fees) > 0) {
      const days = Math.floor((amount / feeConfig.monthly_fees) * 30);
      setMembershipExtensionDays(days);
      // recompute projected membership date
      const extDays = Math.floor((amount / feeConfig.monthly_fees) * 30) || 0;
      let baseDate = membershipCurrentTill ? new Date(membershipCurrentTill) : new Date();
      if (isNaN(baseDate.getTime())) baseDate = new Date();
      let newDt = null;
      if (extDays > 0) {
        if (paymentDataLocal.type === 'refund') {
          newDt = new Date(baseDate);
          newDt.setDate(newDt.getDate() - extDays);
        } else {
          newDt = new Date(baseDate);
          newDt.setDate(newDt.getDate() + extDays);
        }
      }
  setMembershipNewTill(newDt ? newDt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : null);
    } else {
      setMembershipExtensionDays(0);
      setMembershipNewTill(null);
    }
  };

  const processLocalPayment = async (extendMembership = false) => {
    if (!selectedStudentId) {
      setError('Please select a student');
      return;
    }
    // basic validation
    if (!paymentDataLocal.amount || isNaN(paymentDataLocal.amount) || parseFloat(paymentDataLocal.amount) <= 0) {
      setError('Valid payment amount is required');
      return;
    }

    // Check for free membership students (monthly fee = 0) - only for monthly_fee payments, allow refunds
  if (paymentDataLocal.type === 'monthly_fee' && feeConfig && parseFloat(feeConfig.monthly_fees) <= 0) {
      setError('Cannot add monthly fee payment for free membership students (monthly fee = ₹0)');
      return;
    }

    const payload = {
      student_id: selectedStudentId,
      amount: parseFloat(paymentDataLocal.amount),
      payment_date: paymentDataLocal.date,
      payment_mode: paymentDataLocal.method,
      payment_type: paymentDataLocal.type,
      remarks: paymentDataLocal.notes || '',
      extend_membership: extendMembership
    };

    try {
      setPaymentLoadingLocal(true);
      const resp = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add payment');
      }
      // success
      setAddPaymentOpen(false);
      setSelectedStudentId('');
  setPaymentDataLocal({ amount: '', method: 'cash', type: 'monthly_fee', date: todayInIST(), notes: '' });
      setFeeConfig(null);
      setMembershipExtensionDays(0);
      fetchPayments();
    } catch (err) {
      setError(err.message || 'Failed to add payment');
    } finally {
      setPaymentLoadingLocal(false);
    }
  };

  // Recompute projected membership date when payment type changes
  useEffect(() => {
    if (!feeConfig) return;
    const amount = parseFloat(paymentDataLocal.amount || 0);
  if (!(amount > 0 && feeConfig && parseFloat(feeConfig.monthly_fees) > 0)) {
      setMembershipExtensionDays(0);
      setMembershipNewTill(null);
      return;
    }
    const extDays = Math.floor((amount / feeConfig.monthly_fees) * 30);
    setMembershipExtensionDays(extDays);
    let baseDate = membershipCurrentTill ? new Date(membershipCurrentTill) : new Date();
    if (isNaN(baseDate.getTime())) baseDate = new Date();
    let newDt = null;
    if (extDays > 0) {
      if (paymentDataLocal.type === 'refund') {
        newDt = new Date(baseDate);
        newDt.setDate(newDt.getDate() - extDays);
      } else {
        newDt = new Date(baseDate);
        newDt.setDate(newDt.getDate() + extDays);
      }
    }
          setMembershipNewTill(newDt ? newDt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : null);
  }, [paymentDataLocal.type]);

  const getAmountStyle = (amount) => {
    const numAmount = Number(amount) || 0;
    return {
      color: numAmount < 0 ? theme.palette.error.main : theme.palette.success.main,
      fontWeight: 600
    };
  };

  // Open delete confirmation (admin-only)
  const openDeleteDialog = (paymentId) => {
    if (!paymentId) return;
    if (!user || user.role !== 'admin') {
      setError('You do not have permission to delete payments');
      return;
    }
    // Prepare deletion info: compute membership impact if this payment extended membership
    (async () => {
      try {
        setPaymentToDelete(paymentId);
        setDeleteDialogOpen(true); // open early with loading state

        // find payment in local state
        const payment = payments.find(p => p && (p.id === paymentId));
        if (!payment) return;

        // Default: no membership change
        let reductionDays = 0;
        let currentMembershipTill = null;
        let newMembershipTill = null;

        // Only consider membership impact for monthly_fee payments with positive amount
        if (payment.payment_type === 'monthly_fee' && payment.amount && Number(payment.amount) > 0) {
          try {
            // Fetch student to read current membership_till and sex
            const studentResp = await fetch(`/api/students/${payment.student_id}`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (studentResp.ok) {
              const student = await studentResp.json();
              currentMembershipTill = student.membership_till || null;

              // Fetch fee config for student's gender if available
              const sex = student.sex || student.gender || null;
              if (sex) {
                // Use the fetched student object (not a non-existent `selectedStudent`) to read membership type
                const membershipType = (student && (student.membership_type || student.membershipType));
                const cfgResp = await fetch(`/api/students/fee-config/${membershipType}/${sex}`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                });
                if (cfgResp.ok) {
                  const cfg = await cfgResp.json();
                  const monthlyFee = cfg && cfg.monthly_fees ? Number(cfg.monthly_fees) : null;
                  if (monthlyFee && monthlyFee > 0) {
                    reductionDays = Math.floor((Number(payment.amount) / monthlyFee) * 30);
            if (reductionDays > 0 && currentMembershipTill) {
                      // compute new membership_till by subtracting reductionDays
                      const cur = new Date(currentMembershipTill);
                      if (!isNaN(cur.getTime())) {
                        const newDt = new Date(cur);
                        newDt.setDate(newDt.getDate() - reductionDays);
              newMembershipTill = newDt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                      }
                    }
                  }
                }
              }
            }
          } catch (err) {
            // ignore errors computing membership impact
            console.warn('Failed to compute membership impact for deletion', err);
          }
        }

        // store computed info in state so dialog can display it
        setDeleteInfo({ reductionDays, currentMembershipTill, newMembershipTill, payment });
      } catch (err) {
        console.error('openDeleteDialog error', err);
        setPaymentToDelete(paymentId);
        setDeleteInfo(null);
        setDeleteDialogOpen(true);
      }
    })();
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setPaymentToDelete(null);
  setDeleteInfo(null);
  };

  // Perform delete (called after confirmation)
  const handleDeletePayment = async (paymentId) => {
    if (!paymentId) return;
    setDeleting(true);
    setError(null);
    try {
      // Delete payment
      const resp = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete payment');
      }

  // Membership adjustments (if any) are handled server-side in the DELETE endpoint.
  // Do not perform a client-side PUT here; simply refresh data from server to reflect changes.

      // Refresh list
      await fetchPayments();
      closeDeleteDialog();
    } catch (err) {
      console.error('Failed to delete payment:', err);
      setError(err.message || 'Failed to delete payment');
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    // fetch new page
    fetchPayments({ page: newPage, pageSize: rowsPerPage });
  };

  const handleChangeRowsPerPage = (event) => {
    const newSize = parseInt(event.target.value, 10);
    setRowsPerPage(newSize);
    setPage(0);
    // fetch first page with new page size
    fetchPayments({ page: 0, pageSize: newSize });
  };

  // Refetch when filters change (reset to page 0)
  useEffect(() => {
    setPage(0);
    fetchPayments({ page: 0, filters });
  }, [filters]);

  return (
    <Container sx={pageStyles.container}>
      <Box sx={pageStyles.header}>
        <Typography 
          variant={isMobile ? "h6" : "h4"}
          component="h1"
          fontWeight="bold"
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            fontSize: isMobile ? '1.1rem' : undefined 
          }}
        >
          💰 Payments (Only last 30 Days)
        </Typography>
        <Box sx={pageStyles.actions}>
          {!isMobile && (
            <FormControl size={isMobile ? 'small' : 'small'} sx={{ minWidth: 160, mr: 1 }}>
              <InputLabel id="desktop-payment-mode-label">Payment Mode</InputLabel>
              <Select
                labelId="desktop-payment-mode-label"
                label="Payment Mode"
                value={filters.paymentMode}
                onChange={(e) => setFilters({ ...filters, paymentMode: e.target.value })}
                size={isMobile ? 'small' : 'small'}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="online">Online</MenuItem>
              </Select>
            </FormControl>
          )}
          <Tooltip title="Refresh data">
            <IconButton onClick={fetchPayments} color="primary" size={isMobile ? "small" : "medium"}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            color="primary"
            size={isMobile ? 'small' : 'medium'}
            sx={{ ml: 1, ...pageStyles.actionButton }}
            onClick={handleOpenAddPayment}
          >
            Add/Refund Payment
          </Button>
        </Box>
  </Box>

      <Paper sx={tableStyles.paper}>
        {/* Filters */}
        <MobileFilters
          title="Payment Filters"
          filterCount={Object.values(filters).filter(v => v && v !== '').length}
          onClearAll={() => setFilters({ seatNumber: '', studentName: '', studentId: '', startDate: '', endDate: '', paymentMode: '' })}
          activeFilters={{
            seat: filters.seatNumber,
            name: filters.studentName,
            id: filters.studentId,
            start: filters.startDate,
            end: filters.endDate,
            mode: filters.paymentMode
          }}
          onFilterRemove={(key) => {
            const newFilters = { ...filters };
            switch (key) {
              case 'seat': newFilters.seatNumber = ''; break;
              case 'name': newFilters.studentName = ''; break;
              case 'id': newFilters.studentId = ''; break;
              case 'start': newFilters.startDate = ''; break;
              case 'end': newFilters.endDate = ''; break;
              case 'mode': newFilters.paymentMode = ''; break;
            }
            setFilters(newFilters);
          }}
        >
          <TextField
            label="Search by Seat Number"
            fullWidth
            value={filters.seatNumber}
            onChange={(e) => setFilters({ ...filters, seatNumber: e.target.value })}
            size="small"
          />
          <TextField
            label="Search by Student Name"
            fullWidth
            value={filters.studentName}
            onChange={(e) => setFilters({ ...filters, studentName: e.target.value })}
            size="small"
          />
          <TextField
            label="Search by Student ID"
            fullWidth
            value={filters.studentId}
            onChange={(e) => setFilters({ ...filters, studentId: e.target.value })}
            size="small"
          />
          <TextField
            label="Start Date"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
          <TextField
            label="End Date"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="payment-mode-label">Payment Mode</InputLabel>
            <Select
              labelId="payment-mode-label"
              label="Payment Mode"
              value={filters.paymentMode}
              onChange={(e) => setFilters({ ...filters, paymentMode: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="online">Online</MenuItem>
            </Select>
          </FormControl>
        </MobileFilters>

        {loading ? (
          <div style={loadingStyles.container}>
            <CircularProgress />
            <Typography sx={loadingStyles.progress}>
              Loading payments...
            </Typography>
          </div>
        ) : error ? (
          <Alert severity="error" sx={errorStyles.alert}>
            Error loading payments: {error}
          </Alert>
        ) : (
          <>
            {/* Desktop Table View */}
            {!isMobile && (
              <Paper sx={tableStyles.paper}>
                <TableContainer sx={tableStyles.tableContainer}>
                  <Table stickyHeader sx={tableStyles.table}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Student ID</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Contact</TableCell>
                        <TableCell>Seat Number</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Payment Mode</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayedPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} align="center">
                            No payments found
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedPayments.map((payment) => (
                          <TableRow key={payment.id} sx={tableStyles.tableRow}>
                            <TableCell>{payment.student_id || 'N/A'}</TableCell>
                            <TableCell>{payment.student_name || 'N/A'}</TableCell>
                            <TableCell>{payment.contact_number || 'N/A'}</TableCell>
                            <TableCell>{payment.seat_number || 'N/A'}</TableCell>
                            <TableCell sx={getAmountStyle(payment.amount)}>
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>{formatDateTimeForDisplay(payment.payment_date)}</TableCell>
                            <TableCell>{payment.payment_mode || 'N/A'}</TableCell>
                            <TableCell>{payment.payment_type || 'N/A'}</TableCell>
                            <TableCell align="center">
                              {user && user.role === 'admin' && (
                                <IconButton size="small" color="error" onClick={() => openDeleteDialog(payment.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Desktop Pagination */}
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={totalPayments}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="Rows per page:"
                  sx={{ borderTop: 1, borderColor: 'divider' }}
                />
              </Paper>
            )}

            {/* Mobile Card View */}
            {isMobile && (
              <Box>
                {displayedPayments.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                      No payments found
                    </Typography>
                  </Paper>
                ) : (
                  displayedPayments.map((payment) => (
                    <PaymentCard key={payment.id} payment={payment} onDelete={openDeleteDialog} />
                  ))
                )}

                {/* Mobile Pagination */}
                <Paper sx={{ mt: 1 }}>
                  <TablePagination
                      component="div"
                      count={totalPayments}
                      page={page}
                      onPageChange={handleChangePage}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      rowsPerPageOptions={[10, 25, 50]}
                      labelRowsPerPage="Per page:"
                      labelDisplayedRows={({ from, to, count }) => 
                        `${from}-${to} of ${count}`
                      }
                      sx={{
                        '& .MuiTablePagination-toolbar': {
                          paddingLeft: 1,
                          paddingRight: 1,
                        },
                        '& .MuiTablePagination-selectLabel': {
                          fontSize: '0.875rem',
                        },
                        '& .MuiTablePagination-displayedRows': {
                          fontSize: '0.875rem',
                        }
                      }}
                    />
                </Paper>
              </Box>
            )}
          </>
        )}
      </Paper>
      {/* Add Payment Dialog (select student + amount) */}
      <AddPaymentDialog
        open={addPaymentOpen}
        onClose={() => setAddPaymentOpen(false)}
        onSubmit={processLocalPayment}
        students={students}
        onStudentSelect={handleStudentSelect}
        selectedStudentId={selectedStudentId}
        paymentData={paymentDataLocal}
        setPaymentData={setPaymentDataLocal}
        onAmountChange={handleLocalAmountChange}
        feeConfig={feeConfig}
        membershipExtensionDays={membershipExtensionDays}
        loading={paymentLoadingLocal}
        isMobile={isMobile}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm delete</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to delete this payment? This action cannot be undone.</Typography>

            {/* Show computed membership impact if available */}
            {deleteInfo && (deleteInfo.reductionDays > 0 || deleteInfo.currentMembershipTill) && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Membership impact</Typography>
                {deleteInfo.currentMembershipTill ? (
                  <Typography variant="body2">Current membership till: {formatShortDate(deleteInfo.currentMembershipTill)}</Typography>
                ) : (
                  <Typography variant="body2">Current membership till: N/A</Typography>
                )}
                <Typography variant="body2">Reduction days: {deleteInfo.reductionDays || 0} day(s)</Typography>
                {deleteInfo.newMembershipTill ? (
                  <Typography variant="body2">New membership till: {formatShortDate(deleteInfo.newMembershipTill)}</Typography>
                ) : null}
              </Box>
            )}

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={deleting}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleDeletePayment(paymentToDelete)}
            disabled={deleting || !(deleteInfo && (deleteInfo.reductionDays > 0 || deleteInfo.currentMembershipTill))}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Footer />
    </Container>
  );
}

export default Payments;
