import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  CircularProgress,
  Divider,
  Collapse,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { Download as DownloadIcon, Print as PrintIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, ArrowBackIosNew as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import financeService from '../services/finance';
import { formatDateTimeForDisplay, formatDateForDisplay, formatPeriod } from '../utils/dateUtils';

export default function BalanceSheet({ startDate: propStartDate, endDate: propEndDate, title: propTitle }) {
  const location = useLocation();
  const query = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const startDateFromUrl = query.get('startDate') || null;
  const endDateFromUrl = query.get('endDate') || null;
  const titleFromUrl = query.get('title') || null;

  const [startDate, setStartDate] = useState(startDateFromUrl || propStartDate || '');
  const [endDate, setEndDate] = useState(endDateFromUrl || propEndDate || '');
  const [title, setTitle] = useState(titleFromUrl || propTitle || '');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loadingGroups, setLoadingGroups] = useState({});
  const timersRef = useRef({});
  const [groupPages, setGroupPages] = useState({}); // { [key]: { page: 0, total: <number> } }
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    // fetch when component mounts or when date range changes
    setLoading(true);
    setError(null);
    financeService.getFinanceDetails({ startDate: startDate || undefined, endDate: endDate || undefined, groupPageSize: 10 })
      .then(d => {
        setData(d);
        // initialize groupPages from returned groups if available
        const gp = {};
        if (d.paymentsByType) {
          d.paymentsByType.forEach((g, i) => { gp[`pay-${i}`] = { page: 0, total: g.total || (g.items ? g.items.length : 0) }; });
        }
        if (d.expenseByCategory) {
          d.expenseByCategory.forEach((g, i) => { gp[`exp-${i}`] = { page: 0, total: g.total || (g.items ? g.items.length : 0) }; });
        }
        setGroupPages(gp);
      })
      .catch(err => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const toggleExpand = (key) => {
    // if already loading for this group, ignore click
    if (loadingGroups[key]) return;

    // set loading state immediately (disables button and shows spinner)
    setLoadingGroups(prev => ({ ...prev, [key]: true }));

    // fallback: clear loading state after a short timeout if Collapse callbacks don't fire
    if (!timersRef.current.clear) timersRef.current.clear = {};
    if (timersRef.current.clear[key]) clearTimeout(timersRef.current.clear[key]);
    timersRef.current.clear[key] = setTimeout(() => {
      setLoadingGroups(prev => ({ ...prev, [key]: false }));
      timersRef.current.clear[key] = null;
    }, 2000);

    // debounce actual expand toggle to avoid rapid toggles
    const delay = 250; // ms
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(() => {
      setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
      timersRef.current[key] = null;
    }, delay);
  };

  // helper to load more items for a group (payments/expenses)
  const loadMoreGroup = async ({ group, idx, key }) => {
    const keyName = `${group === 'payments' ? 'pay' : 'exp'}-${idx}`;
    try {
      setLoadingGroups(prev => ({ ...prev, [keyName]: true }));
      const nextPage = (groupPages[keyName] && typeof groupPages[keyName].page === 'number') ? groupPages[keyName].page + 1 : 1;
      const resp = await financeService.getGroupItems({ group, key, startDate, endDate, page: nextPage, pageSize: 10 });
      setData(prev => {
        if (!prev) return prev;
        if (group === 'payments') {
          const newPayments = (prev.paymentsByType || []).map((g, gi) => {
            if (gi === idx) return { ...g, items: (g.items || []).concat(resp.items || []) };
            return g;
          });
          return { ...prev, paymentsByType: newPayments };
        }
        const newExpenseGroups = (prev.expenseByCategory || []).map((g, gi) => {
          if (gi === idx) return { ...g, items: (g.items || []).concat(resp.items || []) };
          return g;
        });
        return { ...prev, expenseByCategory: newExpenseGroups };
      });
      setGroupPages(prev => ({ ...prev, [keyName]: { page: nextPage, total: resp.total } }));
    } catch (err) {
      console.error('Load more group error', err && err.message ? err.message : err, err && err.body ? err.body : null);
      setError(err && err.message ? err.message : 'Failed to load more items');
    } finally {
      setLoadingGroups(prev => ({ ...prev, [keyName]: false }));
    }
  };

  useEffect(() => {
    return () => {
      // clear any pending timers on unmount
      Object.values(timersRef.current).forEach(t => { if (t) clearTimeout(t); });
    };
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = [];
    rows.push(['Section', 'Category/Type', 'Amount', 'Details']);

    // payments
    if (data.paymentsByType) {
      for (const p of data.paymentsByType) {
        rows.push(['Income', p.type, p.amount, `${p.items.length} items`]);
        for (const it of p.items) {
          rows.push(['Income Item', p.type, it.amount, `${it.student_name || ''} | ${it.payment_date || ''} | ${it.payment_mode || ''}`]);
        }
      }
    }

    // expenses
    if (data.expenseByCategory) {
      for (const c of data.expenseByCategory) {
        rows.push(['Expense', c.category, c.amount, `${c.items.length} items`]);
        for (const it of c.items) {
          rows.push(['Expense Item', c.category, it.amount, `${it.description || ''} | ${it.expense_date || ''}`]);
        }
      }
    }

    const csvContent = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance_sheet_${startDate || 'from'}_${endDate || 'to'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    // minimal approach: open a new window with formatted HTML and call print
    if (!data) return;
    const w = window.open('', '_blank');
  // build payments HTML, include items table for groups that are expanded
  const paymentsHtml = (data.paymentsByType || []).map((p, idx) => {
    const keyName = `pay-${idx}`;
    const itemsSummaryRow = `<tr><td>${p.type}</td><td>₹${Number(p.amount || 0).toLocaleString()}</td><td>${p.items ? p.items.length : 0}</td></tr>`;
  let itemsDetail = '';
  // include items in print when available (do not rely on UI Collapse state)
  if (p.items && p.items.length) {
      itemsDetail = `
        <tr><td colspan="3">
          <table style="width:100%;border-collapse:collapse;margin-top:8px"><thead><tr><th>Student</th><th>Amount</th><th>Type</th><th>Date</th><th>Mode</th></tr></thead><tbody>
            ${p.items.map(it => `<tr><td>${it.student_name || it.student_id || 'N/A'}</td><td>₹${Number(it.amount||0).toLocaleString()}</td><td>${it.payment_type || ''}</td><td>${formatDateTimeForDisplay(it.payment_date)}</td><td>${it.payment_mode || ''}</td></tr>`).join('')}
          </tbody></table>
        </td></tr>
      `;
    }
    return itemsSummaryRow + itemsDetail;
  }).join('');

  const expensesHtml = (data.expenseByCategory || []).map((c, idx) => {
    const keyName = `exp-${idx}`;
    const summaryRow = `<tr><td>${c.category}</td><td>₹${Number(c.amount || 0).toLocaleString()}</td><td>${c.items ? c.items.length : 0}</td></tr>`;
  let itemsDetail = '';
  // include items in print when available (do not rely on UI Collapse state)
  if (c.items && c.items.length) {
      itemsDetail = `
        <tr><td colspan="3">
          <table style="width:100%;border-collapse:collapse;margin-top:8px"><thead><tr><th>Description</th><th>Amount</th><th>Date</th></tr></thead><tbody>
            ${c.items.map(it => `<tr><td>${it.description || ''}</td><td>₹${Number(it.amount||0).toLocaleString()}</td><td>${formatDateForDisplay(it.expense_date)}</td></tr>`).join('')}
          </tbody></table>
        </td></tr>
      `;
    }
    return summaryRow + itemsDetail;
  }).join('');

  const html = `
      <html>
      <head>
        <title>Balance Sheet</title>
        <style>
          body{font-family: Arial, Helvetica, sans-serif; padding: 20px;}
          table{width:100%;border-collapse:collapse}
          td,th{border:1px solid #ccc;padding:6px;text-align:left}
          .nested td, .nested th{border:1px solid #ddd;padding:4px}
        </style>
      </head>
      <body>
        <h2>${title || 'Balance Sheet'}</h2>
        <p>Period: ${formatPeriod(startDate, endDate)}</p>
        <h3>Summary</h3>
        <p>Income: ₹${Number(data.totalIncome||0).toLocaleString()}<br/>Expenses: ₹${Number(data.totalExpenses||0).toLocaleString()}<br/>Net: ₹${Number(data.net||0).toLocaleString()}</p>
        <h3>Details</h3>
        <h4>Income</h4>
        <table><thead><tr><th>Type</th><th>Amount</th><th>Items</th></tr></thead><tbody>
  ${paymentsHtml}
        </tbody></table>
        <h4>Expenses</h4>
        <table><thead><tr><th>Category</th><th>Amount</th><th>Items</th></tr></thead><tbody>
  ${expensesHtml}
        </tbody></table>
      </body>
      </html>
    `;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="back">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>{title || 'Balance Sheet'}</Typography>
          <Button startIcon={<DownloadIcon />} onClick={exportCsv}>Download</Button>
          <IconButton onClick={handlePrint}><PrintIcon /></IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : !data ? (
          <Typography>No data</Typography>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'baseline' }}>
              <Typography variant="h6">Income: ₹{Number(data.totalIncome || 0).toLocaleString()}</Typography>
              <Typography variant="h6" sx={{ color: 'error.main' }}>Expenses: ₹{Number(data.totalExpenses || 0).toLocaleString()}</Typography>
              <Typography variant="h6" sx={{ color: (data.net >= 0 ? 'success.main' : 'error.main') }}>Net: ₹{Number(data.net || 0).toLocaleString()}</Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle1" sx={{ mb: 1 }}>Income Breakdown</Typography>
            {isMobile ? (
              <Box>
                {data.paymentsByType && data.paymentsByType.length > 0 ? data.paymentsByType.map((p, idx) => {
                  const keyName = `pay-${idx}`;
                  const pageState = groupPages[keyName] || { page: 0, total: (p.items ? p.items.length : 0) };
                  const loaded = p.items ? p.items.length : 0;
                  const allLoaded = pageState.total && loaded >= pageState.total;
                  return (
                    <Card key={`pay-card-${idx}`} sx={{ mb: 1 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton size="small" onClick={() => toggleExpand(keyName)} disabled={!!loadingGroups[keyName]}>
                              {expanded[keyName] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                            {loadingGroups[keyName] ? <CircularProgress size={18} /> : null}
                            <Typography sx={{ fontWeight: 700 }}>{p.type}</Typography>
                          </Box>
                          <Typography>₹{Number(p.amount || 0).toLocaleString()}</Typography>
                        </Box>
                        <Collapse
                          in={!!expanded[keyName]}
                          timeout="auto"
                          unmountOnExit
                          onEntered={() => setLoadingGroups(prev => ({ ...prev, [keyName]: false }))}
                          onExited={() => setLoadingGroups(prev => ({ ...prev, [keyName]: false }))}
                        >
                          <List>
                            {p.items.map((it, i2) => (
                              <ListItem key={`pitem-${idx}-${i2}`}>
                                <ListItemText primary={`${it.student_name || it.student_id || 'N/A'} — ₹${Number(it.amount || 0).toLocaleString()}`} secondary={`${formatDateTimeForDisplay(it.payment_date)} • ${it.payment_mode || ''}`} />
                              </ListItem>
                            ))}
                          </List>
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                            <Button size="small" onClick={async () => {
                              try {
                                setLoadingGroups(prev => ({ ...prev, [keyName]: true }));
                                const nextPage = (groupPages[keyName] && groupPages[keyName].page !== undefined) ? groupPages[keyName].page + 1 : 1;
                                const resp = await financeService.getGroupItems({ group: 'payments', key: p.type, startDate, endDate, page: nextPage, pageSize: 10 });
                                setData(prev => {
                                  if (!prev) return prev;
                                  const newPayments = (prev.paymentsByType || []).map((g, gi) => {
                                    if (gi === idx) {
                                      return { ...g, items: (g.items || []).concat(resp.items || []) };
                                    }
                                    return g;
                                  });
                                  return { ...prev, paymentsByType: newPayments };
                                });
                                setGroupPages(prev => ({ ...prev, [keyName]: { page: nextPage, total: resp.total } }));
                              } catch (err) {
                                console.error('Load more payments error', err && err.message ? err.message : err, err && err.body ? err.body : null);
                                setError(err && err.message ? err.message : 'Failed to load more payments');
                              } finally {
                                setLoadingGroups(prev => ({ ...prev, [keyName]: false }));
                              }
                            }} disabled={!!loadingGroups[keyName] || allLoaded}>
                              {loadingGroups[keyName] ? <CircularProgress size={18} /> : (allLoaded ? 'All loaded' : 'Load more')}
                            </Button>
                          </Box>
                        </Collapse>
                      </CardContent>
                    </Card>
                  );
                }) : (
                  <Typography>No income</Typography>
                )}
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Amount (₹)</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.paymentsByType && data.paymentsByType.length > 0 ? data.paymentsByType.map((p, idx) => (
                        <React.Fragment key={`pay-group-${idx}`}>
                          <TableRow key={`p-${idx}`}>
                            <TableCell>
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                <IconButton size="small" onClick={() => toggleExpand(`pay-${idx}`)} disabled={!!loadingGroups[`pay-${idx}`]}>
                                  {expanded[`pay-${idx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                                {loadingGroups[`pay-${idx}`] ? <CircularProgress size={18} /> : null}
                                <Typography component="span">{p.type}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>₹{Number(p.amount || 0).toLocaleString()}</TableCell>
                            <TableCell>{p.items.length} item(s)</TableCell>
                          </TableRow>
                          <TableRow key={`p-collapse-${idx}`}>
                            <TableCell colSpan={3} sx={{ p: 0, border: 0 }}>
                              <Collapse
                                in={!!expanded[`pay-${idx}`]}
                                timeout="auto"
                                unmountOnExit
                                onEntered={() => setLoadingGroups(prev => ({ ...prev, [`pay-${idx}`]: false }))}
                                onExited={() => setLoadingGroups(prev => ({ ...prev, [`pay-${idx}`]: false }))}
                              >
                                <Box sx={{ p: 1 }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Student</TableCell>
                                        <TableCell>Amount</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Mode</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {p.items.map((it, i2) => (
                                        <TableRow key={`pitem-${idx}-${i2}`}>
                                          <TableCell>{it.student_name || it.student_id || 'N/A'}</TableCell>
                                          <TableCell>₹{Number(it.amount || 0).toLocaleString()}</TableCell>
                                          <TableCell>{it.payment_type}</TableCell>
                                          <TableCell>{formatDateTimeForDisplay(it.payment_date)}</TableCell>
                                          <TableCell>{it.payment_mode}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  {/* Load more for payments group */}
                                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                                    {(() => {
                                      const keyName = `pay-${idx}`;
                                      const pageState = groupPages[keyName] || { page: 0, total: (p.items ? p.items.length : 0) };
                                      const loaded = p.items ? p.items.length : 0;
                                      const allLoaded = pageState.total && loaded >= pageState.total;
                                      return (
                                        <Button
                                          size="small"
                                          onClick={async () => {
                                            try {
                                              setLoadingGroups(prev => ({ ...prev, [keyName]: true }));
                                              const nextPage = (groupPages[keyName] && groupPages[keyName].page !== undefined) ? groupPages[keyName].page + 1 : 1;
                                              const resp = await financeService.getGroupItems({ group: 'payments', key: p.type, startDate, endDate, page: nextPage, pageSize: 10 });
                                              // append items
                                              setData(prev => {
                                                if (!prev) return prev;
                                                const newPayments = (prev.paymentsByType || []).map((g, gi) => {
                                                  if (gi === idx) {
                                                    return { ...g, items: (g.items || []).concat(resp.items || []) };
                                                  }
                                                  return g;
                                                });
                                                return { ...prev, paymentsByType: newPayments };
                                              });
                                              setGroupPages(prev => ({ ...prev, [keyName]: { page: nextPage, total: resp.total } }));
                                            } catch (err) {
                                              // Log detailed error info and show brief message in UI
                                              console.error('Load more payments error', err && err.message ? err.message : err, err && err.body ? err.body : null);
                                              setError(err && err.message ? err.message : 'Failed to load more payments');
                                            } finally {
                                              setLoadingGroups(prev => ({ ...prev, [keyName]: false }));
                                            }
                                          }}
                                          disabled={!!loadingGroups[`pay-${idx}`] || allLoaded}
                                        >
                                          {loadingGroups[`pay-${idx}`] ? <CircularProgress size={18} /> : (allLoaded ? 'All loaded' : 'Load more')}
                                        </Button>
                                      );
                                    })()}
                                  </Box>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      )) : (
                      <TableRow><TableCell colSpan={4}>No income</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ mb: 1 }}>Expenses Breakdown</Typography>
            {isMobile ? (
              <Box>
                {data.expenseByCategory && data.expenseByCategory.length > 0 ? data.expenseByCategory.map((c, idx) => {
                  const keyName = `exp-${idx}`;
                  const pageState = groupPages[keyName] || { page: 0, total: (c.items ? c.items.length : 0) };
                  const loaded = c.items ? c.items.length : 0;
                  const allLoaded = pageState.total && loaded >= pageState.total;
                  return (
                    <Card key={`exp-card-${idx}`} sx={{ mb: 1 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton size="small" onClick={() => toggleExpand(keyName)} disabled={!!loadingGroups[keyName]}>
                              {expanded[keyName] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                            {loadingGroups[keyName] ? <CircularProgress size={18} /> : null}
                            <Typography sx={{ fontWeight: 700 }}>{c.category}</Typography>
                          </Box>
                          <Typography>₹{Number(c.amount || 0).toLocaleString()}</Typography>
                        </Box>
                        <Collapse
                          in={!!expanded[keyName]}
                          timeout="auto"
                          unmountOnExit
                          onEntered={() => setLoadingGroups(prev => ({ ...prev, [keyName]: false }))}
                          onExited={() => setLoadingGroups(prev => ({ ...prev, [keyName]: false }))}
                        >
                          <List>
                            {c.items.map((it, i2) => (
                              <ListItem key={`eit-${idx}-${i2}`}>
                                <ListItemText primary={`${it.description || ''} — ₹${Number(it.amount || 0).toLocaleString()}`} secondary={formatDateForDisplay(it.expense_date)} />
                              </ListItem>
                            ))}
                          </List>
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                            <Button size="small" onClick={async () => {
                              try {
                                setLoadingGroups(prev => ({ ...prev, [keyName]: true }));
                                const nextPage = (groupPages[keyName] && groupPages[keyName].page !== undefined) ? groupPages[keyName].page + 1 : 1;
                                const resp = await financeService.getGroupItems({ group: 'expenses', key: c.category || c.category_name || c.categoryId, startDate, endDate, page: nextPage, pageSize: 10 });
                                setData(prev => {
                                  if (!prev) return prev;
                                  const newExpenseGroups = (prev.expenseByCategory || []).map((g, gi) => {
                                    if (gi === idx) {
                                      return { ...g, items: (g.items || []).concat(resp.items || []) };
                                    }
                                    return g;
                                  });
                                  return { ...prev, expenseByCategory: newExpenseGroups };
                                });
                                setGroupPages(prev => ({ ...prev, [keyName]: { page: nextPage, total: resp.total } }));
                              } catch (err) {
                                console.error('Load more expenses error', err && err.message ? err.message : err, err && err.body ? err.body : null);
                                setError(err && err.message ? err.message : 'Failed to load more expenses');
                              } finally {
                                setLoadingGroups(prev => ({ ...prev, [keyName]: false }));
                              }
                            }} disabled={!!loadingGroups[keyName] || allLoaded}>
                              {loadingGroups[keyName] ? <CircularProgress size={18} /> : (allLoaded ? 'All loaded' : 'Load more')}
                            </Button>
                          </Box>
                        </Collapse>
                      </CardContent>
                    </Card>
                  );
                }) : (
                  <Typography>No expenses</Typography>
                )}
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Amount (₹)</TableCell>
                      <TableCell>Items</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.expenseByCategory && data.expenseByCategory.length > 0 ? data.expenseByCategory.map((c, idx) => (
                      <React.Fragment key={`exp-group-${idx}`}>
                        <TableRow key={`c-${idx}`}>
                          <TableCell>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                              <IconButton size="small" onClick={() => toggleExpand(`exp-${idx}`)} disabled={!!loadingGroups[`exp-${idx}`]}>
                                {expanded[`exp-${idx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                              {loadingGroups[`exp-${idx}`] ? <CircularProgress size={18} /> : null}
                              <Typography component="span">{c.category}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>₹{Number(c.amount || 0).toLocaleString()}</TableCell>
                          <TableCell>{c.items.length} item(s)</TableCell>
                        </TableRow>
                        <TableRow key={`c-collapse-${idx}`}>
                          <TableCell colSpan={3} sx={{ p: 0, border: 0 }}>
                            <Collapse
                              in={!!expanded[`exp-${idx}`]}
                              timeout="auto"
                              unmountOnExit
                              onEntered={() => setLoadingGroups(prev => ({ ...prev, [`exp-${idx}`]: false }))}
                              onExited={() => setLoadingGroups(prev => ({ ...prev, [`exp-${idx}`]: false }))}
                            >
                              <Box sx={{ p: 1 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Description</TableCell>
                                      <TableCell>Amount</TableCell>
                                      <TableCell>Date</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {c.items.map((it, i2) => (
                                      <TableRow key={`eit-${idx}-${i2}`}>
                                        <TableCell>{it.description || ''}</TableCell>
                                        <TableCell>₹{Number(it.amount || 0).toLocaleString()}</TableCell>
                                        <TableCell>{formatDateForDisplay(it.expense_date)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                                {/* Load more for expense group */}
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                                  {(() => {
                                    const keyName = `exp-${idx}`;
                                    const pageState = groupPages[keyName] || { page: 0, total: (c.items ? c.items.length : 0) };
                                    const loaded = c.items ? c.items.length : 0;
                                    const allLoaded = pageState.total && loaded >= pageState.total;
                                    return (
                                      <Button
                                        size="small"
                                        onClick={async () => {
                                          try {
                                            setLoadingGroups(prev => ({ ...prev, [keyName]: true }));
                                            const nextPage = (groupPages[keyName] && groupPages[keyName].page !== undefined) ? groupPages[keyName].page + 1 : 1;
                                            // For expenses, server expects category name or id; use category string when available
                                            const resp = await financeService.getGroupItems({ group: 'expenses', key: c.category || c.category_name || c.categoryId, startDate, endDate, page: nextPage, pageSize: 10 });
                                            setData(prev => {
                                              if (!prev) return prev;
                                              const newExpenseGroups = (prev.expenseByCategory || []).map((g, gi) => {
                                                if (gi === idx) {
                                                  return { ...g, items: (g.items || []).concat(resp.items || []) };
                                                }
                                                return g;
                                              });
                                              return { ...prev, expenseByCategory: newExpenseGroups };
                                            });
                                            setGroupPages(prev => ({ ...prev, [keyName]: { page: nextPage, total: resp.total } }));
                                          } catch (err) {
                                            console.error('Load more expenses error', err && err.message ? err.message : err, err && err.body ? err.body : null);
                                            setError(err && err.message ? err.message : 'Failed to load more expenses');
                                          } finally {
                                            setLoadingGroups(prev => ({ ...prev, [keyName]: false }));
                                          }
                                        }}
                                        disabled={!!loadingGroups[`exp-${idx}`] || allLoaded}
                                      >
                                        {loadingGroups[`exp-${idx}`] ? <CircularProgress size={18} /> : (allLoaded ? 'All loaded' : 'Load more')}
                                      </Button>
                                    );
                                  })()}
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    )) : (
                      <TableRow><TableCell colSpan={4}>No expenses</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

          </Box>
        )}
      </Container>
    </Box>
  );
}
