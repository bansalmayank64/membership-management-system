import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, IconButton, Card, CardContent, Chip, useMediaQuery, Stack, TablePagination, Avatar } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';
import { formatDateTimeForDisplay } from '../utils/dateUtils';
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

function formatToIST (dateString) {
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

  // Render a details object in a readable key/value layout
  function PrettyDetails({ details }) {
    if (details === null || details === undefined) return <Typography variant="body2" color="text.secondary">No details</Typography>;

    const renderValue = (val) => {
      if (val === null || val === undefined) return <Typography component="span" color="text.secondary">—</Typography>;
      if (Array.isArray(val)) return (
        <Box>
          {val.map((v, i) => (
            <Typography key={i} variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Typography>
          ))}
        </Box>
      );
      if (typeof val === 'object') return (
        <Box sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'divider', ml: 0.5 }}>
          {Object.entries(val).map(([k, v]) => (
            <Box key={k} sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k}:</Typography>
              <Typography variant="body2">{v === null || v === undefined ? '—' : String(v)}</Typography>
            </Box>
          ))}
        </Box>
      );
      return <Typography variant="body2">{String(val)}</Typography>;
    };

    if (typeof details === 'string' || typeof details === 'number' || typeof details === 'boolean') {
      return <Typography variant="body2">{String(details)}</Typography>;
    }

    // details is an object
    const entries = Object.entries(details || {});
    if (entries.length === 0) return <Typography variant="body2" color="text.secondary">No details</Typography>;

    return (
      <Box sx={{ display: 'grid', gap: 1 }}>
        {entries.map(([k, v]) => (
          <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 700, textTransform: 'capitalize' }}>{k}</Typography>
            <Box sx={{ flex: 1 }}>{renderValue(v)}</Box>
          </Box>
        ))}
      </Box>
    );
  }

  if (!activities || activities.length === 0) {
    return <Paper sx={{ p: 2 }}>No activities</Paper>;
  }

  // activities passed in should already be sorted and sliced (displayed page)
  const sorted = activities || [];

  if (small) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        {sorted.map((a, idx) => {
          const t = (a.type || a.action_type || '');
          const p = chipForType(t);
          const borderColor = (theme.palette[p.color] && theme.palette[p.color].main) || theme.palette.primary.main;
          const actor = a.actorUsername || a.userName || a.userId || 'System';
          const initials = (actor || 'S').toString().split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();
          // Prefer explicit student name fields from payloads
          const studentName = a.details?.name || a.details?.student_name || a.details?.studentName || a.details?.student || a.subjectName || a.studentName || null;
          return (
            <Card key={idx} variant="outlined" sx={{ display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${borderColor}`, overflow: 'hidden' }}>
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">{formatDateTimeForDisplay(a.timestamp)}</Typography>
                        {/* Show amount prominently for payments; avoid repeating the action type (chip shows it) */}
                        {a.details && a.details.amount ? (
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>₹{a.details.amount}</Typography>
                        ) : null}
                        {studentName ? (
                          <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 700 }}>{studentName}</Typography>
                        ) : null}
                        {/* show subject type and id in light grey (only if available) */}
                        {((a.subjectType || a.subject_type) || (a.subjectId || a.subject_id)) ? (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{(a.subjectType || a.subject_type) || ''}{(a.subjectId || a.subject_id) ? ` • id:${a.subjectId || a.subject_id}` : ''}</Typography>
                        ) : null}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <Avatar sx={{ bgcolor: borderColor, width: 36, height: 36, fontSize: 14 }}>{initials}</Avatar>
                    <Chip label={p.label || t} size="small" color={p.color} sx={{ textTransform: 'capitalize' }} />
                    <Typography variant="caption" color="text.secondary">{actor}</Typography>
                  </Box>
                </Stack>
                <Box sx={{ mt: 1 }}>
                    <Paper variant="outlined" sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, maxHeight: 140, overflow: 'auto' }}>
                    {/* For UPDATE actions show a concise diff: only changed fields */}
                    {((a.type || a.action_type || '').toString().toUpperCase() === 'UPDATE') && (a.subjectType || a.subject_type) && (a.subjectId || a.subject_id) ? (
                      <UpdateDiff details={a.details} subjectType={a.subjectType || a.subject_type} subjectId={a.subjectId || a.subject_id} timestamp={a.timestamp} />
                    ) : (
                      // For payments, format any payment_date and show student_name clearly
                      (() => {
                        if ((a.type || a.action_type || '').toString().toLowerCase() === 'monthly_fee' || (a.subjectType || a.subject_type || '').toString().toLowerCase() === 'payment') {
                          const d = a.details || {};
                          return (
                            <Box>
                              <Box sx={{ display: 'grid', gap: 0.5 }}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 700 }}>Amount</Typography>
                                  <Typography variant="body2">₹{d.amount ?? '—'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 700 }}>Remarks</Typography>
                                  <Typography variant="body2">{d.remarks ?? '—'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 700 }}>Payment date</Typography>
                                  <Typography variant="body2">{formatDateTimeForDisplay(d.payment_date || a.timestamp)}</Typography>
                                </Box>
                                {d.student_name ? (
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 700 }}>Student</Typography>
                                    <Typography variant="body2">{d.student_name}</Typography>
                                  </Box>
                                ) : null}
                              </Box>
                            </Box>
                          );
                        }
                        return <PrettyDetails details={a.details} />;
                      })()
                    )}
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          );
        })}
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
                <TableCell>{formatToIST(a.timestamp)}</TableCell>
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
                    // Show structured details in desktop description column
                    return <PrettyDetails details={a.details} />;
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const studentName = a.details?.name || a.details?.student_name || a.details?.studentName || a.details?.student || a.subjectName || a.studentName || null;
                    if (studentName) return <><Typography variant="body2">{studentName}</Typography><Typography variant="caption" color="text.secondary">{a.subjectType || a.subject_type} {a.subjectId || a.subject_id ? `#${a.subjectId || a.subject_id}` : ''}</Typography></>;
                    return <>{a.subjectType || a.subject_type} {a.subjectId || a.subject_id ? `#${a.subjectId || a.subject_id}` : ''}</>;
                  })()}
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
