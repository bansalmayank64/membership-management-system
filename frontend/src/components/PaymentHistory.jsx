import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Box,
  Divider,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  Grid,
  IconButton
} from '@mui/material';
import { 
  History as HistoryIcon, 
  Payment as PaymentIcon,
  Clear as ClearIcon 
} from '@mui/icons-material';function PaymentHistory({ open, onClose, student }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && student?.seatNumber) {
      fetchPaymentHistory();
    }
  }, [open, student]);

  const fetchPaymentHistory = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(
  `/api/payments?seatNumber=${student.seatNumber}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const allPayments = await response.json();
      
      // Filter payments for this student and sort by date (newest first)
      const studentPayments = (allPayments || [])
        .filter(payment => String(payment.seat_number) === String(student.seatNumber))
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
      
      setPayments(studentPayments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getPaymentModeColor = (mode) => {
    const modeColors = {
      'Cash': 'success',
      'Online': 'primary',
      'Card': 'secondary',
      'UPI': 'info',
      'Bank Transfer': 'warning'
    };
    return modeColors[mode] || 'default';
  };

  const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

  // Mobile Payment Card Component
  const PaymentCard = ({ payment, index }) => (
    <Card sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main', mb: 0.5 }}>
              ₹{payment.amount?.toLocaleString() || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDate(payment.date)}
            </Typography>
          </Box>
          <Chip
            label={payment.paymentMode || 'Cash'}
            color={getPaymentModeColor(payment.paymentMode)}
            size="small"
            variant="outlined"
          />
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Student ID
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {payment.studentId || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Contact
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {payment.contact || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Receipt ID
            </Typography>
            <Typography variant="body2" color="text.secondary">
              #{payment.id || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Student Name
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {payment.studentName || 'N/A'}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
        }
      }}
    >
      <DialogTitle sx={{ pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: 2, 
            bgcolor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.200'
          }}>
            <HistoryIcon color="primary" />
          </Box>
          <Box>
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 600 }}>
              Payment History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {student?.name} (Seat: {student?.seatNumber})
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 6 
          }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Loading payment history...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              borderRadius: 2,
              '& .MuiAlert-message': {
                fontWeight: 500
              }
            }}
          >
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <>
            {/* Summary Card */}
            <Paper sx={{ 
              p: isMobile ? 2 : 3, 
              mb: 3, 
              bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              background: 'linear-gradient(135deg, rgba(103, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              border: '1px solid', 
              borderColor: 'primary.200',
              borderRadius: 3
            }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 2 : 0
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'primary.main',
                    boxShadow: '0 4px 12px rgba(103, 126, 234, 0.3)'
                  }}>
                    <PaymentIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
                  </Box>
                  <Box>
                    <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5 }}>
                      ₹{totalPaid.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Amount Paid
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ 
                  textAlign: isMobile ? 'center' : 'right',
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: 'success.50',
                  border: '1px solid',
                  borderColor: 'success.200'
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main', mb: 0.5 }}>
                    {payments.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Payment{payments.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {payments.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <PaymentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No Payment History
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  No payments have been recorded for this student yet.
                </Typography>
              </Box>
            ) : isMobile ? (
              // Mobile Card View
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  Payment History ({payments.length} records)
                </Typography>
                {payments.map((payment, index) => (
                  <PaymentCard key={payment.id || index} payment={payment} index={index} />
                ))}
              </Box>
            ) : (
              // Desktop Table View
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.50' }}>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Student ID</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Contact Number</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Student Name</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Payment Mode</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Receipt ID</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((payment, index) => (
                      <TableRow 
                        key={payment.id || index}
                        sx={{ 
                          '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                          '&:hover': { bgcolor: 'action.selected' },
                          transition: 'background-color 0.2s ease'
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {formatDate(payment.date)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                            ₹{payment.amount?.toLocaleString() || 0}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {payment.studentId || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {payment.contact || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {payment.studentName || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={payment.paymentMode || 'Cash'}
                            color={getPaymentModeColor(payment.paymentMode)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            #{payment.id || 'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button 
          onClick={onClose} 
          size={isMobile ? "medium" : "large"}
          variant="outlined"
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 500,
            px: 3
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PaymentHistory;
