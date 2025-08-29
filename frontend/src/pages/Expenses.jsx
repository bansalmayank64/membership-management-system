import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
  Box,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  TableSortLabel,
  InputAdornment,
  Fab,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import MobileFilters from '../components/MobileFilters';
import {
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  ElectricBolt as ElectricityIcon,
  Home as RentIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  CalendarToday as CalendarIcon,
  ExpandMore as ExpandIcon,
  Analytics as AnalyticsIcon,
  AccountBalance as AccountBalanceIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { pageStyles } from '../styles/commonStyles';
import Footer from '../components/Footer';
import api from '../services/api';

function Expenses() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [expenses, setExpenses] = useState([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [sortConfig, setSortConfig] = useState({ field: 'date', direction: 'desc' });
  const [viewMode, setViewMode] = useState(isMobile ? 'cards' : 'table');
  
  // New expense form state
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'electricity',
    description: '',
    amount: ''
  });

  // Global error handler for API calls
  const handleApiError = (error, fallbackMessage = 'An error occurred') => {
    if (error?.response?.data?.error === 'TOKEN_EXPIRED') {
      // Let the global interceptor handle token expiration
      return;
    }
    setError(error?.response?.data?.message || error?.message || fallbackMessage);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };
      
      // Fetch expenses
  const expensesResponse = await fetch(`/api/expenses`, {
        headers: authHeaders
      });
      
      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json();
        setExpenses(expensesData || []);
      }

      // Fetch payments to calculate total income
  const paymentsResponse = await fetch(`/api/payments`, {
        headers: authHeaders
      });
      
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        const payments = paymentsData || [];
        const income = payments
          .filter(payment => payment.amount > 0) // Only positive amounts (exclude refunds)
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        setTotalIncome(income);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      handleApiError(error, 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      // Prepare form data for POST request
      const formData = new FormData();
      const expenseData = {
        category: newExpense.type,
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        expense_date: newExpense.date,
        modified_by: 1 // TODO: Get actual user ID from auth context
      };

  const response = await fetch(`/api/expenses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(expenseData)
      });

      if (response.ok) {
        const result = await response.json();
        // Add to local state
        const newExpenseWithId = {
          ...newExpense,
          amount: Number(newExpense.amount),
          id: result.data.expense.id
        };
        setExpenses([...expenses, newExpenseWithId]);
        
        setAddDialogOpen(false);
        setNewExpense({
          date: new Date().toISOString().split('T')[0],
          type: 'electricity',
          description: '',
          amount: ''
        });
        setError(null);
      } else {
        throw new Error(result.data?.error || 'Failed to add expense');
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      handleApiError(error, 'Failed to add expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const filtered = getFilteredExpenses();
    const totalRent = filtered
      .filter(exp => exp.type === 'rent')
      .reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    
    const totalElectricity = filtered
      .filter(exp => exp.type === 'electricity')
      .reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

    const totalOther = filtered
      .filter(exp => exp.type !== 'rent' && exp.type !== 'electricity')
      .reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

    const total = totalRent + totalElectricity + totalOther;

    return {
      rent: totalRent,
      electricity: totalElectricity,
      other: totalOther,
      total
    };
  };

  const getFilteredExpenses = () => {
    let filtered = [...expenses];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(expense => 
        (expense.description || '').toLowerCase().includes(query) ||
        (expense.type || '').toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(expense => expense.type === typeFilter);
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateRange) {
        case 'thisMonth':
          filterDate.setMonth(now.getMonth());
          filterDate.setDate(1);
          break;
        case 'lastMonth':
          filterDate.setMonth(now.getMonth() - 1);
          filterDate.setDate(1);
          break;
        case 'last3Months':
          filterDate.setMonth(now.getMonth() - 3);
          break;
        case 'thisYear':
          filterDate.setFullYear(now.getFullYear());
          filterDate.setMonth(0);
          filterDate.setDate(1);
          break;
      }
      
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= filterDate;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.field];
      let bValue = b[sortConfig.field];

      if (sortConfig.field === 'amount') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else if (sortConfig.field === 'date') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      } else {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const handleSort = (field) => {
    setSortConfig(prevConfig => ({
      field,
      direction: prevConfig.field === field && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'electricity':
        return <ElectricityIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
      case 'rent':
        return <RentIcon sx={{ fontSize: 16, color: 'primary.main' }} />;
      case 'internet':
        return <ElectricityIcon sx={{ fontSize: 16, color: 'info.main' }} />;
      case 'water':
        return <RentIcon sx={{ fontSize: 16, color: 'info.main' }} />;
      case 'maintenance':
        return <ReceiptIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'supplies':
        return <ReceiptIcon sx={{ fontSize: 16, color: 'secondary.main' }} />;
      case 'cleaning':
        return <ReceiptIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'security':
        return <ReceiptIcon sx={{ fontSize: 16, color: 'error.main' }} />;
      default:
        return <ReceiptIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
    }
  };

  const getTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'electricity':
        return 'warning';
      case 'rent':
        return 'primary';
      case 'internet':
        return 'info';
      case 'water':
        return 'info';
      case 'maintenance':
        return 'success';
      case 'supplies':
        return 'secondary';
      case 'cleaning':
        return 'success';
      case 'security':
        return 'error';
      default:
        return 'default';
    }
  };

  const exportToCSV = () => {
    const filtered = getFilteredExpenses();
    const headers = ['Date', 'Type', 'Description', 'Amount'];
    const csv = [
      headers.join(','),
      ...filtered.map(expense => [
        expense.date,
        expense.type,
        `"${expense.description}"`,
        expense.amount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getMonthlyTrends = () => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    const thisMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === thisMonth && expenseDate.getFullYear() === thisYear;
    }).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    
    const lastMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === lastMonth && expenseDate.getFullYear() === lastMonthYear;
    }).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    
    const change = lastMonthExpenses > 0 
      ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 
      : 0;
    
    return {
      thisMonth: thisMonthExpenses,
      lastMonth: lastMonthExpenses,
      change: Math.round(change * 100) / 100,
      isIncrease: change > 0
    };
  };

  const totals = calculateTotals();
  const filteredExpenses = getFilteredExpenses();
  const netProfit = totalIncome - totals.total;
  const monthlyTrends = getMonthlyTrends();

  if (loading) {
    return (
      <Container sx={pageStyles.container}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container sx={pageStyles.container}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography 
          variant={isMobile ? "h5" : "h4"} 
          component="h1"
          fontWeight="bold"
        >
          <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Expenses Dashboard
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export to CSV">
            <IconButton onClick={exportToCSV} color="primary">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            size={isMobile ? "small" : "medium"}
          >
            Add Expense
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card sx={{ 
            p: isMobile ? 2 : 3, 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
            color: 'white'
          }}>
            <CardContent sx={{ p: isMobile ? 1 : 2, '&:last-child': { pb: isMobile ? 1 : 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <TrendingUpIcon sx={{ mr: 1 }} />
                <Typography variant={isMobile ? "subtitle2" : "h6"} fontWeight="bold">
                  Total Income
                </Typography>
              </Box>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                ₹{totalIncome.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card sx={{ 
            p: isMobile ? 2 : 3, 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
            color: 'white'
          }}>
            <CardContent sx={{ p: isMobile ? 1 : 2, '&:last-child': { pb: isMobile ? 1 : 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <TrendingDownIcon sx={{ mr: 1 }} />
                <Typography variant={isMobile ? "subtitle2" : "h6"} fontWeight="bold">
                  Total Expenses
                </Typography>
              </Box>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                ₹{totals.total.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card sx={{ 
            p: isMobile ? 2 : 3, 
            textAlign: 'center',
            background: netProfit >= 0 
              ? 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)'
              : 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
            color: 'white'
          }}>
            <CardContent sx={{ p: isMobile ? 1 : 2, '&:last-child': { pb: isMobile ? 1 : 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <AccountBalanceIcon sx={{ mr: 1 }} />
                <Typography variant={isMobile ? "subtitle2" : "h6"} fontWeight="bold">
                  Net Profit
                </Typography>
              </Box>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                ₹{netProfit.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card sx={{ p: isMobile ? 2 : 3, textAlign: 'center' }}>
            <CardContent sx={{ p: isMobile ? 1 : 2, '&:last-child': { pb: isMobile ? 1 : 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <ReceiptIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant={isMobile ? "subtitle2" : "h6"} color="text.secondary">
                  Total Records
                </Typography>
              </Box>
              <Typography variant={isMobile ? "h5" : "h4"} color="primary" fontWeight="bold">
                {filteredExpenses.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card sx={{ p: isMobile ? 2 : 3, textAlign: 'center' }}>
            <CardContent sx={{ p: isMobile ? 1 : 2, '&:last-child': { pb: isMobile ? 1 : 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant={isMobile ? "subtitle2" : "h6"} color="text.secondary">
                  This Month
                </Typography>
              </Box>
              <Typography variant={isMobile ? "h6" : "h5"} color="error.main" fontWeight="bold">
                ₹{monthlyTrends.thisMonth.toLocaleString()}
              </Typography>
              {monthlyTrends.lastMonth > 0 && (
                <Typography variant="body2" color={monthlyTrends.isIncrease ? 'error.main' : 'success.main'}>
                  {monthlyTrends.isIncrease ? '↑' : '↓'} {Math.abs(monthlyTrends.change)}%
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Expense Breakdown */}
      {totals.total > 0 && (
        <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle1" gutterBottom>
                <ElectricityIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'warning.main' }} />
                Electricity
              </Typography>
              <Typography variant="h5" color="warning.main" fontWeight="bold">
                ₹{totals.electricity.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totals.total > 0 ? Math.round((totals.electricity / totals.total) * 100) : 0}% of total
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle1" gutterBottom>
                <RentIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                Rent
              </Typography>
              <Typography variant="h5" color="primary.main" fontWeight="bold">
                ₹{totals.rent.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totals.total > 0 ? Math.round((totals.rent / totals.total) * 100) : 0}% of total
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle1" gutterBottom>
                <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'text.secondary' }} />
                Other
              </Typography>
              <Typography variant="h5" color="text.secondary" fontWeight="bold">
                ₹{totals.other.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totals.total > 0 ? Math.round((totals.other / totals.total) * 100) : 0}% of total
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterIcon sx={{ mr: 1 }} />
            Filters & Search
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, value) => value && setViewMode(value)}
            size="small"
          >
            <ToggleButton value="table">Table</ToggleButton>
            <ToggleButton value="cards">Cards</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <MobileFilters
          title="Expense Filters"
          filterCount={[searchQuery, typeFilter !== 'all' ? typeFilter : '', dateRange !== 'all' ? dateRange : ''].filter(v => v).length}
          onClearAll={() => {
            setSearchQuery('');
            setTypeFilter('all');
            setDateRange('all');
          }}
          activeFilters={{
            search: searchQuery,
            type: typeFilter !== 'all' ? typeFilter : '',
            dateRange: dateRange !== 'all' ? dateRange : ''
          }}
          onFilterRemove={(key) => {
            switch (key) {
              case 'search': setSearchQuery(''); break;
              case 'type': setTypeFilter('all'); break;
              case 'dateRange': setDateRange('all'); break;
            }
          }}
        >
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton onClick={() => setSearchQuery('')} size="small">
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              label="Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="electricity">Electricity</MenuItem>
              <MenuItem value="rent">Rent</MenuItem>
              <MenuItem value="maintenance">Maintenance</MenuItem>
              <MenuItem value="supplies">Supplies</MenuItem>
              <MenuItem value="internet">Internet</MenuItem>
              <MenuItem value="water">Water</MenuItem>
              <MenuItem value="cleaning">Cleaning</MenuItem>
              <MenuItem value="security">Security</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              label="Date Range"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="thisMonth">This Month</MenuItem>
              <MenuItem value="lastMonth">Last Month</MenuItem>
              <MenuItem value="last3Months">Last 3 Months</MenuItem>
              <MenuItem value="thisYear">This Year</MenuItem>
            </Select>
          </FormControl>
        </MobileFilters>

        {/* Filter Summary */}
        {(searchQuery || typeFilter !== 'all' || dateRange !== 'all') && (
          <Box sx={{ mt: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {filteredExpenses.length === 0 
                ? `No expenses found` 
                : `Found ${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? 's' : ''}`
              }
              {searchQuery && ` for "${searchQuery}"`}
              {typeFilter !== 'all' && ` in ${typeFilter}`}
              {dateRange !== 'all' && ` for ${dateRange.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Expenses List */}
      <Paper sx={{ p: isMobile ? 1 : 2 }}>
        <Typography variant={isMobile ? "h6" : "h5"} sx={{ mb: 2, fontWeight: 'bold' }}>
          Expense Details
        </Typography>
        {filteredExpenses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              {expenses.length === 0 ? 'No expenses recorded yet' : 'No expenses match your filters'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Add First Expense
            </Button>
          </Box>
        ) : viewMode === 'cards' || isMobile ? (
          // Card View
          <Box>
            {filteredExpenses.map((expense, index) => (
              <Card key={expense.id || index} sx={{ mb: 2, boxShadow: 2 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getTypeIcon(expense.type)}
                      <Chip 
                        label={expense.type?.charAt(0).toUpperCase() + expense.type?.slice(1) || 'N/A'}
                        color={getTypeColor(expense.type)}
                        size="small"
                      />
                    </Box>
                    <Typography variant="h6" color="error.main" fontWeight="bold">
                      ₹{Number(expense.amount || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarIcon sx={{ fontSize: 16 }} />
                    {expense.date ? new Date(expense.date).toLocaleDateString() : 'N/A'}
                  </Typography>
                  <Typography variant="body1">
                    {expense.description || 'No description'}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          // Table View
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortConfig.field === 'date'}
                    direction={sortConfig.direction}
                    onClick={() => handleSort('date')}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortConfig.field === 'type'}
                    direction={sortConfig.direction}
                    onClick={() => handleSort('type')}
                  >
                    Type
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortConfig.field === 'description'}
                    direction={sortConfig.direction}
                    onClick={() => handleSort('description')}
                  >
                    Description
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortConfig.field === 'amount'}
                    direction={sortConfig.direction}
                    onClick={() => handleSort('amount')}
                  >
                    Amount
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredExpenses.map((expense, index) => (
                <TableRow key={expense.id || index} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      {expense.date ? new Date(expense.date).toLocaleDateString() : 'N/A'}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getTypeIcon(expense.type)}
                      <Chip 
                        label={expense.type?.charAt(0).toUpperCase() + expense.type?.slice(1) || 'N/A'}
                        color={getTypeColor(expense.type)}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>{expense.description || 'No description'}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body1" fontWeight="bold" color="error.main">
                      ₹{Number(expense.amount || 0).toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
      {/* Add Expense Dialog */}
      <Dialog 
        open={addDialogOpen} 
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          color: 'white'
        }}>
          <AddIcon sx={{ mr: 1 }} />
          Add New Expense
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newExpense.type}
                  onChange={(e) => setNewExpense({ ...newExpense, type: e.target.value })}
                  label="Type"
                >
                  <MenuItem value="electricity">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ElectricityIcon sx={{ color: 'warning.main' }} />
                      Electricity
                    </Box>
                  </MenuItem>
                  <MenuItem value="rent">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RentIcon sx={{ color: 'primary.main' }} />
                      Rent
                    </Box>
                  </MenuItem>
                  <MenuItem value="maintenance">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ReceiptIcon sx={{ color: 'text.secondary' }} />
                      Maintenance
                    </Box>
                  </MenuItem>
                  <MenuItem value="supplies">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ReceiptIcon sx={{ color: 'text.secondary' }} />
                      Supplies
                    </Box>
                  </MenuItem>
                  <MenuItem value="internet">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ReceiptIcon sx={{ color: 'text.secondary' }} />
                      Internet
                    </Box>
                  </MenuItem>
                  <MenuItem value="water">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ReceiptIcon sx={{ color: 'text.secondary' }} />
                      Water
                    </Box>
                  </MenuItem>
                  <MenuItem value="cleaning">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ReceiptIcon sx={{ color: 'text.secondary' }} />
                      Cleaning
                    </Box>
                  </MenuItem>
                  <MenuItem value="security">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ReceiptIcon sx={{ color: 'text.secondary' }} />
                      Security
                    </Box>
                  </MenuItem>
                  <MenuItem value="other">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ReceiptIcon sx={{ color: 'text.secondary' }} />
                      Other
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                multiline
                rows={3}
                placeholder="Enter expense description..."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                }}
                placeholder="0.00"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleAddExpense} 
            variant="contained"
            disabled={!newExpense.description || !newExpense.amount}
            startIcon={<AddIcon />}
          >
            Add Expense
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="add expense"
          onClick={() => setAddDialogOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
        >
          <AddIcon />
        </Fab>
      )}
      
      <Footer />
    </Container>
  );
}

export default Expenses;
