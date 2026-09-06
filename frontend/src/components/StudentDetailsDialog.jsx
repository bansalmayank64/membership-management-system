import React, { useState, useEffect } from 'react';
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
  Alert,
} from '@mui/material';
import { Man as ManIcon, Woman as WomanIcon, EventSeat as EventSeatIcon, Edit as EditIcon } from '@mui/icons-material';
import { formatDateForDisplay } from '../utils/dateUtils';
import { getStudentPbs } from '../services/api';
import BpssDetailDialog from './BpssDetailDialog';

const RISK_COLOR = {
  Trusted:   'success',
  Reliable:  'info',
  Average:   'warning',
  Watchlist: 'warning',
  Defaulter: 'error',
};

const RISK_TEXT = {
  Trusted:   '#2e7d32',
  Reliable:  '#1565c0',
  Average:   '#f57f17',
  Watchlist: '#e65100',
  Defaulter: '#c62828',
};

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
  const [pbs, setPbs] = useState(null);
  const [pbsLoading, setPbsLoading] = useState(false);
  const [pbsDetailOpen, setPbsDetailOpen] = useState(false);

  useEffect(() => {
    if (!open || !student?.id) { setPbs(null); return; }
    let cancelled = false;
    setPbsLoading(true);
    getStudentPbs(student.id)
      .then((data) => { if (!cancelled) setPbs(data); })
      .catch(() => { if (!cancelled) setPbs(null); })
      .finally(() => { if (!cancelled) setPbsLoading(false); });
    return () => { cancelled = true; };
  }, [open, student?.id]);

  const riskLevel   = pbs?.riskLevel   || 'Excellent';
  const scoreStatus = pbs?.scoreStatus || 'NO_DATA';
  const score       = pbs?.score       ?? 100;
  const riskColor   = RISK_COLOR[riskLevel] || 'default';
  const txtColor    = RISK_TEXT[riskLevel]  || '#333';

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Student Details - {student?.name || 'Unknown'}</DialogTitle>
        <DialogContent>
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress /></Box>
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
                    {student.sex === 'female'
                      ? <WomanIcon sx={{ color: 'secondary.main', fontSize: 18 }} />
                      : <ManIcon   sx={{ color: 'primary.main',   fontSize: 18 }} />}
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
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    {student.aadhaar_number || student.aadhaarNumber || 'N/A'}
                  </Typography>
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
                    {((student.membership_type || student.membershipType) || 'N/A')
                      .toString().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Typography>
                </Grid>

                {/* Total Paid and PBS score share the last row */}
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Total Paid</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        color: 'success.main',
                        cursor: onViewPayments ? 'pointer' : 'default',
                        textDecoration: onViewPayments ? 'underline' : 'none',
                      }}
                      onClick={() => { if (onViewPayments) onViewPayments(student); }}
                    >
                      ₹{Number(totalPaid || 0).toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>

                {/* PBS — compact, clickable, no separate row */}
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    PBS
                  </Typography>
                  {pbsLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <CircularProgress size={14} />
                      <Typography variant="caption" color="text.secondary">Loading…</Typography>
                    </Box>
                  ) : pbs?.scoreStatus === 'FREE_MEMBER' ? (
                    <Chip label="Free Member" variant="outlined" size="small" sx={{ mt: 0.5 }} />
                  ) : pbs?.scoreStatus === 'NEW_MEMBER' ? (
                    <Chip label="New Member" variant="outlined" color="info" size="small" sx={{ mt: 0.5 }} />
                  ) : pbs ? (
                    <Box
                      onClick={() => setPbsDetailOpen(true)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, mt: 0.5,
                        cursor: 'pointer',
                        width: 'fit-content',
                        '&:hover': { opacity: 0.75 },
                      }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 700, color: txtColor }}>
                        {score}
                      </Typography>
                      <Chip label={riskLevel} color={riskColor} size="small" sx={{ fontWeight: 600 }} />
                      {scoreStatus === 'NO_DATA' && (
                        <Chip label="NO DATA" variant="outlined" size="small" />
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>N/A</Typography>
                  )}
                </Grid>

              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          {student?.membership_status !== 'inactive' && onEdit && (
            <Button variant="contained" onClick={() => onEdit(student)} startIcon={<EditIcon />}>
              Edit Student
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <BpssDetailDialog
        open={pbsDetailOpen}
        onClose={() => setPbsDetailOpen(false)}
        bpss={pbs}
      />
    </>
  );
}
