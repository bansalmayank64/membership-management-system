import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TablePagination,
  Fab,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Edit as EditIcon, Delete as DeleteIcon, FileDownload as FileDownloadIcon, Money as MoneyIcon, Restaurant as RestaurantIcon, LocalCafe as CafeIcon, Home as HomeIcon, LocalShipping as TravelIcon, MedicalServices as MedicalIcon, Bolt as BoltIcon, CleaningServices as BrushIcon, Work as WorkIcon } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import api from '../services/api';
import Footer from '../components/Footer';
import DurationFilter from '../components/DurationFilter';
import BalanceSheet from '../components/BalanceSheet';
import { formatDateTimeForDisplay, todayInIST, isoToISTDateInput, isoToISTDateTimeInput, getUtcMidnightForDateInTZ, nowInISTDateTimeLocal } from '../utils/dateUtils';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

// Expenses page: timezone-aware, server-paginated, edit/delete, CSV export, monthly breakdown
export default function Expenses() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Data & loading
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);
  const [totalRows, setTotalRows] = useState(0);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [durationOpen, setDurationOpen] = useState(false);
  const [durationLabel, setDurationLabel] = useState('');

  // Categories
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // New / edit form state
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState({ id: null, category: '', description: '', amount: '', expense_date: nowInISTDateTimeLocal() });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Loading initial data
  useEffect(() => {
    fetchCategories();
    fetchExpenses({ page: 0 });
  }, []);

  // Map category text or id to an icon for quick visual scanning
  const renderCategoryIcon = (expense) => {
    // prefer category name (category_name), fall back to category id or raw category
    const key = (expense && (expense.category_name || expense.category || '')).toString().toLowerCase();
  let IconComp = MoneyIcon; // default for Others -> money icon
  if (/clean|cleaning|sweep|janitor|mop|brush/.test(key)) IconComp = BrushIcon;
  else if (/caretaker|caretaker salary|caretaker-salary|caretaker_salary|care taker|caretaker payment|salary.*caretaker|wages.*caretaker/.test(key)) IconComp = WorkIcon;
  else if (/electric|electricity|power|meter|current|bill.*electric|energy/.test(key)) IconComp = BoltIcon;
  else if (/food|restaurant|meal|dinner|lunch|breakfast/.test(key)) IconComp = RestaurantIcon;
  else if (/cafe|coffee|tea/.test(key)) IconComp = CafeIcon;
  else if (/rent|home|house|utility/.test(key)) IconComp = HomeIcon;
  else if (/travel|taxi|uber|bus|train|flight|transport/.test(key)) IconComp = TravelIcon;
  else if (/medical|doctor|pharmacy|health/.test(key)) IconComp = MedicalIcon;

    return <IconComp fontSize="small" color="action" aria-hidden={false} titleAccess={expense && (expense.category_name || expense.category || '')} />;
  };

  useEffect(() => {
    // reset rowsPerPage on mobile change
    setRowsPerPage(isMobile ? 10 : 25);
  }, [isMobile]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const resp = await fetch('/api/expense-categories', { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
      if (!resp.ok) throw new Error('Failed to load categories');
      const data = await resp.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.warn('Failed to load categories', err);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Fetch expenses from server with pagination & filters
  const fetchExpenses = async (opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const pageToUse = typeof opts.page === 'number' ? opts.page : page;
      const sizeToUse = typeof opts.pageSize === 'number' ? opts.pageSize : rowsPerPage;

  const params = new URLSearchParams();
  // backend expects zero-based page index
  params.set('page', String(pageToUse));
  params.set('pageSize', String(sizeToUse));
  // allow callers to override filters to avoid race with setState
  const catToUse = typeof opts.filterCategory !== 'undefined' ? opts.filterCategory : filterCategory;
  const sToUse = typeof opts.filterStartDate !== 'undefined' ? opts.filterStartDate : filterStartDate;
  const eToUse = typeof opts.filterEndDate !== 'undefined' ? opts.filterEndDate : filterEndDate;
  if (catToUse) params.set('category', catToUse);
  if (sToUse) params.set('startDate', getUtcMidnightForDateInTZ(sToUse));
  if (eToUse) params.set('endDate', getUtcMidnightForDateInTZ(eToUse));

      const resp = await fetch(`/api/expenses?${params.toString()}`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
      if (!resp.ok) throw new Error(`Failed to load expenses (${resp.status})`);
      const payload = await resp.json();

      // Expecting { expenses: [], total: <number> }
      setExpenses(payload.expenses || []);
      setTotalRows(payload.total || 0);
      setTotal(payload.total_amount || (payload.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0));

    } catch (err) {
      console.error('fetchExpenses error', err);
      setError(err.message || 'Failed to load expenses');
      setExpenses([]);
      setTotalRows(0);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
  setPage(0);
  fetchExpenses({ page: 0, filterCategory: filterCategory, filterStartDate: filterStartDate, filterEndDate: filterEndDate });
  };

  const onDurationApply = ({ label, startDate: s, endDate: e }) => {
  setDurationLabel(label || '');
  setFilterStartDate(s || '');
  setFilterEndDate(e || '');
  setDurationOpen(false);
  setPage(0);
  // fetch with explicit overrides to avoid reading stale state
  fetchExpenses({ page: 0, filterStartDate: s || '', filterEndDate: e || '' });
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    fetchExpenses({ page: newPage });
  };

  const handleChangeRowsPerPage = (event) => {
    const newSize = parseInt(event.target.value, 10);
    setRowsPerPage(newSize);
    setPage(0);
    fetchExpenses({ page: 0, pageSize: newSize });
  };

  // Open add dialog
  const openAdd = () => {
  setFormData({ id: null, category: '', description: '', amount: '', expense_date: nowInISTDateTimeLocal() });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (expense) => {
    // Map server fields into formData. Use category id if available.
  setFormData({ id: expense.id, category: expense.expense_category_id || expense.category, description: expense.description || '', amount: expense.amount || '', expense_date: isoToISTDateTimeInput(expense.expense_date) || nowInISTDateTimeLocal() });
    setFormError(null);
    setFormOpen(true);
  };

  const saveForm = async () => {
    setFormError(null);
  if (!formData.category) return setFormError('Category is required');
  if (!formData.amount || Number(formData.amount) <= 0) return setFormError('Amount must be > 0');
  if (!formData.expense_date) return setFormError('Date & Time is required');
    setFormSaving(true);
    try {
      const payload = {
        expense_category_id: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        expense_date: formData.expense_date
      };
      if (formData.id) {
        await api.updateExpense(formData.id, payload);
      } else {
        await api.addExpense(payload);
      }
  setFormOpen(false);
  // Refresh table, summary and month cards
  fetchExpenses({ page: page });
  fetchSummary();
  setMonthsOffset(0);
  loadMonths({ monthsToLoad: 6, offset: 0, replace: true, periodToUse: period });
    } catch (err) {
      console.error('saveForm error', err);
      setFormError(err.message || 'Failed to save');
    } finally {
      setFormSaving(false);
    }
  };

  const formatTimeAmPm = (dateTimeLocalStr) => {
    if (!dateTimeLocalStr) return '';
    try {
      // dateTimeLocalStr expected as 'YYYY-MM-DDTHH:MM'
      const d = new Date(dateTimeLocalStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    } catch (e) {
      return '';
    }
  };

  const confirmDelete = (id) => {
    setDeleteId(id);
  };

  const doDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteExpense(deleteId);
      setDeleteId(null);
      // refresh current page (if last item removed, server should handle empty pages)
  // Refresh table, summary and month cards
  fetchExpenses({ page });
  fetchSummary();
  setMonthsOffset(0);
  loadMonths({ monthsToLoad: 6, offset: 0, replace: true, periodToUse: period });
    } catch (err) {
      console.error('delete error', err);
      setError(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // Refresh everything: expenses list, summary cards and month cards
  const refreshAll = () => {
    fetchExpenses({ page });
    fetchSummary();
    setMonthsOffset(0);
    loadMonths({ monthsToLoad: 6, offset: 0, replace: true, periodToUse: period });
  };

  // CSV Export
  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set('category', filterCategory);
      if (filterStartDate) params.set('startDate', getUtcMidnightForDateInTZ(filterStartDate));
      if (filterEndDate) params.set('endDate', getUtcMidnightForDateInTZ(filterEndDate));
      const resp = await fetch(`/api/expenses?${params.toString()}&export=csv`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
      if (!resp.ok) throw new Error('Export failed');
      const text = await resp.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('exportCsv error', err);
      setError(err.message || 'Export failed');
    }
  };

  // Monthly breakdown cards (compute from current page or fetch summary)
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState({ totalExpenses: 0, prevMonth: 0, income: 0 });

  // Monthly cards state
  const [months, setMonths] = useState([]); // array of { monthLabel, income, expenses, net }
  const [monthsLoading, setMonthsLoading] = useState(false);
  const [monthsOffset, setMonthsOffset] = useState(0); // how many months already loaded (0 = current)
  const [monthsHasMore, setMonthsHasMore] = useState(true);
  const [period, setPeriod] = useState('month'); // 'month' or 'year'
  const [periodLoading, setPeriodLoading] = useState(false);
  const toggleDebounceRef = useRef(null);
  const [tilesVisible, setTilesVisible] = useState(true);
  // Balance sheet dialog state
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceContext, setBalanceContext] = useState(null); // { startDate, endDate, title }

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const resp = await fetch('/api/expenses/summary/stats', { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
      if (!resp.ok) throw new Error('Failed to load summary');
      const data = await resp.json();
      // Expecting { total: <num>, prev_month: <num>, income: <num>, net: <num> }
      setSummary({ totalExpenses: data.total || 0, prevMonth: data.prev_month || 0, income: data.income || 0 });
    } catch (err) {
      console.warn('Failed to load summary', err);
      setSummary({ totalExpenses: 0, prevMonth: 0, income: 0 });
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, []);

  useEffect(() => {
    // initial load: last 6 months or 3 years depending on period
    const initialBatch = period === 'year' ? 3 : 6;
    setPeriodLoading(true);
    // animate: hide tiles then load and fade in
    setTilesVisible(false);
  loadMonths({ monthsToLoad: initialBatch, offset: 0, replace: true, periodToUse: period })
      .then(() => setTimeout(() => setTilesVisible(true), 80))
      .catch(() => {})
      .finally(() => setPeriodLoading(false));
  }, []);

  const loadMonths = async ({ monthsToLoad = 6, offset = 0, replace = false, periodToUse = null } = {}) => {
    setMonthsLoading(true);
    try {
      const params = new URLSearchParams();
  params.set('months', String(monthsToLoad));
  params.set('offset', String(offset));
  params.set('period', String(periodToUse ? periodToUse : period));
      const resp = await fetch(`/api/finance/monthly?${params.toString()}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
      if (!resp.ok) throw new Error('Failed to load monthly data');
      const payload = await resp.json();
  const loaded = payload.months || [];
  const serverHasMore = payload.hasMore === true;
      if (replace) {
        setMonths(loaded);
      } else {
        // append older months to the end of array (we show most recent left-to-right)
        setMonths(prev => [...prev, ...loaded]);
      }

      // Use server-side hasMore when available, otherwise fall back to length check
      if (typeof serverHasMore === 'boolean') {
        setMonthsHasMore(serverHasMore);
      } else {
        setMonthsHasMore(!(loaded.length < monthsToLoad));
      }
  } catch (err) {
      console.error('loadMonths error', err);
    } finally {
  // If this load was triggered as part of a period change, ensure periodLoading cleared by caller
      setMonthsLoading(false);
    }
  };

  const handlePeriodChange = (event, newPeriod) => {
    if (!newPeriod) return;
    // prevent toggling while a period load is in progress
    if (periodLoading) return;
    // simple debounce to avoid rapid toggles
    if (toggleDebounceRef.current) return;
    toggleDebounceRef.current = setTimeout(() => { toggleDebounceRef.current = null; }, 600);

    setPeriod(newPeriod);
    // load initial tiles for the selected period with fade animation
    const monthsToLoad = newPeriod === 'year' ? 3 : 6;
    setMonthsOffset(0);
    setTilesVisible(false);
    setPeriodLoading(true);
  loadMonths({ monthsToLoad, offset: 0, replace: true, periodToUse: newPeriod })
      .then(() => setTimeout(() => setTilesVisible(true), 80))
      .catch(() => {})
      .finally(() => setPeriodLoading(false));
  };

  // Page render helpers
  const ExpenseCard = ({ e }) => (
    <Card sx={{ mb: 1.5, boxShadow: 1 }}>
      <CardContent>
        <Box>
          {/* First line: icon + category (left) and amount (right) */}
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
              {renderCategoryIcon(e)}
              <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.category_name || e.category || 'N/A'}</Typography>
            </Box>
            <Box sx={{ flexShrink: 0, textAlign: 'right', ml: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>₹{Number(e.amount || 0).toLocaleString()}</Typography>
            </Box>
          </Box>

          {/* Second line: description (single truncated line) + date and actions aligned right */}
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 'calc(100vw - 180px)' }}>{e.description || ''}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
              <Typography variant="caption" color="text.secondary">{formatDateTimeForDisplay(e.expense_date)}</Typography>
              <IconButton size="small" onClick={() => openEdit(e)} aria-label={`edit-${e.id}`}><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => confirmDelete(e.id)} aria-label={`delete-${e.id}`}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      {/* Header - responsive: stack on small screens to avoid overlap */}
      <Box mb={2}>
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '100%' }}>
              <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">Expenses</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
                <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={openAdd} sx={{ textTransform: 'none' }} size={isMobile ? 'small' : 'medium'}>Add Expense</Button>
                <IconButton onClick={refreshAll} aria-label="refresh-expenses" size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Horizontal months/year cards - scrollable */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2">{period === 'year' ? 'Yearly overview' : 'Monthly overview'}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
              <ToggleButton value="month">Month</ToggleButton>
              <ToggleButton value="year">Year</ToggleButton>
            </ToggleButtonGroup>
            {periodLoading && <CircularProgress size={18} />}
          </Box>
        </Box>
        <Box sx={{ position: 'relative' }}>
          <Box
            id="months-scroll"
            sx={{
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              py: 1,
              px: 0.5,
              scrollBehavior: 'smooth',
              transition: 'opacity 240ms ease, transform 260ms ease',
              opacity: tilesVisible ? 1 : 0,
              transform: tilesVisible ? 'translateY(0px)' : 'translateY(6px)'
            }}
          >
            {monthsLoading && months.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}><CircularProgress size={20} /></Box>
            ) : (
              months.map((m, idx) => (
                <Card
                  key={`${m.year}-${m.month}-${idx}`}
                  sx={{ minWidth: 180, flex: '0 0 auto', cursor: 'pointer' }}
                  onClick={() => {
                    // Compute ISO startDate and endDate for the period
                    let startDate = '';
                    let endDate = '';
                    if (period === 'year' || m.month == null) {
                      // year: use Jan 1 to Dec 31
                      startDate = `${m.year}-01-01`;
                      endDate = `${m.year}-12-31`;
                    } else {
                      // month: m.month is 1-12
                      const mm = String(m.month).padStart(2, '0');
                      startDate = `${m.year}-${mm}-01`;
                      // compute last day of month
                      const lastDay = new Date(m.year, m.month, 0).getDate();
                      endDate = `${m.year}-${mm}-${String(lastDay).padStart(2, '0')}`;
                    }
                    setBalanceContext({ startDate, endDate, title: `${m.monthLabel}` });
                    setBalanceOpen(true);
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={700}>{m.monthLabel}</Typography>
                    <Typography variant="caption" color="text.secondary">Income</Typography>
                    <Typography variant="h6" fontWeight={700}>₹{Number(m.income || 0).toLocaleString()}</Typography>
                    <Typography variant="caption" color="text.secondary">Expenses</Typography>
                    <Typography variant="body1" sx={{ color: 'error.main' }}>₹{Number(m.expenses || 0).toLocaleString()}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Net</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: m.net >= 0 ? 'success.main' : 'error.main' }}>₹{Number(m.net || 0).toLocaleString()}</Typography>
                  </CardContent>
                </Card>
              ))
            )}
            {/* Load more indicator at the end */}
            {monthsHasMore && !monthsLoading && (
              <Card sx={{ minWidth: 140, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardContent>
                  <Button size="small" onClick={() => { const batch = period === 'year' ? 3 : 6; const nextOffset = monthsOffset + batch; setMonthsOffset(nextOffset); loadMonths({ monthsToLoad: batch, offset: nextOffset, replace: false, periodToUse: period }); }}>Load more</Button>
                </CardContent>
              </Card>
            )}
            {monthsLoading && months.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 120, flex: '0 0 auto' }}><CircularProgress size={20} /></Box>
            )}
          </Box>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      {/* Filters: compact on mobile */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
        <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
          <Grid item xs={8} sm={4}>
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel>Category</InputLabel>
              <Select value={filterCategory} label="Category" onChange={(e) => { const v = e.target.value; setFilterCategory(v); setPage(0); fetchExpenses({ page: 0, filterCategory: v }); }}>
                <MenuItem value="">All</MenuItem>
                {categories.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {renderCategoryIcon({ category: c.name, category_name: c.name })}
                      <span>{c.name}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={4} sm={3}>
            <Button
              variant="outlined"
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              onClick={() => setDurationOpen(true)}
              startIcon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
              sx={{ borderRadius: 2, textTransform: 'none', justifyContent: 'flex-start', px: 1.25 }}
            >
              Duration
            </Button>
          </Grid>

          {/* Apply Filter button removed: selecting a category or choosing duration auto-applies the filter */}
        </Grid>
      </Paper>

      {/* Export button moved here so it respects filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {durationLabel && <Chip label={durationLabel} onDelete={() => { setDurationLabel(''); setFilterStartDate(''); setFilterEndDate(''); setPage(0); fetchExpenses({ page: 0, filterStartDate: '', filterEndDate: '' }); }} />}
          {filterCategory && <Chip label={categories.find(c => c.id === filterCategory)?.name || filterCategory} onDelete={() => { setFilterCategory(''); setPage(0); fetchExpenses({ page: 0, filterCategory: '' }); }} />}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Download CSV" arrow>
            <IconButton onClick={exportCsv} size="small" aria-label="download-csv" sx={{ border: '1px solid', borderColor: 'divider' }}>
              <FileDownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {(durationLabel || filterCategory || filterStartDate || filterEndDate) && (
            <Button onClick={() => { setDurationLabel(''); setFilterStartDate(''); setFilterEndDate(''); setFilterCategory(''); setPage(0); fetchExpenses({ page: 0, filterCategory: '', filterStartDate: '', filterEndDate: '' }); }} size="small">Clear filters</Button>
          )}
        </Box>
      </Box>

      {/* List & pagination */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {isMobile ? (
            <Box>
              {expenses.map(e => <ExpenseCard key={e.id} e={e} />)}
              <Box sx={{ mt: 2 }}>
                <TablePagination
                  component="div"
                  count={totalRows}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </Box>
              {/* Add button remains in header only */}
            </Box>
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Amount (₹)</TableCell>
                      <TableCell>Expense Date</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {expenses.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {renderCategoryIcon(e)}
                            <span>{e.category_name || e.category}</span>
                          </Box>
                        </TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>₹{Number(e.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>{formatDateTimeForDisplay(e.expense_date)}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => openEdit(e)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => confirmDelete(e.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <TablePagination
                  component="div"
                  count={totalRows}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </Box>
            </>
          )}
        </>
      )}

      {/* Edit/Add Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{formData.id ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select value={formData.category} label="Category" onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}>
                <MenuItem value="">Select</MenuItem>
                {categories.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {renderCategoryIcon({ category: c.name, category_name: c.name })}
                      <span>{c.name}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

              <TextField fullWidth label="Amount (₹)" type="number" value={formData.amount} onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))} required inputProps={{ min: 0 }} />
              <TextField fullWidth label="Date & Time" type="datetime-local" value={formData.expense_date} onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))} InputLabelProps={{ shrink: true }} required />
            <Typography variant="caption" color="text.secondary">{formatTimeAmPm(formData.expense_date)}</Typography>
            <TextField fullWidth label="Description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} />
            {formError && <Typography color="error" variant="caption">{formError}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          {/* Save only enabled when required fields are valid */}
          <Button variant="contained" onClick={saveForm} disabled={formSaving || !formData.category || !formData.amount || Number(formData.amount) <= 0 || !formData.expense_date}>{formSaving ? <CircularProgress size={18} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

  <DurationFilter open={durationOpen} onClose={() => setDurationOpen(false)} onApply={onDurationApply} initialStart={filterStartDate} initialEnd={filterEndDate} />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this expense?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={doDelete} disabled={deleting}>{deleting ? <CircularProgress size={18} /> : 'Delete'}</Button>
        </DialogActions>
      </Dialog>

      <Footer />
      <BalanceSheet
        open={balanceOpen}
        onClose={() => setBalanceOpen(false)}
        startDate={balanceContext?.startDate}
        endDate={balanceContext?.endDate}
        title={balanceContext?.title}
      />
    </Box>
  );
}
