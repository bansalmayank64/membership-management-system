import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, IconButton, Card, CardContent, Chip, useMediaQuery, Stack, TablePagination, Avatar, Tooltip } from '@mui/material';
import {
  Payment as PaymentIcon,
  ReceiptLong as ReceiptLongIcon,
  Person as PersonIcon,
  PersonOff as PersonOffIcon,
  PersonRemove as PersonRemoveIcon,
  EventSeat as EventSeatIcon,
  Edit as EditIcon,
  AddCircle as AddCircleIcon,
  Delete as DeleteIcon,
  History as HistoryIcon
} from '@mui/icons-material';
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
  else if (tt === 'deactivate' || tt === 'deactivated') color = 'error';
  else if (tt === 'unassign' || tt === 'unassigned') color = 'default';
  else if (tt === 'activity' || tt === 'login' || tt === 'auth') color = 'primary';
  const labelMap = {
    deactivate: 'Deactivated',
    deactivated: 'Deactivated',
    unassign: 'Unassigned',
    unassigned: 'Unassigned'
  };
  return { label: labelMap[tt] || t || '', color };
}

// Return an icon element for a given action/subject type
function activityIcon({ actionType, subjectType }) {
  const t = (actionType || '').toString().toLowerCase();
  const s = (subjectType || '').toString().toLowerCase();
  const commonProps = { fontSize: 'small' };
  if (t.includes('payment') || t === 'monthly_fee' || s === 'payment') return <PaymentIcon {...commonProps} />;
  if (t.includes('expense') || s === 'expense') return <ReceiptLongIcon {...commonProps} />;
  if (t === 'deactivated') return <PersonOffIcon {...commonProps} color="error" />;
  if (t === 'unassigned') return <PersonRemoveIcon {...commonProps} />;
  if (s === 'seat' || t === 'assign' || t === 'unassign') return <EventSeatIcon {...commonProps} />;
  if (t === 'insert' || t === 'create') return <AddCircleIcon {...commonProps} color="success" />;
  if (t === 'delete') return <DeleteIcon {...commonProps} color="error" />;
  if (t === 'update') return <EditIcon {...commonProps} />;
  if (t === 'login' || t === 'auth') return <HistoryIcon {...commonProps} />;
  // fallback
  return <PersonIcon {...commonProps} />;
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
  const [expenseCategoriesMap, setExpenseCategoriesMap] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch('/api/expense-categories', { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
        if (!resp.ok) return;
        const json = await resp.json();
        if (!mounted) return;
        // server returns { categories: [...] }
        const list = Array.isArray(json) ? json : (json && Array.isArray(json.categories) ? json.categories : []);
        const m = {};
        list.forEach(c => { if (c && c.id !== undefined) m[String(c.id)] = c.name; });
        setExpenseCategoriesMap(m);
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

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
  expenseCategoriesMap={expenseCategoriesMap}
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
      const isNullish = v => (v === null || typeof v === 'undefined' || (typeof v === 'string' && v.trim() === ''));
      // Treat undefined, null, and empty string as equivalent "no value"; avoid noise like undefined -> null
      const equivalent = (a, b) => {
        if (a === b) return true;
        if (isNullish(a) && isNullish(b)) return true;
        // numeric/string loose equivalence (e.g., '5' vs 5) not needed for now
        return false;
      };
      // Optionally ignore certain fields (internal metadata) if they appear
      const ignoreFields = new Set(['updated_at','created_at','action_timestamp','modified_by_name']);
      // compare shallow fields
      Object.keys(d2).forEach(k => {
        if (ignoreFields.has(k)) return; // skip ignored fields entirely
        const v1 = d1[k];
        const v2 = d2[k];
        // If both sides are objects (non-null), fall back to JSON compare
        if (typeof v1 === 'object' && v1 && typeof v2 === 'object' && v2) {
          if (JSON.stringify(v1) !== JSON.stringify(v2)) changed[k] = { from: v1, to: v2 };
          return;
        }
        if (!equivalent(v1, v2)) changed[k] = { from: v1, to: v2 };
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
      ) : null}
    </Box>
  );
}

function ResponsiveActivityList({ activities, totalCount = 0, page = 0, rowsPerPage = 25, onPageChange, onRowsPerPageChange, isMobile, expenseCategoriesMap = {} }) {
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

  // Render a compact expense summary: Amount, Category, Description
  function ExpenseSummary({ details, expenseCategoriesMap: localExpenseCategoriesMap = {}, actionType = '' }) {
    // support details stored as JSON string inside metadata
    let det = details;
    if (!det) return <Typography variant="body2" color="text.secondary">No details</Typography>;
    if (typeof det === 'string') {
      try { det = JSON.parse(det); } catch (e) { /* leave as string */ }
    }
    if (typeof det !== 'object') return <Typography variant="body2" color="text.secondary">No details</Typography>;
    // try common keys used in expense payloads
    const amount = det.amount ?? det.expense_amount ?? det.total ?? det.value ?? null;
    let category = det.category ?? det.expense_category ?? det.category_name ?? det.expenseCategory ?? det.categoryName ?? det.expense_category_id ?? null;
    const description = det.description ?? det.desc ?? det.remarks ?? det.note ?? null;

    // Determine if this action is a category-only update (hide amount)
    const isCategoryUpdate = (actionType || '').toString().toLowerCase().includes('category');

    // if category is an id, resolve via fetched map
    let resolvedCategoryName = null;
    if (category !== null && (typeof category === 'number' || (/^\d+$/.test(String(category))))) {
      const name = (localExpenseCategoriesMap || {})[String(category)];
      if (name) resolvedCategoryName = name;
    } else if (typeof category === 'string' && category.trim() !== '') {
      // if it's already a string (maybe category_name), use it
      resolvedCategoryName = category;
    }

    // For category-update actions, prefer to hide unresolved category instead of showing numeric id or placeholder
    if (isCategoryUpdate && !resolvedCategoryName) {
      resolvedCategoryName = '';
    }

    const Row = ({ label, value }) => (
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 700 }}>{label}</Typography>
        <Typography variant="body2">{value === null || value === undefined || value === '' ? '—' : String(value)}</Typography>
      </Box>
    );

  return (
      <Box sx={{ display: 'grid', gap: 0.5 }}>
    { !isCategoryUpdate && (
      <Row label="Amount" value={amount !== null ? `₹${amount}` : '—'} />
    ) }
    { resolvedCategoryName !== '' && (
      <Row label="Category" value={resolvedCategoryName || '—'} />
    ) }
    <Row label="Description" value={description || '—'} />
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
          const atypeLower = t.toString().toLowerCase();
          const subjectLower = (a.subjectType || a.subject_type || '').toString().toLowerCase();
          const isPayment = subjectLower === 'payment' || atypeLower === 'monthly_fee' || atypeLower.includes('payment') || atypeLower.includes('fee');
          const isLogin = atypeLower === 'login' || atypeLower === 'auth';
          const iconEl = activityIcon({ actionType: t, subjectType: a.subjectType || a.subject_type });
          return (
            <Card key={idx} variant="outlined" sx={{ display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${borderColor}`, overflow: 'hidden' }}>
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">{formatDateTimeForDisplay(a.timestamp)}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>{iconEl}</Box>
                          {isPayment && a.details?.amount ? (
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>₹{a.details.amount}</Typography>
                          ) : null}
                          {studentName ? (
                            <Typography variant="body1" sx={{ fontWeight: 700 }}>{studentName}</Typography>
                          ) : null}
                          {!studentName && (a.subjectType || a.subject_type) ? (
                            <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{(a.subjectType || a.subject_type)}</Typography>
                          ) : null}
                        </Stack>
                        {/* subject id only if no student name to avoid duplication */}
                        {!studentName && (a.subjectId || a.subject_id) ? (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>id:{a.subjectId || a.subject_id}</Typography>
                        ) : null}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <Avatar sx={{ bgcolor: borderColor, width: 36, height: 36, fontSize: 14 }}>{initials}</Avatar>
                    <Chip label={p.label || t} size="small" color={p.color} sx={{ textTransform: 'capitalize' }} />
                    <Typography variant="caption" color="text.secondary">{actor}</Typography>
                  </Box>
                </Stack>
                {/* Simplified content section */}
                {(() => {
                  if (isPayment) {
                    const d = a.details || {};
                    return (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {d.student_name ? d.student_name : (studentName || 'Payment')}
                          {d.payment_date ? ` • ${formatDateTimeForDisplay(d.payment_date)}` : ''}
                          {d.remarks ? ` • ${d.remarks}` : ''}
                        </Typography>
                      </Box>
                    );
                  }
                  if (isLogin) {
                    return (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">User {actor} logged in</Typography>
                      </Box>
                    );
                  }
                  // Provide concise summary for small diffs (<=2 fields) without opening full detail complexity
                  const isUpdate = (a.type || a.action_type || '').toString().toUpperCase() === 'UPDATE';
                  if (isUpdate && (a.subjectType || a.subject_type) && (a.subjectId || a.subject_id)) {
                    // We rely on UpdateDiff for full diff; here we attempt a lightweight preview by showing changed field keys (if precomputed later could refactor)
                  }
                  // Fallback: show existing rich panel only for non-payment/login
                  return (
                    <Box sx={{ mt: 1 }}>
                      <Paper variant="outlined" sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, maxHeight: 140, overflow: 'auto' }}>
                        {((a.type || a.action_type || '').toString().toUpperCase() === 'UPDATE') && (a.subjectType || a.subject_type) && (a.subjectId || a.subject_id) ? (
                          ((a.subjectType || a.subject_type || '').toString().toLowerCase() === 'expense') ? (
                            <ExpenseSummary details={a.details} expenseCategoriesMap={expenseCategoriesMap} actionType={a.type || a.action_type} />
                          ) : (
                            <UpdateDiff details={a.details} subjectType={a.subjectType || a.subject_type} subjectId={a.subjectId || a.subject_id} timestamp={a.timestamp} />
                          )
                        ) : (
                          (() => {
                            const atype = (a.type || a.action_type || '').toString().toLowerCase();
                            const subj = (a.subjectType || a.subject_type || '').toString().toLowerCase();
                            if (atype.includes('expense') || subj === 'expense') {
                              return <ExpenseSummary details={a.details} expenseCategoriesMap={expenseCategoriesMap} actionType={a.type || a.action_type} />;
                            }
                            let parsed = a.details;
                            if (typeof parsed === 'string') {
                              try { parsed = JSON.parse(parsed); } catch (e) { /* ignore */ }
                            }
                            return <PrettyDetails details={parsed} />;
                          })()
                        )}
                      </Paper>
                    </Box>
                  );
                })()}
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
                    const subjectType = (a.subjectType || a.subject_type || '').toString().toLowerCase();
                    const subjectId = a.subjectId || a.subject_id;
                    // If this is an expense-related activity, show compact expense summary
                    if (subjectType === 'expense' || (a.type || a.action_type || '').toString().toLowerCase().includes('expense')) {
                      return <ExpenseSummary details={a.details} expenseCategoriesMap={expenseCategoriesMap} actionType={a.type || a.action_type} />;
                    }
                    if (isUpdate && subjectType && subjectId) {
                      return (
                        <UpdateDiff details={a.details} subjectType={subjectType} subjectId={subjectId} timestamp={a.timestamp} />
                      );
                    }
                    // Show structured details in desktop description column
                    let parsed = a.details;
                    if (typeof parsed === 'string') {
                      try { parsed = JSON.parse(parsed); } catch (e) { /* leave string */ }
                    }
                    return <PrettyDetails details={parsed} />;
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
