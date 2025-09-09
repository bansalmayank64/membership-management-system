import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { Man as ManIcon, Woman as WomanIcon, EventSeat as EventSeatIcon, Edit as EditIcon } from '@mui/icons-material';
import { formatDateForDisplay } from '../utils/dateUtils';

export default function StudentDetailsDialog({
  open,
  onClose,
  student,
  loading = false,
  error = null,
  totalPaid = 0,
  onEdit = null,
  onViewPayments = null
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Student Details - {student?.name || 'Unknown'}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !student ? (
          <Typography>No student data available</Typography>
        ) : (
          <Box sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Student ID</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>{student.id || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {student.sex === 'female' ?
                    <WomanIcon sx={{ color: 'secondary.main', fontSize: 18 }} /> :
                    <ManIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                  }
                  <Typography variant="body1">{student.name || 'N/A'}</Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Gender</Typography>
                <Typography variant="body1" sx={{ mb: 1, textTransform: 'capitalize' }}>
                  {student.sex || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Contact Number</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>{student.contact_number || 'N/A'}</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Aadhaar Number</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>{student.aadhaar_number || student.aadhaarNumber || 'N/A'}</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Father's Name</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>{student.father_name || 'N/A'}</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>{student.address || 'N/A'}</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Current Seat</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {student.seat_number ? (
                    <>
                      <EventSeatIcon sx={{ color: 'success.main', fontSize: 18 }} />
                      <Typography variant="body1">#{student.seat_number}</Typography>
                    </>
                  ) : (
                    <Typography variant="body1" color="text.secondary">Unassigned</Typography>
                  )}
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Chip
                  label={student.seat_number ? 'Assigned' : 'Unassigned'}
                  color={student.seat_number ? 'success' : 'error'}
                  size="small"
                  sx={{ mb: 1 }}
                />
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Date Joined</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {formatDateForDisplay(student.membership_date)}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Membership Till</Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {formatDateForDisplay(student.membership_till)}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Membership Type</Typography>
                <Typography variant="body1" sx={{ mb: 1, textTransform: 'capitalize' }}>
                  {((student.membership_type || student.membershipType) || 'N/A').toString().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Total Paid</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      color: 'success.main',
                      cursor: onViewPayments ? 'pointer' : 'default',
                      textDecoration: onViewPayments ? 'underline' : 'none'
                    }}
                    onClick={() => { if (onViewPayments) onViewPayments(student); }}
                  >
                    ₹{Number(totalPaid || 0).toLocaleString()}
                  </Typography>
                </Box>
              </Grid>

            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {student?.membership_status !== 'inactive' && onEdit && (
          <Button variant="contained" onClick={() => onEdit(student)} startIcon={<EditIcon />}>Edit Student</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
