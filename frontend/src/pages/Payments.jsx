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
import { Refresh as RefreshIcon } from '@mui/icons-material';
import MobileFilters from '../components/MobileFilters';
import Footer from '../components/Footer';
import { tableStyles, loadingStyles, errorStyles, pageStyles } from '../styles/commonStyles';
import api from '../services/api';

// Utility function to convert GMT to IST
const convertToIST = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  // Convert to IST (GMT+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  return new Date(date.getTime() + istOffset);
};

// PaymentCard component for mobile view
const PaymentCard = ({ payment }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      // Convert GMT to IST first
      const gmtDate = new Date(dateString);
      const istDate = new Date(gmtDate.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return formatter.format(istDate);
    } catch (error) {
      return 'N/A';
    }
  };

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
          <Typography variant="caption" color="text.secondary">
            📅 {formatDate(payment.payment_date)}
          </Typography>
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 15 : 25);
  const [filters, setFilters] = useState({
    seatNumber: '',
    startDate: '',
    endDate: ''
  });

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
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
  const response = await fetch(`/api/payments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const paymentArray = await response.json();
      setPayments(paymentArray);
    } catch (error) {
      console.error('Error fetching payments:', error);
      handleApiError(error, 'Failed to fetch payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments?.filter(payment => {
    const matchesSeat = !filters.seatNumber || 
      String(payment.seat_number).toLowerCase().includes(filters.seatNumber.toLowerCase());
    
    // Convert payment date to IST for filtering
    const paymentDate = new Date(payment.payment_date);
    const paymentDateIST = new Date(paymentDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Convert filter dates to IST for comparison
    const startDateIST = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null;
    const endDateIST = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : null;
    
    const afterStart = !startDateIST || paymentDateIST >= startDateIST;
    const beforeEnd = !endDateIST || paymentDateIST <= endDateIST;
    
    return matchesSeat && afterStart && beforeEnd;
  })
  // Sort by payment_date - latest first (descending order)
  .sort((a, b) => {
    const dateA = new Date(a.payment_date);
    const dateB = new Date(b.payment_date);
    return dateB - dateA; // Descending order (latest first)
  }) || [];

  const displayedPayments = filteredPayments
    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatDate = (dateString) => {
    try {
      // Convert GMT to IST first
      const gmtDate = new Date(dateString);
      const istDate = new Date(gmtDate.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
      
      const formatter = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return formatter.format(istDate);
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    return `₹${numAmount.toLocaleString()}`;
  };

  const getAmountStyle = (amount) => {
    const numAmount = Number(amount) || 0;
    return {
      color: numAmount < 0 ? theme.palette.error.main : theme.palette.success.main,
      fontWeight: 600
    };
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Container sx={pageStyles.container}>
      <div style={pageStyles.header}>
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
        <Tooltip title="Refresh data">
          <IconButton onClick={fetchPayments} color="primary" size={isMobile ? "small" : "medium"}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </div>

      <Paper sx={tableStyles.paper}>
        {/* Filters */}
        <MobileFilters
          title="Payment Filters"
          filterCount={Object.values(filters).filter(v => v && v !== '').length}
          onClearAll={() => setFilters({ seatNumber: '', startDate: '', endDate: '' })}
          activeFilters={{
            seat: filters.seatNumber,
            start: filters.startDate,
            end: filters.endDate
          }}
          onFilterRemove={(key) => {
            const newFilters = { ...filters };
            switch (key) {
              case 'seat': newFilters.seatNumber = ''; break;
              case 'start': newFilters.startDate = ''; break;
              case 'end': newFilters.endDate = ''; break;
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
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayedPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
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
                            <TableCell>{formatDate(payment.payment_date)}</TableCell>
                            <TableCell>{payment.payment_mode || 'N/A'}</TableCell>
                            <TableCell>{payment.payment_type || 'N/A'}</TableCell>
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
                  count={filteredPayments.length}
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
                    <PaymentCard key={payment.id} payment={payment} />
                  ))
                )}
                
                {/* Mobile Pagination */}
                <Paper sx={{ mt: 1 }}>
                  <TablePagination
                    component="div"
                    count={filteredPayments.length}
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
      
      <Footer />
    </Container>
  );
}

export default Payments;
