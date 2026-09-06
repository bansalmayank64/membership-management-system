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
  Divider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material';
import { formatDateForDisplay } from '../utils/dateUtils';

const RISK_COLOR = {
  Trusted:   'success',
  Reliable:  'info',
  Average:   'warning',
  Watchlist: 'warning',
  Defaulter: 'error',
};

const RISK_BG = {
  Trusted:   '#e8f5e9',
  Reliable:  '#e3f2fd',
  Average:   '#fff8e1',
  Watchlist: '#fff3e0',
  Defaulter: '#ffebee',
};

const RISK_TEXT = {
  Trusted:   '#2e7d32',
  Reliable:  '#1565c0',
  Average:   '#f57f17',
  Watchlist: '#e65100',
  Defaulter: '#c62828',
};


function MetricRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}

export default function BpssDetailDialog({ open, onClose, bpss }) {
  if (!bpss || bpss.scoreStatus === 'FREE_MEMBER' || bpss.scoreStatus === 'NEW_MEMBER') return null;

  const { score, riskLevel, scoreStatus, metrics, justification, paymentHistory, gracePeriodDays, confidencePct = 0, rawScore } = bpss;

  const isNoData = scoreStatus === 'NO_DATA';
  const riskColor = RISK_COLOR[riskLevel] || 'default';
  const bgColor  = RISK_BG[riskLevel]    || '#f5f5f5';
  const txtColor = RISK_TEXT[riskLevel]  || '#333';

  const statusLabel = (s) => {
    if (s === 'on_time')        return { label: 'On Time',       color: 'success' };
    if (s === 'late')           return { label: 'Late',          color: 'error'   };
    if (s === 'inactive_return') return { label: 'Return',       color: 'default' };
    return                              { label: s,              color: 'default' };
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        Payment Behaviour Score (PBS) — {bpss.studentName}
      </DialogTitle>

      <DialogContent dividers>

        {/* ── Score header ─────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 3,
            p: 2, mb: 2, borderRadius: 2,
            backgroundColor: bgColor,
          }}
        >
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, color: txtColor, lineHeight: 1 }}>
              {score}
            </Typography>
            <Typography variant="caption" color="text.secondary">/ 100</Typography>
          </Box>

          <Box>
            <Chip
              label={riskLevel}
              color={riskColor}
              size="medium"
              sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}
            />
            {isNoData && (
              <Chip
                label="NO DATA"
                variant="outlined"
                size="small"
                sx={{ ml: 1, mb: 0.5 }}
              />
            )}
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {isNoData
                ? 'No applicable payment cycles in the last 12 months.'
                : justification}
            </Typography>
          </Box>
        </Box>

        {isNoData ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            This student has no applicable monthly payment cycles in the last 12 months.
            PBS defaults to 100 and does not reflect actual payment behavior.
          </Alert>
        ) : (
          <Grid container spacing={2}>

            {/* ── Score summary + confidence ─────────────── */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Score Summary
                </Typography>
                <MetricRow label="Fault rate"            value={`${metrics.latePercentage.toFixed(1)}%`} />
                <MetricRow label="Score (unadjusted)"    value={rawScore != null ? Math.round(rawScore) : '—'} />
                <MetricRow label="Final score"           value={score} />
                <Divider sx={{ my: 1 }} />
                {/* Confidence: how much of a full year's data is available */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">History tracked</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {metrics.totalApplicableCycles} of 12 months
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(confidencePct, 100)}
                    color={confidencePct >= 100 ? 'success' : 'warning'}
                    sx={{ height: 7, borderRadius: 4 }}
                  />
                  {confidencePct < 100 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Score is partially adjusted — more data builds a more accurate rating
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* ── Behavior metrics ───────────────────────── */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Payment Behaviour
                </Typography>
                <MetricRow label="Total applicable cycles" value={metrics.totalApplicableCycles} />
                <MetricRow label="On-time cycles"          value={metrics.onTimeCycles} />
                <MetricRow label="Late cycles"             value={metrics.lateCycles} />
                <MetricRow label="Late percentage"         value={`${metrics.latePercentage.toFixed(1)}%`} />
                <Divider sx={{ my: 1 }} />
                <MetricRow label="Average delay"           value={`${Math.round(metrics.averageDelayDays)} days`} />
                <MetricRow label="Maximum delay"           value={`${metrics.maximumDelayDays} days`} />
                <MetricRow label="Current late streak"     value={`${metrics.currentConsecutiveLateCycles} cycles`} />
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, mt: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Recent Behavior (late %)
                </Typography>
                <MetricRow label="Last 3 months"   value={`${metrics.recent3MonthLatePercentage.toFixed(1)}%`} />
                <MetricRow label="Months 4 – 6"    value={`${metrics.recent4To6MonthLatePercentage.toFixed(1)}%`} />
                <MetricRow label="Months 7 – 12"   value={`${metrics.recent7To12MonthLatePercentage.toFixed(1)}%`} />
              </Paper>
            </Grid>

            {/* ── Payment history table ───────────────────── */}
            {paymentHistory && paymentHistory.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Payment History (last 12 months)
                </Typography>
                {/* Desktop table */}
                <Paper variant="outlined" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.100' }}>
                        <TableCell>Due Date</TableCell>
                        <TableCell>Payment Date</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Delay (days)</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paymentHistory.map((row) => {
                        const { label, color } = statusLabel(row.paymentStatus);
                        return (
                          <TableRow key={row.id} hover>
                            <TableCell>{formatDateForDisplay(row.dueDate)}</TableCell>
                            <TableCell>{formatDateForDisplay(row.paymentDate)}</TableCell>
                            <TableCell align="right">₹{Number(row.amount).toLocaleString()}</TableCell>
                            <TableCell align="right">
                              {row.paymentStatus === 'inactive_return' ? '—' : row.delayDays}
                            </TableCell>
                            <TableCell>
                              <Chip label={label} color={color} size="small" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>

                {/* Mobile cards */}
                <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1 }}>
                  {paymentHistory.map((row) => {
                    const { label, color } = statusLabel(row.paymentStatus);
                    return (
                      <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            ₹{Number(row.amount).toLocaleString()}
                          </Typography>
                          <Chip label={label} color={color} size="small" />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            Paid: {formatDateForDisplay(row.paymentDate)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Due: {formatDateForDisplay(row.dueDate)}
                          </Typography>
                        </Box>
                        {row.paymentStatus !== 'inactive_return' && row.delayDays > 0 && (
                          <Typography variant="caption" color="error.main">
                            {row.delayDays} day{row.delayDays !== 1 ? 's' : ''} late
                          </Typography>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Payments within {gracePeriodDays} days of due date are scored as on-time
                </Typography>
              </Grid>
            )}

          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
