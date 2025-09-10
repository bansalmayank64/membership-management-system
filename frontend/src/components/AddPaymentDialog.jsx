import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Box,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Autocomplete } from '@mui/material';
import { CalendarToday as CalendarTodayIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { todayInIST } from '../utils/dateUtils';

const AddPaymentDialog = ({
  open,
  onClose,
  onSubmit,
  // For Students.jsx (pre-selected student)
  selectedStudent = null,
  // For Payments.jsx (student selection required)
  students = [],
  onStudentSelect = null,
  selectedStudentId = '',
  // Common payment data
  paymentData,
  setPaymentData,
  // Optional specialized amount change handler (Payments tab needs to recalc extension days)
  onAmountChange = null,
  // Fee configuration and membership extension
  feeConfig,
  membershipExtensionDays,
  // Loading and UI state
  loading = false,
  isMobile = false
}) => {
  const theme = useTheme();
  const { user } = useAuth();

  // Initialize payment data with defaults if not provided
  const defaultPaymentData = {
    amount: '',
    method: 'cash',
    type: 'monthly_fee',
    date: todayInIST(),
    notes: ''
  };

  const currentPaymentData = paymentData || defaultPaymentData;

  // Handle student selection (for Payments.jsx)
  const handleStudentChange = (event, value) => {
    if (onStudentSelect) {
      onStudentSelect(value ? value.id : '');
    }
  };

  // Handle payment data changes
  const handlePaymentDataChange = useCallback((field, value) => {
    if (setPaymentData) {
      setPaymentData(prev => ({ ...prev, [field]: value }));
    }
  }, [setPaymentData]);

  // Check if this is for free membership student
  const isFreeMembershipStudent = feeConfig && (parseFloat(feeConfig.monthly_fees) <= 0);
  const showFreeMembershipWarning = isFreeMembershipStudent; // Show warning for any payment type when fee is 0

  // Removed auto-switch logic: keep user-selected payment type even when monthly fee is 0
  // (Requirement: when monthly fees is 0 do NOT change the payment type to refund)

  // Get dialog title
  const getDialogTitle = () => {
    if (selectedStudent) {
      return `Add/Refund Payment - ${selectedStudent.name}`;
    }
    return 'Add/Refund Payment';
  };

  // Check if form is valid
  const isFormValid = () => {
    const hasStudent = selectedStudent || selectedStudentId;
    const hasAmount = currentPaymentData.amount && !isNaN(currentPaymentData.amount) && parseFloat(currentPaymentData.amount) > 0;
    const hasMethod = currentPaymentData.method;
    const hasType = currentPaymentData.type;
    const hasDate = currentPaymentData.date;
    
    return hasStudent && hasAmount && hasMethod && hasType && hasDate;
  };

  // Handle submit
  const handleSubmit = (extendMembership = false) => {
    if (onSubmit) {
      onSubmit(extendMembership);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth 
      scroll="paper" 
      fullScreen={isMobile}
    >
      <DialogTitle>{getDialogTitle()}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Student selector - only show for Payments.jsx */}
          {!selectedStudent && students.length > 0 && (
            <FormControl fullWidth>
              <Autocomplete
                options={students.filter(s => s && s.id)}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const seatPart = option.seat_number ? ` • 🪑${option.seat_number}` : '';
                  return `${option.name || ''}${seatPart} (${option.id || ''})`;
                }}
                value={students.find(s => s.id === selectedStudentId) || null}
                onChange={handleStudentChange}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                          {option.name}
                        </Typography>
                        {option.seat_number && (
                          <Typography variant="caption" color="text.secondary">
                            🪑{option.seat_number}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          #{option.id}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {option.contact_number || 'No contact'} · {option.father_name || 'No father name'}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Select Student" placeholder="Search by name, ID or seat" />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                clearOnEscape
                fullWidth
              />
            </FormControl>
          )}

          {/* Free membership warning - show prominently at the top if student has free membership */}
          {isFreeMembershipStudent && (
            <Box sx={{
              p: 1,
              bgcolor: 'error.light',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'error.main',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              maxWidth: 420
            }}>
              <Typography variant="body2" sx={{ fontSize: '1.25rem', lineHeight: 1 }}>🚫</Typography>
              <Box>
                <Typography variant="subtitle2" sx={{ color: 'error.contrastText', fontWeight: 700 }}>
                  Payments not available
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: (theme) => theme.palette.error.contrastText, opacity: 0.9 }}>
                  Free membership — payments are disabled
                </Typography>
              </Box>
            </Box>
          )}

          {/* Amount field */}
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={currentPaymentData.amount}
            onChange={(e) => {
              const val = e.target.value;
              if (onAmountChange) {
                onAmountChange(val);
              } else {
                handlePaymentDataChange('amount', val);
              }
            }}
            disabled={isFreeMembershipStudent}
            helperText={isFreeMembershipStudent ? 'Payments disabled for free membership students' : ''}
          />

          {/* Payment method */}
          <FormControl fullWidth disabled={isFreeMembershipStudent}>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={currentPaymentData.method}
              onChange={(e) => handlePaymentDataChange('method', e.target.value)}
              label="Payment Method"
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="online">Online</MenuItem>
            </Select>
          </FormControl>

          {/* Payment type */}
          <FormControl fullWidth disabled={isFreeMembershipStudent}>
            <InputLabel>Payment Type</InputLabel>
            <Select
              value={currentPaymentData.type}
              onChange={(e) => handlePaymentDataChange('type', e.target.value)}
              label="Payment Type"
            >
              <MenuItem value="monthly_fee">Monthly Fee</MenuItem>
              <MenuItem value="refund">Refund</MenuItem>
            </Select>
          </FormControl>

          {/* Payment date */}
          <TextField
            fullWidth
            label="Date"
            type="date"
            value={currentPaymentData.date}
            onChange={(e) => handlePaymentDataChange('date', e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={isFreeMembershipStudent}
          />

          {/* Notes field */}
          <TextField
            fullWidth
            label="Notes (Optional)"
            multiline
            rows={3}
            value={currentPaymentData.notes}
            onChange={(e) => handlePaymentDataChange('notes', e.target.value)}
            disabled={isFreeMembershipStudent}
          />

          {/* Fee configuration info for monthly fee */}
          {feeConfig && currentPaymentData.type === 'monthly_fee' && !isFreeMembershipStudent && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'info.light', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'info.main'
            }}>
              <Typography variant="body2" color="info.contrastText" sx={{ fontWeight: 'medium' }}>
                📅 Membership Extension Available
              </Typography>
              <Typography variant="body2" color="info.contrastText">
                Membership: {feeConfig.membership_type || selectedStudent?.membership_type} • Monthly Fee: ₹{feeConfig.monthly_fees} ({selectedStudent?.sex || 'N/A'})
              </Typography>
              <Typography variant="body2" color="info.contrastText">
                Extension Days: {membershipExtensionDays} days
              </Typography>
            </Box>
          )}

          {/* Free membership info display */}
          {feeConfig && isFreeMembershipStudent && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'success.light', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'success.main'
            }}>
              <Typography variant="body2" color="success.dark" sx={{ fontWeight: 'medium' }}>
                🆓 Free Membership Student
              </Typography>
              <Typography variant="body2" color="success.dark">
                Membership: {feeConfig.membership_type || selectedStudent?.membership_type} • Monthly Fee: ₹0 ({selectedStudent?.sex || 'N/A'})
              </Typography>
              <Typography variant="body2" color="success.dark">
                This student enjoys free membership benefits!
              </Typography>
            </Box>
          )}

          {/* Fee configuration info for refund */}
          {feeConfig && currentPaymentData.type === 'refund' && membershipExtensionDays > 0 && !isFreeMembershipStudent && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'error.light', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'error.main'
            }}>
              <Typography variant="body2" color="error.contrastText" sx={{ fontWeight: 'medium' }}>
                ⚠️ Membership Reduction Warning
              </Typography>
              <Typography variant="body2" color="error.contrastText">
                Membership: {feeConfig.membership_type || selectedStudent?.membership_type} • Monthly Fee: ₹{feeConfig.monthly_fees} ({selectedStudent?.sex || 'N/A'})
              </Typography>
              <Typography variant="body2" color="error.contrastText">
                Reduction Days: {membershipExtensionDays} days
              </Typography>
              <Typography variant="body2" color="error.contrastText" sx={{ mt: 1 }}>
                This refund will reduce the student's membership by {membershipExtensionDays} days if applied.
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        
        {user && user.role === 'admin' && (
          <Button 
            variant="contained" 
            onClick={() => handleSubmit(false)}
            disabled={!isFormValid() || loading || showFreeMembershipWarning}
          >
            {currentPaymentData.type === 'refund' 
              ? 'Refund Payment' 
              : (loading ? 'Adding...' : 'Add Payment')}
          </Button>
        )}

        {/* Extend / Reduce button - only show when fee config is available and there are extension days */}
        {user && feeConfig && membershipExtensionDays > 0 && (
          <Button 
            variant="contained" 
            onClick={() => handleSubmit(true)}
            disabled={!isFormValid() || loading || showFreeMembershipWarning}
            startIcon={<CalendarTodayIcon />}
          >
            {currentPaymentData.type === 'refund'
              ? `Refund Payment & Reduce ${membershipExtensionDays} Days`
              : `Add Payment & Extend ${membershipExtensionDays} Days`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AddPaymentDialog;
