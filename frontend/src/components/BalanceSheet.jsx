import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  CircularProgress,
  Divider,
  IconButton,
  Collapse
} from '@mui/material';
import { Download as DownloadIcon, Print as PrintIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import financeService from '../services/finance';
import { formatDateTimeForDisplay, formatDateForDisplay, formatPeriod } from '../utils/dateUtils';

export default function BalanceSheet({ open, onClose, startDate, endDate, title }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    financeService.getFinanceDetails({ startDate, endDate })
      .then(d => setData(d))
      .catch(err => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open, startDate, endDate]);

  const toggleExpand = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
  const html = `
      <html>
      <head>
        <title>Balance Sheet</title>
        <style>body{font-family: Arial, Helvetica, sans-serif; padding: 20px;} table{width:100%;border-collapse:collapse} td,th{border:1px solid #ccc;padding:6px;text-align:left}</style>
      </head>
      <body>
        <h2>${title || 'Balance Sheet'}</h2>
    <p>Period: ${formatPeriod(startDate, endDate)}</p>
        <h3>Summary</h3>
        <p>Income: ₹${Number(data.totalIncome||0).toLocaleString()}<br/>Expenses: ₹${Number(data.totalExpenses||0).toLocaleString()}<br/>Net: ₹${Number(data.net||0).toLocaleString()}</p>
        <h3>Details</h3>
        <h4>Income</h4>
        <table><thead><tr><th>Type</th><th>Amount</th><th>Items</th></tr></thead><tbody>
  ${data.paymentsByType.map(p=>`<tr><td>${p.type}</td><td>₹${Number(p.amount||0).toLocaleString()}</td><td>${p.items.length}</td></tr>`).join('')}
        </tbody></table>
        <h4>Expenses</h4>
        <table><thead><tr><th>Category</th><th>Amount</th><th>Items</th></tr></thead><tbody>
  ${data.expenseByCategory.map(c=>`<tr><td>${c.category}</td><td>₹${Number(c.amount||0).toLocaleString()}</td><td>${c.items.length}</td></tr>`).join('')}
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title || 'Balance Sheet'}</DialogTitle>
  <DialogContent dividers>
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
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Type</TableCell>
                    <TableCell>Amount (₹)</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.paymentsByType && data.paymentsByType.length > 0 ? data.paymentsByType.map((p, idx) => (
                      <React.Fragment key={`pay-group-${idx}`}>
                        <TableRow key={`p-${idx}`}>
                          <TableCell sx={{ width: 36 }}>
                            <IconButton size="small" onClick={() => toggleExpand(`pay-${idx}`)}>
                              {expanded[`pay-${idx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </TableCell>
                          <TableCell>{p.type}</TableCell>
                          <TableCell>₹{Number(p.amount || 0).toLocaleString()}</TableCell>
                          <TableCell>{p.items.length} item(s)</TableCell>
                        </TableRow>
                        <TableRow key={`p-collapse-${idx}`}>
                          <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                            <Collapse in={!!expanded[`pay-${idx}`]} timeout="auto" unmountOnExit>
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

            <Box sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ mb: 1 }}>Expenses Breakdown</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Category</TableCell>
                    <TableCell>Amount (₹)</TableCell>
                    <TableCell>Items</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.expenseByCategory && data.expenseByCategory.length > 0 ? data.expenseByCategory.map((c, idx) => (
                    <React.Fragment key={`exp-group-${idx}`}>
                      <TableRow key={`c-${idx}`}>
                        <TableCell sx={{ width: 36 }}>
                          <IconButton size="small" onClick={() => toggleExpand(`exp-${idx}`)}>
                            {expanded[`exp-${idx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>{c.category}</TableCell>
                        <TableCell>₹{Number(c.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>{c.items.length} item(s)</TableCell>
                      </TableRow>
                      <TableRow key={`c-collapse-${idx}`}>
                        <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                          <Collapse in={!!expanded[`exp-${idx}`]} timeout="auto" unmountOnExit>
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

          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
