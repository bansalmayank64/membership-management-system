import React, { useState, useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, Box, Typography, TextField, Divider, Chip, MenuItem, Select, FormControl, InputLabel, FormHelperText } from '@mui/material';

// Reusable duration filter dialog
export default function DurationFilter({ open, onClose, onApply, initialStart, initialEnd }) {
  const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const pad = (n) => String(n).padStart(2, '0');

  const monthLabel = (ym) => {
    // ym: 'YYYY-MM'
    try {
      const [y, m] = ym.split('-');
      const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
      return date.toLocaleString('en-US', { month: 'short' }) + `-${y}`;
    } catch (e) {
      return ym;
    }
  };

  const dayLabel = (ymd) => {
    try {
      const d = new Date(ymd);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return ymd;
    }
  };

  const ymdFromDate = (d) => {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  };

  const daysAgo = (n) => {
    const now = new Date();
    const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const then = new Date(utc - (n * 24 * 60 * 60 * 1000));
    return then.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  };

  const monthRange = (year, monthIndex) => {
    // monthIndex: 0-based
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0));
    return { start: ymdFromDate(start), end: ymdFromDate(end) };
  };

  const yearRange = (year) => ({ start: `${year}-01-01`, end: `${year}-12-31` });

  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [startDate, setStartDate] = useState(initialStart || '');
  const [endDate, setEndDate] = useState(initialEnd || '');
  const minYear = 2025;

  const applyQuick = (label, s, e) => {
    onApply && onApply({ label, startDate: s, endDate: e });
  };

  const applyCustomMonthRange = () => {
    if (!startMonth || !endMonth) return;
    const [sy, sm] = startMonth.split('-').map(Number);
    const [ey, em] = endMonth.split('-').map(Number);
    // Use first day of startMonth and last day of endMonth
    const s = `${sy}-${pad(sm)}-01`;
    const endMonthDays = new Date(ey, em, 0).getDate();
    const e = `${ey}-${pad(em)}-${pad(endMonthDays)}`;
    applyQuick(`${startMonth} → ${endMonth}`, s, e);
  };

  const monthRangeInvalid = () => {
    if (!startMonth || !endMonth) return false;
    const [sy, sm] = startMonth.split('-').map(Number);
    const [ey, em] = endMonth.split('-').map(Number);
    if (sy > ey) return true;
    if (sy === ey && sm > em) return true;
    return false;
  };

  const applyCustomDateRange = () => {
    if (!startDate || !endDate) return;
    applyQuick(`${startDate} → ${endDate}`, startDate, endDate);
  };

  const dateRangeInvalid = () => {
    if (!startDate || !endDate) return false;
    return new Date(startDate) > new Date(endDate);
  };

  // (year range UI removed per request)

  // derived flags to control UI state
  const hasMonthSelection = Boolean(startMonth || endMonth);
  const hasDateSelection = Boolean(startDate || endDate);
  // include initial props — if parent passed an initial filter, treat as active
  const hasInitial = Boolean(initialStart || initialEnd);
  const hasActiveFilter = hasInitial || hasMonthSelection || hasDateSelection;

  const clear = () => {
    setStartMonth(''); setEndMonth(''); setStartDate(''); setEndDate('');
    // Do not set a visible label when clearing — parent will interpret empty label as no active duration
    onApply && onApply({ label: '', startDate: '', endDate: '' });
  };

  // Quick presets: current month, previous month, two months ago, last 7 days, this year, last year
  const nowYmd = todayIST();
  const [yyyy, mm, dd] = nowYmd.split('-').map(Number);
  const currentMonth = monthRange(yyyy, mm - 1);
  const prevMonth = monthRange(yyyy, mm - 2 >= 0 ? mm - 2 : 11 + (mm - 1 < 0 ? -1 : 0));
  // better compute previous month accurately
  const prevDate = new Date(Date.UTC(yyyy, mm - 1 - 1, 1));
  const prevMonthObj = monthRange(prevDate.getUTCFullYear(), prevDate.getUTCMonth());
  const twoAgoDate = new Date(Date.UTC(yyyy, mm - 1 - 2, 1));
  const twoAgoMonthObj = monthRange(twoAgoDate.getUTCFullYear(), twoAgoDate.getUTCMonth());

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Choose Duration</DialogTitle>
      <DialogContent sx={{ py: 1 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Quick filters</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            <Chip size="small" variant="outlined" label={monthLabel(currentMonth.start.slice(0,7))} onClick={() => applyQuick(monthLabel(currentMonth.start.slice(0,7)), currentMonth.start, currentMonth.end)} clickable disabled={hasActiveFilter} />
            <Chip size="small" variant="outlined" label={monthLabel(prevMonthObj.start.slice(0,7))} onClick={() => applyQuick(monthLabel(prevMonthObj.start.slice(0,7)), prevMonthObj.start, prevMonthObj.end)} clickable disabled={hasActiveFilter} />
            <Chip size="small" variant="outlined" label={monthLabel(twoAgoMonthObj.start.slice(0,7))} onClick={() => applyQuick(monthLabel(twoAgoMonthObj.start.slice(0,7)), twoAgoMonthObj.start, twoAgoMonthObj.end)} clickable disabled={hasActiveFilter} />
            <Chip size="small" variant="outlined" label={`${yyyy}`} onClick={() => applyQuick(`${yyyy}`, `${yyyy}-01-01`, `${yyyy}-12-31`)} clickable disabled={hasActiveFilter} />
            <Chip size="small" variant="outlined" label={`${yyyy - 1}`} onClick={() => applyQuick(`${yyyy - 1}`, `${yyyy - 1}-01-01`, `${yyyy - 1}-12-31`)} clickable disabled={hasActiveFilter} />
          </Box>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Custom month range</Typography>
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                size="small"
                label="Start month"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: `${minYear}-01` }}
                disabled={hasActiveFilter && !hasMonthSelection}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                size="small"
                label="End month"
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: `${minYear}-01` }}
                disabled={hasActiveFilter && !hasMonthSelection}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="contained" onClick={applyCustomMonthRange} disabled={(hasActiveFilter && !hasMonthSelection) || monthRangeInvalid() || !startMonth || !endMonth}>Apply</Button>
                {monthRangeInvalid() && <Typography color="error" variant="caption">Start month must be before or equal to end month</Typography>}
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Custom date range</Typography>
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField size="small" label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} inputProps={{ min: `${minYear}-01-01` }} disabled={hasActiveFilter && !hasDateSelection} />
            </Grid>
            <Grid item xs={6}>
              <TextField size="small" label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} inputProps={{ min: `${minYear}-01-01` }} disabled={hasActiveFilter && !hasDateSelection} />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button size="small" variant="contained" onClick={applyCustomDateRange} disabled={(hasActiveFilter && !hasDateSelection) || dateRangeInvalid() || !startDate || !endDate}>Apply</Button>
                {dateRangeInvalid() && <Typography color="error" variant="caption">Start date must be before or equal to end date</Typography>}
              </Box>
            </Grid>
          </Grid>
        </Box>

        
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1 }}>
        {hasActiveFilter && <Button size="small" onClick={clear}>Clear</Button>}
        <Button size="small" onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
