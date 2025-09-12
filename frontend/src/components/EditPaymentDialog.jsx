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
  useTheme
} from '@mui/material';
import { Autocomplete } from '@mui/material';
import { CalendarToday as CalendarTodayIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { todayInIST, isoToISTDateInput } from '../utils/dateUtils';

const EditPaymentDialog = ({
  open,
  onClose,
  onSubmit,
  // existing payment to edit
  payment = null,
  // For Payments.jsx (student selection required)
  students = [],
  onStudentSelect = null,
  selectedStudentId = '',
  // fee/membership info
  feeConfig = null,
  membershipExtensionDays = 0,
  // loading state
  loading = false,
  isMobile = false,
}) => {
  const theme = useTheme();
  const { user } = useAuth();

  const defaultPaymentData = {
    amount: '',
    method: 'cash',
    type: 'monthly_fee',
    date: todayInIST(),
    notes: ''
  };

  // Local editable copy initialised from payment prop
  const [local, setLocal] = useState(defaultPaymentData);
  // Keep original values so we can detect changes (dirty state)
  const [originalLocal, setOriginalLocal] = useState(null);

  useEffect(() => {
    if (payment) {
      setLocal({
        amount: payment.amount != null ? String(Math.abs(Number(payment.amount))) : '',
        method: payment.payment_mode || payment.method || 'cash',
        type: payment.payment_type || payment.type || 'monthly_fee',
  date: payment.payment_date ? isoToISTDateInput(payment.payment_date) : (payment.date || todayInIST()),
        notes: payment.remarks || payment.notes || ''
      });
      // store original snapshot for change detection
      setOriginalLocal({
        amount: payment.amount != null ? String(Math.abs(Number(payment.amount))) : '',
        method: payment.payment_mode || payment.method || 'cash',
        type: payment.payment_type || payment.type || 'monthly_fee',
  date: payment.payment_date ? isoToISTDateInput(payment.payment_date) : (payment.date || todayInIST()),
        notes: payment.remarks || payment.notes || ''
      });
    } else {
      setLocal(defaultPaymentData);
      setOriginalLocal(defaultPaymentData);
    }
  }, [payment]);

  const handleChange = useCallback((field, value) => {
    setLocal(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = () => {
    if (onSubmit && payment) {
      onSubmit({ ...local, student_id: selectedStudentId || payment.student_id });
    }
  };

  const getTitle = () => {
    if (payment) return `Edit Payment - ${payment.student_name || payment.student_id || ''}`;
    return 'Edit Payment';
  };

  const isFreeMembershipStudent = feeConfig && (parseFloat(feeConfig.monthly_fees) <= 0);

  const isFormValid = () => {
    const hasStudent = selectedStudentId || (payment && payment.student_id);
    const hasAmount = local.amount && !isNaN(local.amount) && parseFloat(local.amount) > 0;
    const hasMethod = local.method;
    const hasType = local.type;
    const hasDate = local.date;
    return hasStudent && hasAmount && hasMethod && hasType && hasDate;
  };

  // Determine whether any editable field changed compared to the original snapshot
  const isDirty = (() => {
    // If we haven't captured the original snapshot yet, assume not dirty to avoid false enables
    if (!originalLocal) return false;
    // When editing an existing payment, student is read-only — compare editable fields only
    const fieldsToCompare = payment ? ['method', 'date', 'notes'] : ['amount', 'method', 'type', 'date', 'notes'];
    for (const f of fieldsToCompare) {
      const origRaw = originalLocal[f] === undefined || originalLocal[f] === null ? '' : originalLocal[f];
      const curRaw = local[f] === undefined || local[f] === null ? '' : local[f];
      const orig = String(origRaw).trim();
      const cur = String(curRaw).trim();
      if (orig !== cur) return true;
    }
    // For new payments (no payment prop) also consider student selection as a change
    if (!payment) {
      const origStudent = '';
      const curStudent = selectedStudentId || '';
      if (origStudent !== String(curStudent)) return true;
    }
    return false;
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      fullScreen={isMobile}
    >
      <DialogTitle>{getTitle()}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Student info - when editing an existing payment show read-only student data */}
          {payment ? (
            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Student</Typography>
              <Typography variant="body2">
                {payment.student_name || 'N/A'} {payment.student_id ? `(#${payment.student_id})` : ''}
              </Typography>
              {payment.seat_number && (
                <Typography variant="caption" color="text.secondary">Seat: 🪑{payment.seat_number}</Typography>
              )}
            </Box>
          ) : (students && students.length > 0 && (
            <FormControl fullWidth>
              <Autocomplete
                options={students.filter(s => s && s.id)}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const seatPart = option.seat_number ? ` • 🪑${option.seat_number}` : '';
                  return `${option.name || ''}${seatPart} (${option.id || ''})`;
                }}
                value={students.find(s => s.id === (selectedStudentId || (payment && payment.student_id))) || null}
                onChange={(e, v) => { if (onStudentSelect) onStudentSelect(v ? v.id : ''); }}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{option.name}</Typography>
                        {option.seat_number && (<Typography variant="caption" color="text.secondary">🪑{option.seat_number}</Typography>)}
                        <Typography variant="caption" color="text.secondary">#{option.id}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" noWrap>{option.contact_number || 'No contact'} · {option.father_name || 'No father name'}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (<TextField {...params} label="Select Student" placeholder="Search by name, ID or seat" />)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                clearOnEscape
                fullWidth
              />
            </FormControl>
          ))}

          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={local.amount}
            onChange={(e) => handleChange('amount', e.target.value)}
            disabled={true}
            InputProps={{ readOnly: true }}
            helperText="Amount cannot be edited"
          />

          <FormControl fullWidth disabled={isFreeMembershipStudent}>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={local.method}
              onChange={(e) => handleChange('method', e.target.value)}
              label="Payment Method"
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="online">Online</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={true}>
            <InputLabel>Payment Type</InputLabel>
            <Select
              value={local.type}
              onChange={(e) => handleChange('type', e.target.value)}
              label="Payment Type"
            >
              <MenuItem value="monthly_fee">Monthly Fee</MenuItem>
              <MenuItem value="refund">Refund</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Date"
            type="date"
            value={local.date}
            onChange={(e) => handleChange('date', e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={isFreeMembershipStudent}
          />

          <TextField
            fullWidth
            label="Notes (Optional)"
            multiline
            rows={3}
            value={local.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            disabled={isFreeMembershipStudent}
          />

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!isFormValid() || loading || isFreeMembershipStudent || !isDirty}
          startIcon={<CalendarTodayIcon />}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditPaymentDialog;
