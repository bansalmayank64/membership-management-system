import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, IconButton, Card, CardContent, Chip, useMediaQuery, Stack, TablePagination } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';
import { useTheme } from '@mui/material/styles';

// simple debounce helper
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function chipForType(t) {
  const tt = (t || '').toString().toLowerCase();
  let color = 'default';
  if (tt === 'payment') color = 'success';
  else if (tt === 'expense') color = 'warning';
  else if (tt === 'student') color = 'info';
  else if (tt === 'seat') color = 'secondary';
  else if (tt === 'activity' || tt === 'login' || tt === 'auth') color = 'primary';
  return { label: t || '', color };
}

// Convert timestamp (assumed GMT/UTC) to IST and format
function formatToIST(ts) {
  if (!ts) return '';
  try {
    // Convert GMT to IST first (add 5.5 hours)
    const gmtDate = new Date(ts);
    const istDate = new Date(gmtDate.getTime() + (5.5 * 60 * 60 * 1000));
    const formatter = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return formatter.format(istDate);
  } catch (e) {
    return String(ts);
  }
}

// Convert timestamp (any parseable input) to a GMT/UTC plain string
// Example output: 2025-09-01 13:40:15.961157
function convertToGMT(ts) {
  if (!ts && ts !== 0) return '';
  try {
    // If input is a number (epoch ms), use Date directly
    if (typeof ts === 'number') {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return String(ts);
      const Y = d.getUTCFullYear();
      const M = String(d.getUTCMonth() + 1).padStart(2, '0');
      const D = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');
      const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
      return `${Y}-${M}-${D} ${hh}:${mm}:${ss}.${ms}000`;
    }

    // If input is an ISO string, try to preserve fractional seconds up to 6 digits
    if (typeof ts === 'string') {
      // Regex extracts date/time, fractional part (if any) and timezone
      const isoRegex = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/;
      const m = ts.match(isoRegex);
      const d = new Date(ts); // Date will handle timezone offsets and give UTC components
      if (Number.isNaN(d.getTime())) return String(ts);

      const Y = d.getUTCFullYear();
      const M = String(d.getUTCMonth() + 1).padStart(2, '0');
      const D = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');

      let micros;
      if (m && m[5]) {
        // fractional part present in input; normalize to 6 digits (microseconds)
        let frac = m[5].slice(0, 6); // truncate to 6 if longer
        frac = frac.padEnd(6, '0'); // pad to 6 if shorter
        micros = frac;
      } else {
        // No fractional part in input; use milliseconds from Date and append 3 zeros
        const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
        micros = ms + '000';
      }

      return `${Y}-${M}-${D} ${hh}:${mm}:${ss}.${micros}`;
    }

    // Fallback: try Date for other types
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
    return `${Y}-${M}-${D} ${hh}:${mm}:${ss}.${ms}000`;
  } catch (e) {
    return String(ts);
  }
}

export default function UserActivity({ activities = [], loading }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 15 : 25);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const r = parseInt(event.target.value, 10);
    setRowsPerPage(r);
    setPage(0);
  };

  // sorting latest-first
  const sorted = [...(activities || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const total = sorted.length;
  const displayed = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      {/* Responsive: table on wide screens, compact cards on small screens */}
      <ResponsiveActivityList
        activities={displayed}
        totalCount={total}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        isMobile={isMobile}
      />
    </Box>
  );
}

