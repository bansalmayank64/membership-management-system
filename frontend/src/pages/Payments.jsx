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
import { tableStyles, loadingStyles, errorStyles, pageStyles } from '../styles/commonStyles';
import api from '../services/api';

// PaymentCard component for mobile view
const PaymentCard = ({ payment }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return amount ? `₹${Number(amount).toLocaleString()}` : '₹0';
  };

  return (
    <Card sx={{ mb: 2, boxShadow: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography variant="subtitle1" component="div" fontWeight="bold">
              {payment.studentName || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {payment.studentId || 'N/A'} • Seat #{payment.seatNumber}
            </Typography>
          </Box>
          <Chip 
            label={formatCurrency(payment.amount)}
            color="success"
            variant="filled"
            size="small"
          />
        </Box>
        
        <Box display="flex" flexDirection="column" gap={0.5}>
          <Typography variant="body2">
            <strong>Contact:</strong> {payment.contact || 'N/A'}
          </Typography>
          
          <Typography variant="body2">
            <strong>Date:</strong> {formatDate(payment.date)}
          </Typography>
          
          <Typography variant="body2">
            <strong>Payment Mode:</strong> {payment.paymentMode || 'Cash'}
          </Typography>
          
          {payment.month && (
            <Typography variant="body2">
              <strong>Month:</strong> {payment.month}
            </Typography>
          )}
          
          {payment.description && (
            <Typography variant="body2">
              <strong>Description:</strong> {payment.description}
            </Typography>
          )}
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
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);
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
      String(payment.seatNumber).toLowerCase().includes(filters.seatNumber.toLowerCase());
    const paymentDate = new Date(payment.date);
    const afterStart = !filters.startDate || paymentDate >= new Date(filters.startDate);
    const beforeEnd = !filters.endDate || paymentDate <= new Date(filters.endDate);
    return matchesSeat && afterStart && beforeEnd;
  })
  // Sort by date - latest first
  .sort((a, b) => new Date(b.date) - new Date(a.date)) || [];

  const displayedPayments = filteredPayments
    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB'); // dd/mm/yyyy format
    } catch (error) {
      return dateString;
    }
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
          variant={isMobile ? "h5" : "h4"}
          component="h1"
          fontWeight="bold"
        >
          Payment History
        </Typography>
        <Tooltip title="Refresh data">
          <IconButton onClick={fetchPayments} color="primary">
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
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayedPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center">
                            No payments found
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedPayments.map((payment) => (
                          <TableRow key={payment.id} sx={tableStyles.tableRow}>
                            <TableCell>{payment.studentId || 'N/A'}</TableCell>
                            <TableCell>{payment.studentName || 'N/A'}</TableCell>
                            <TableCell>{payment.contact || 'N/A'}</TableCell>
                            <TableCell>{payment.seatNumber}</TableCell>
                            <TableCell>₹{payment.amount}</TableCell>
                            <TableCell>{formatDate(payment.date)}</TableCell>
                            <TableCell>{payment.paymentMode}</TableCell>
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
                <Paper sx={{ mt: 2 }}>
                  <TablePagination
                    component="div"
                    count={filteredPayments.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25]}
                    labelRowsPerPage="Per page:"
                  />
                </Paper>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
}

export default Payments;