function UpdateDiff({ details, subjectType, subjectId, timestamp }) {
  const [prev, setPrev] = useState(null);
  const [diff, setDiff] = useState(null);
  const [fetchedPrev, setFetchedPrev] = useState(false);
  const [prevError, setPrevError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = `/api/admin/activity/previous?subjectType=${encodeURIComponent(subjectType)}&subjectId=${encodeURIComponent(subjectId)}&before=${encodeURIComponent(timestamp)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
        if (!resp.ok) {
          const text = await resp.text().catch(() => null);
          setPrevError(text || `Status ${resp.status}`);
          setFetchedPrev(true);
          return;
        }
        const j = await resp.json();
        if (!mounted) return;
        setPrev(j.previous || null);
        setFetchedPrev(true);
      } catch (err) {
        setPrevError(err.message || String(err));
        setFetchedPrev(true);
      }
    })();
    return () => { mounted = false; };
  }, [subjectType, subjectId, timestamp]);

  useEffect(() => {
    if (!prev || !details) return;
    try {
      // Normalize previous row keys to the same keys used in activity.details
      // so we compare like-for-like. Currently activity.details for students
      // uses keys: name, aadhaar, contact, seat. DB history rows use
      // aadhaar_number, contact_number, seat_number.
      const normalizePrev = (prevRow, detailsObj, subjectType) => {
        if (!prevRow) return {};
        const out = {};
        const keys = Object.keys(detailsObj || {});
        const t = (subjectType || '').toString().toLowerCase();
        keys.forEach(k => {
          if (t === 'student') {
            if (k === 'aadhaar') out.aadhaar = prevRow.aadhaar_number ?? prevRow.aadhaar ?? undefined;
            else if (k === 'contact') out.contact = prevRow.contact_number ?? prevRow.contact ?? undefined;
            else if (k === 'seat') out.seat = prevRow.seat_number ?? prevRow.seat ?? null;
            else out[k] = prevRow[k];
          } else {
            // generic fallback: prefer direct property, then snake_case variants
            out[k] = prevRow[k] ?? prevRow[`${k}_number`] ?? prevRow[`${k}_id`] ?? prevRow[`${k}_at`] ?? prevRow[`${k}_date`];
          }
        });
        return out;
      };

      const d1 = normalizePrev(prev, details, subjectType);
      const d2 = details || {};
      const changed = {};
      // compare shallow fields
      Object.keys(d2).forEach(k => {
        const v1 = d1[k];
        const v2 = d2[k];
        // stringify for safe comparison of objects/numbers
        if (JSON.stringify(v1) !== JSON.stringify(v2)) changed[k] = { from: v1, to: v2 };
      });
      setDiff(changed);
    } catch (err) {
      setDiff(null);
    }
  }, [prev, details]);

  // If previous not yet fetched, show current details and a small loading hint
  if (!fetchedPrev) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary">Loading previous record…</Typography>
        <pre style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0 0' }}>{JSON.stringify(details, null, 2)}</pre>
      </Box>
    );
  }

  // If fetched and no previous record exists, show a note plus current details
  if (fetchedPrev && !prev) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary">Previous record not found{prevError ? `: ${prevError}` : ''}</Typography>
        <pre style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0 0' }}>{JSON.stringify(details, null, 2)}</pre>
      </Box>
    );
  }

  // When we have a previous record, show both before/after and a concise diff
  return (
    <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
      {diff && Object.keys(diff).length > 0 ? (
        Object.entries(diff).map(([k, v]) => (
          <Box key={k} sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{k}:</Typography>
            <Typography variant="body2" color="text.secondary">From: {String(v.from)}</Typography>
            <Typography variant="body2" color="text.primary">To: {String(v.to)}</Typography>
          </Box>
        ))
      ) : (
        <Typography variant="caption" color="text.secondary">No visible field changes</Typography>
      )}
    </Box>
  );
}

function ResponsiveActivityList({ activities, totalCount = 0, page = 0, rowsPerPage = 25, onPageChange, onRowsPerPageChange, isMobile }) {
  const theme = useTheme();
  const small = useMediaQuery(theme.breakpoints.down('sm'));

  if (!activities || activities.length === 0) {
    return <Paper sx={{ p: 2 }}>No activities</Paper>;
  }

  // activities passed in should already be sorted and sliced (displayed page)
  const sorted = activities || [];

  if (small) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        {sorted.map((a, idx) => (
          <Card key={idx} variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" color="text.secondary">{formatToIST(a.timestamp)}</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{a.type || a.action_type} {a.details && a.details.amount ? `• ₹${a.details.amount}` : ''}</Typography>
                  <Typography variant="body2" color="text.secondary">{a.subjectType || a.subject_type} {a.subjectId || a.subject_id ? `• id:${a.subjectId || a.subject_id}` : ''}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  {(() => {
                    const t = (a.type || a.action_type || '');
                    const p = chipForType(t);
                    return <Chip label={p.label} size="small" color={p.color} />;
                  })()}
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>{a.actorUsername || a.userId || 'System'}</Typography>
                </Box>
              </Stack>
              <Box sx={{ mt: 1 }}>
                {/* For UPDATE actions show a concise diff: only changed fields */}
                {((a.type || a.action_type || '').toString().toUpperCase() === 'UPDATE') && (a.subjectType || a.subject_type) && (a.subjectId || a.subject_id) ? (
                  // Pass the original ISO8601 timestamp (UTC) to the API so Postgres parses it with timezone
                  <UpdateDiff details={a.details} subjectType={a.subjectType || a.subject_type} subjectId={a.subjectId || a.subject_id} timestamp={a.timestamp} />
                ) : (
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(a.details, null, 2)}</pre>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
        {/* Mobile Pagination */}
        <Paper sx={{ mt: 1 }}>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={onPageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={onRowsPerPageChange}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="Per page:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
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
    );
  }

  return (
    <TableContainer component={Paper} sx={{ maxHeight: '60vh' }}>
      <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 180 }}>Date & Time</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Actor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
                {sorted.map((a, idx) => (
              <TableRow key={idx} hover>
                <TableCell>{a.timestamp} {formatToIST(a.timestamp)} {a.timestamp}</TableCell>
                <TableCell>
                  {(() => {
                    const t = (a.type || a.action_type || '');
                    const p = chipForType(t);
                    return <Chip label={p.label || t} size="small" color={p.color} sx={{ textTransform: 'capitalize' }} />;
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const isUpdate = (a.type || a.action_type || '').toString().toUpperCase() === 'UPDATE';
                    const subjectType = a.subjectType || a.subject_type;
                    const subjectId = a.subjectId || a.subject_id;
                    if (isUpdate && subjectType && subjectId) {
                      return (
                        <UpdateDiff details={a.details} subjectType={subjectType} subjectId={subjectId} timestamp={a.timestamp} />
                      );
                    }
                    return <>{a.type || a.action_type} {a.details && a.details.amount ? `• ₹${a.details.amount}` : ''}</>;
                  })()}
                </TableCell>
                <TableCell>
                  {a.subjectType || a.subject_type} {a.subjectId || a.subject_id ? `#${a.subjectId || a.subject_id}` : ''}
                </TableCell>
                <TableCell>{a.actorUsername || a.userId || a.userName || 'System'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
  </Table>
        {/* Desktop Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
          labelRowsPerPage="Rows per page:"
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
    </TableContainer>
  );
}
