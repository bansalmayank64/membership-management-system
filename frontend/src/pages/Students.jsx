import { useState, useEffect } from 'react';
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  TableContainer,
  Chip,
  TextField,
  Box,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Button,
  Menu,
  MenuItem,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Stack,
  TablePagination,
  useTheme,
  useMediaQuery,
  Collapse,
  Switch,
  FormControlLabel,
  Fab
} from '@mui/material';
import {
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Sort as SortIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Payment as PaymentIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  PersonOutline as PersonOutlineIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  AccountBalance as AccountBalanceIcon,
  CheckCircleOutline as ActiveIcon,
  ErrorOutline as InactiveIcon
} from '@mui/icons-material';
import { tableStyles, loadingStyles, errorStyles, pageStyles, cardStyles } from '../styles/commonStyles';
import PaymentHistory from '../components/PaymentHistory';
import { useTranslation } from 'react-i18next';

function Students() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Function to normalize gender values
  const normalizeGender = (value) => {
    if (!value) return '';
    const normalized = value.toString().toLowerCase();
    if (normalized === 'f' || normalized === 'female') return 'Female';
    if (normalized === 'm' || normalized === 'male') return 'Male';
    if (normalized === 'o' || normalized === 'other') return 'Other';
    return 'Other';
  };
  const [sortConfig, setSortConfig] = useState({ field: 'seatNumber', direction: 'asc' });
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showMale, setShowMale] = useState(true);
  const [showFemale, setShowFemale] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');
  const [newStudent, setNewStudent] = useState({
    name: '',
    seatNumber: '',
    contact: '',
    sex: '',
    fatherName: '',
  });
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 200);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    console.log('Fetching students...');
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL}?action=getStudents`);
      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('API Response:', result);
      console.log('First student in response:', result.data?.[0]);
      
      if (result.code === 400 || result.data?.error) {
        throw new Error(result.data?.error || 'Failed to fetch students');
      }
      
      const studentArray = Array.isArray(result.data) ? result.data : [];
      setStudents(studentArray);
    } catch (error) {
      console.error('Error fetching students:', error);
      setError(error.message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const isMembershipActive = (membershipTill) => {
    const today = new Date();
    const expiryDate = new Date(membershipTill);
    return today <= expiryDate;
  };

  const isMembershipExpiring = (membershipTill) => {
    const today = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(today.getDate() + 7);
    const expiryDate = new Date(membershipTill);
    return expiryDate <= oneWeekFromNow && expiryDate > today;
  };

  const calculateStats = () => {
    const total = students.length;
    const active = students.filter(s => isMembershipActive(s.membershipTill)).length; // Include expiring soon in active
    const expiring = students.filter(s => isMembershipExpiring(s.membershipTill)).length;
    const expired = students.filter(s => !isMembershipActive(s.membershipTill)).length;
    return { total, active, expiring, expired };
  };

  const getFilteredAndSortedStudents = () => {
    let filtered = students.filter(student => {
      // Search filter - limited to name, seat number, and contact only
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        matchesSearch = 
          String(student.name || '').toLowerCase().includes(query) ||
          String(student.contact || '').toLowerCase().includes(query) ||
          String(student.seatNumber || '').toLowerCase().includes(query);
      }

      // Status filter
      let matchesStatus = statusFilter === 'all';
      
      if (!matchesStatus) {
        switch (statusFilter) {
          case 'active':
            matchesStatus = isMembershipActive(student.membershipTill); // Include expiring soon in active
            break;
          case 'expiring':
            matchesStatus = isMembershipExpiring(student.membershipTill);
            break;
          case 'expired':
            matchesStatus = !isMembershipActive(student.membershipTill);
            break;
          default:
            matchesStatus = true;
        }
      }

      // Gender filter
      let matchesGender = false;
      const studentGender = normalizeGender(student.sex);
      
      if (studentGender === 'Male' && showMale) {
        matchesGender = true;
      } else if (studentGender === 'Female' && showFemale) {
        matchesGender = true;
      } else if (!studentGender || studentGender === 'N/A') {
        // Show students with unknown gender when both filters are on
        matchesGender = showMale && showFemale;
      }

      return matchesSearch && matchesStatus && matchesGender;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.field];
      let bValue = b[sortConfig.field];

      // Handle different data types
      if (sortConfig.field === 'seatNumber' || sortConfig.field === 'totalPaid') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else if (sortConfig.field === 'membershipTill' || sortConfig.field === 'lastPaymentDate') {
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

  const handleEditStudent = (student) => {
    setSelectedStudent(student);
    setEditDialogOpen(true);
  };

  const handleAddPayment = (student) => {
    setSelectedStudent(student);
    setPaymentDialogOpen(true);
  };

  const handleViewHistory = (student) => {
    setSelectedStudent(student);
    setPaymentHistoryOpen(true);
  };

  const handleDeleteStudent = (student) => {
    setSelectedStudent(student);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteStudent = async () => {
    if (!selectedStudent) return;
    
    try {
      const params = new URLSearchParams({
        action: 'deleteStudent',
        seatNumber: selectedStudent.seatNumber
      });
      
      const response = await fetch(`${import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL}?${params.toString()}`);
      
      const result = await response.json();
      
      if (result.code !== 200) {
        throw new Error(result.data?.error || 'Failed to delete student');
      }
      
      // Refresh students list
      fetchStudents();
      setDeleteConfirmOpen(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error deleting student:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleStatCardClick = (filterType) => {
    setStatusFilter(filterType);
  };

  const stats = calculateStats();
  const filteredStudents = getFilteredAndSortedStudents();
  
  // Calculate expiring timeline
  const getExpiringTimelineText = () => {
    const currentDate = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(currentDate.getDate() + 7);
    
    const expiringCount = students.filter(student => {
      const membershipDate = new Date(student.membershipTill);
      return membershipDate >= currentDate && membershipDate <= sevenDaysFromNow;
    }).length;
    
    return `${expiringCount} memberships expiring in next 7 days`;
  };
  
  // Pagination logic
  const paginatedStudents = filteredStudents.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Mobile card component for student data
  const StudentCard = ({ student }) => {
    const isActive = isMembershipActive(student.membershipTill);
    const isExpiring = isMembershipExpiring(student.membershipTill);
    let statusColor = 'error';
    let statusLabel = 'Expired';
    
    if (isActive && !isExpiring) {
      statusColor = 'success';
      statusLabel = 'Active';
    } else if (isExpiring) {
      statusColor = 'warning';
      statusLabel = 'Expiring Soon';
    }

    return (
      <Card sx={{ 
        mb: 2, 
        border: '1px solid #e0e0e0',
        '&:hover': { 
          boxShadow: 3,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                {student.name || 'N/A'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  ID: {student.id || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Seat: {student.seatNumber || 'N/A'}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={statusLabel}
              color={statusColor}
              size="small"
              sx={{ fontWeight: 500 }}
            />
          </Box>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Father's Name
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {student.fatherName || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Contact
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <PhoneIcon sx={{ color: 'text.secondary', fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {student.contact || 'N/A'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Total Paid
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <AccountBalanceIcon sx={{ color: 'success.main', fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  ₹{student.totalPaid || 0}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Gender
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                {normalizeGender(student.sex) === 'Male' ? (
                  <>
                    <MaleIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Male
                    </Typography>
                  </>
                ) : normalizeGender(student.sex) === 'Female' ? (
                  <>
                    <FemaleIcon sx={{ color: 'secondary.main', fontSize: 16 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Female
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    N/A
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Membership Till
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {student.membershipTill ? new Date(student.membershipTill).toLocaleDateString() : 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Last Payment
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {student.lastPaymentDate ? new Date(student.lastPaymentDate).toLocaleDateString() : 'N/A'}
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Tooltip title="Edit Student">
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditStudent(student);
                }}
                sx={{ color: 'primary.main' }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Add Payment">
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddPayment(student);
                }}
                sx={{ color: 'success.main' }}
              >
                <PaymentIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Payment History">
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewHistory(student);
                }}
                sx={{ color: 'info.main' }}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Student">
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStudent(student);
                }}
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>
    );

  };

  return (
    <Box sx={pageStyles.container}>
      <Container maxWidth="xl">
        {/* Search and Sorting Controls */}
        <Paper sx={{ p: isMobile ? 2 : 3, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Tooltip title={t('common.refresh')}>
                <IconButton onClick={fetchStudents} size="small" sx={{ 
                  border: 1, 
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' }
                }}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              
              {/* Add Student Button */}
              {!isMobile && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setAddDialogOpen(true)}
                  sx={{ ml: 1 }}
                >
                  Add Student
                </Button>
              )}
              
              {/* Clear Filters Button */}
              {(searchQuery || !showMale || !showFemale || statusFilter !== 'all') && (
                <Tooltip title="Clear all filters">
                  <IconButton 
                    onClick={() => {
                      setSearchQuery('');
                      setShowMale(true);
                      setShowFemale(true);
                      setStatusFilter('all');
                    }} 
                    size="small" 
                    sx={{ 
                      border: 1, 
                      borderColor: 'warning.main',
                      color: 'warning.main',
                      '&:hover': { bgcolor: 'warning.50' }
                    }}
                  >
                    <ClearIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {stats.expiring > 0 && (
                <Chip 
                  icon={<WarningIcon />}
                  label={getExpiringTimelineText()}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </Box>
            
            {/* Compact Statistics */}
            <Box sx={{ 
              display: 'flex', 
              gap: isMobile ? 1 : 1.5, 
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <Box 
                onClick={() => handleStatCardClick('all')}
                sx={{ 
                  cursor: 'pointer',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  p: isMobile ? 0.7 : 1,
                  borderRadius: 1,
                  bgcolor: statusFilter === 'all' ? 'primary.50' : 'transparent',
                  border: statusFilter === 'all' ? '1px solid' : 'none',
                  borderColor: statusFilter === 'all' ? 'primary.main' : 'transparent',
                  '&:hover': { bgcolor: statusFilter === 'all' ? 'primary.100' : 'action.hover' }
                }}
              >
                <PeopleIcon sx={{ fontSize: isMobile ? '0.9rem' : '1rem', color: 'primary.main' }} />
                <Typography variant={isMobile ? "caption" : "body2"} sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {stats.total}
                </Typography>
              </Box>
              
              <Box 
                onClick={() => handleStatCardClick('active')}
                sx={{ 
                  cursor: 'pointer',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  p: isMobile ? 0.7 : 1,
                  borderRadius: 1,
                  bgcolor: statusFilter === 'active' ? 'success.50' : 'transparent',
                  border: statusFilter === 'active' ? '1px solid' : 'none',
                  borderColor: statusFilter === 'active' ? 'success.main' : 'transparent',
                  '&:hover': { bgcolor: statusFilter === 'active' ? 'success.100' : 'action.hover' }
                }}
              >
                <CheckCircleIcon sx={{ fontSize: isMobile ? '0.9rem' : '1rem', color: 'success.main' }} />
                <Typography variant={isMobile ? "caption" : "body2"} sx={{ fontWeight: 600, color: 'success.main' }}>
                  {stats.active}
                </Typography>
              </Box>
              
              <Box 
                onClick={() => handleStatCardClick('expiring')}
                sx={{ 
                  cursor: 'pointer',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  p: isMobile ? 0.7 : 1,
                  borderRadius: 1,
                  bgcolor: statusFilter === 'expiring' ? 'warning.50' : 'transparent',
                  border: statusFilter === 'expiring' ? '1px solid' : 'none',
                  borderColor: statusFilter === 'expiring' ? 'warning.main' : 'transparent',
                  '&:hover': { bgcolor: statusFilter === 'expiring' ? 'warning.100' : 'action.hover' }
                }}
              >
                <WarningIcon sx={{ fontSize: isMobile ? '0.9rem' : '1rem', color: 'warning.main' }} />
                <Typography variant={isMobile ? "caption" : "body2"} sx={{ fontWeight: 600, color: 'warning.main' }}>
                  {stats.expiring}
                </Typography>
              </Box>
              
              <Box 
                onClick={() => handleStatCardClick('expired')}
                sx={{ 
                  cursor: 'pointer',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  p: isMobile ? 0.7 : 1,
                  borderRadius: 1,
                  bgcolor: statusFilter === 'expired' ? 'error.50' : 'transparent',
                  border: statusFilter === 'expired' ? '1px solid' : 'none',
                  borderColor: statusFilter === 'expired' ? 'error.main' : 'transparent',
                  '&:hover': { bgcolor: statusFilter === 'expired' ? 'error.100' : 'action.hover' }
                }}
              >
                <TrendingUpIcon sx={{ fontSize: isMobile ? '0.9rem' : '1rem', color: 'error.main' }} />
                <Typography variant={isMobile ? "caption" : "body2"} sx={{ fontWeight: 600, color: 'error.main' }}>
                  {stats.expired}
                </Typography>
              </Box>
            </Box>
          </Box>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search by name, seat number, or contact number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size={isMobile ? "small" : "medium"}
                InputProps={{
                  startAdornment: (
                    <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                  ),
                  endAdornment: searchQuery && (
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                      sx={{ color: 'text.secondary' }}
                    >
                      <ClearIcon />
                    </IconButton>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: isMobile ? 'flex-start' : 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Gender Filter Switches */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mr: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showMale}
                        onChange={(e) => setShowMale(e.target.checked)}
                        size="small"
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#1976d2',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#1976d2',
                            opacity: 0.5,
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon sx={{ 
                          fontSize: '1rem', 
                          color: showMale ? 'text.primary' : 'text.disabled',
                          opacity: showMale ? 0.8 : 0.5
                        }} />
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontSize: isMobile ? '0.8rem' : '0.875rem',
                            color: showMale ? 'text.primary' : 'text.secondary',
                            opacity: showMale ? 1 : 0.7
                          }}
                        >
                          Male
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showFemale}
                        onChange={(e) => setShowFemale(e.target.checked)}
                        size="small"
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#d32f2f',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#d32f2f',
                            opacity: 0.5,
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonOutlineIcon sx={{ 
                          fontSize: '1rem', 
                          color: showFemale ? 'text.primary' : 'text.disabled',
                          opacity: showFemale ? 0.8 : 0.5
                        }} />
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontSize: isMobile ? '0.8rem' : '0.875rem',
                            color: showFemale ? 'text.primary' : 'text.secondary',
                            opacity: showFemale ? 1 : 0.7
                          }}
                        >
                          Female
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
                
                <FormControl size={isMobile ? "small" : "medium"} sx={{ minWidth: 140 }}>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={sortConfig.field}
                    label="Sort By"
                    onChange={(e) => setSortConfig(prev => ({ ...prev, field: e.target.value }))}
                  >
                    <MenuItem value="id">Student ID</MenuItem>
                    <MenuItem value="seatNumber">Seat Number</MenuItem>
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="fatherName">Father Name</MenuItem>
                    <MenuItem value="membershipTill">Membership Till</MenuItem>
                    <MenuItem value="totalPaid">Total Paid</MenuItem>
                    <MenuItem value="lastPaymentDate">Last Payment</MenuItem>
                  </Select>
                </FormControl>
                <IconButton
                  onClick={() => setSortConfig(prev => ({ 
                    ...prev, 
                    direction: prev.direction === 'asc' ? 'desc' : 'asc' 
                  }))}
                  sx={{ 
                    border: 1, 
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  title={`Sort ${sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  <SortIcon sx={{ 
                    transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease'
                  }} />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
          
          {/* Search Results Info */}
          {(searchQuery || !showMale || !showFemale) && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {filteredStudents.length === 0 
                  ? `No students found` 
                  : `Found ${filteredStudents.length} student${filteredStudents.length !== 1 ? 's' : ''}`
                }
                {searchQuery && ` for "${searchQuery}"`}
                {!showMale && showFemale && ` (Female only)`}
                {showMale && !showFemale && ` (Male only)`}
              </Typography>
            </Box>
          )}
        </Paper>

        {loading && (
          <Paper sx={loadingStyles.container}>
            <CircularProgress sx={loadingStyles.progress} />
            <Typography sx={{ mt: 2 }}>Loading students...</Typography>
          </Paper>
        )}

        {error && (
          <Alert severity="error" sx={errorStyles.alert}>
            Error loading students: {error}
          </Alert>
        )}

        {!loading && !error && (
          <>
            {/* Desktop Table View */}
            {!isMobile && (
              <Paper sx={tableStyles.paper}>
                <TableContainer sx={tableStyles.tableContainer}>
                  <Table stickyHeader sx={tableStyles.table}>
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'id'}
                            direction={sortConfig.field === 'id' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('id')}
                          >
                            {t('students.id')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'seatNumber'}
                            direction={sortConfig.field === 'seatNumber' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('seatNumber')}
                          >
                            {t('students.seatNumber')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'name'}
                            direction={sortConfig.field === 'name' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('name')}
                          >
                            {t('students.name')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'fatherName'}
                            direction={sortConfig.field === 'fatherName' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('fatherName')}
                          >
                            {t('students.fatherName')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'membershipTill'}
                            direction={sortConfig.field === 'membershipTill' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('membershipTill')}
                          >
                            {t('common.status')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'membershipTill'}
                            direction={sortConfig.field === 'membershipTill' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('membershipTill')}
                          >
                            Membership Till
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'totalPaid'}
                            direction={sortConfig.field === 'totalPaid' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('totalPaid')}
                          >
                            {t('students.totalPaid')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          {t('students.contact')}
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'lastPaymentDate'}
                            direction={sortConfig.field === 'lastPaymentDate' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('lastPaymentDate')}
                          >
                            Last Payment
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                          <TableSortLabel
                            active={sortConfig.field === 'sex'}
                            direction={sortConfig.field === 'sex' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('sex')}
                          >
                            <Tooltip title="Gender">
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <MaleIcon sx={{ fontSize: 16 }} />
                                <FemaleIcon sx={{ fontSize: 16 }} />
                              </Box>
                            </Tooltip>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortConfig.field === 'membershipStartDate'}
                            direction={sortConfig.field === 'membershipStartDate' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('membershipStartDate')}
                          >
                            Start Date
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">{t('common.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                            <Typography variant="body1" color="text.secondary">
                              {statusFilter !== 'all' ? "No students found matching your search criteria" : "No students found"}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedStudents.map((student) => {
                          const isActive = isMembershipActive(student.membershipTill);
                          const isExpiring = isMembershipExpiring(student.membershipTill);
                          let statusColor = 'error';
                          let statusLabel = 'Expired';
                          
                          if (isActive && !isExpiring) {
                            statusColor = 'success';
                            statusLabel = 'Active';
                          } else if (isExpiring) {
                            statusColor = 'warning';
                            statusLabel = 'Expiring Soon';
                          }

                          return (
                            <TableRow
                              key={student.id || student.seatNumber}
                              sx={tableStyles.tableRow}
                            >
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {student.id || 'N/A'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {student.seatNumber || 'N/A'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {student.name || 'N/A'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {student.fatherName || 'N/A'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={statusLabel}
                                  color={statusColor}
                                  size="small"
                                  sx={tableStyles.statusChip}
                                />
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <CalendarIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                                  <Typography variant="body2" sx={{ fontSize: '13px' }}>
                                    {student.membershipTill ? new Date(student.membershipTill).toLocaleDateString() : 'N/A'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <AccountBalanceIcon sx={{ color: 'success.main', fontSize: 16 }} />
                                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '13px' }}>
                                    ₹{student.totalPaid || 0}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <PhoneIcon sx={{ color: 'text.secondary', fontSize: 16 }} />
                                  <Typography variant="body2" sx={{ fontSize: '13px' }}>
                                    {student.contact || 'N/A'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <CalendarIcon sx={{ color: 'text.secondary', fontSize: 16 }} />
                                  <Typography variant="body2" sx={{ fontSize: '13px' }}>
                                    {student.lastPaymentDate ? new Date(student.lastPaymentDate).toLocaleDateString() : 'N/A'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title={normalizeGender(student.sex) || 'N/A'}>
                                  {normalizeGender(student.sex) === 'Male' ? (
                                    <MaleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                  ) : normalizeGender(student.sex) === 'Female' ? (
                                    <FemaleIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                                  ) : (
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                      N/A
                                    </Typography>
                                  )}
                                </Tooltip>
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <CalendarIcon sx={{ color: 'info.main', fontSize: 16 }} />
                                  <Typography variant="body2" sx={{ fontSize: '13px' }}>
                                    {student.membershipStartDate ? new Date(student.membershipStartDate).toLocaleDateString() : 'N/A'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                  <Tooltip title="Edit Student">
                                    <IconButton 
                                      size="small" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditStudent(student);
                                      }}
                                      sx={{ color: 'primary.main' }}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Add Payment">
                                    <IconButton 
                                      size="small" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddPayment(student);
                                      }}
                                      sx={{ color: 'success.main' }}
                                    >
                                      <PaymentIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Payment History">
                                    <IconButton 
                                      size="small" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewHistory(student);
                                      }}
                                      sx={{ color: 'info.main' }}
                                    >
                                      <HistoryIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete Student">
                                    <IconButton 
                                      size="small" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteStudent(student);
                                      }}
                                      sx={{ color: 'error.main' }}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                {/* Desktop Pagination */}
                <TablePagination
                  component="div"
                  count={filteredStudents.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[50, 100, 200, 500]}
                  labelRowsPerPage={t('common.rowsPerPage')}
                  sx={{ borderTop: 1, borderColor: 'divider' }}
                />
              </Paper>
            )}

            {/* Mobile Card View */}
            {isMobile && (
              <Box>
                {/* Mobile Sort Indicator */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Sorted by {sortConfig.field === 'id' ? 'Student ID' :
                                sortConfig.field === 'seatNumber' ? 'Seat Number' : 
                                sortConfig.field === 'fatherName' ? 'Father Name' :
                                sortConfig.field === 'membershipTill' ? 'Membership Till' : 
                                sortConfig.field === 'totalPaid' ? 'Total Paid' : 
                                sortConfig.field === 'lastPaymentDate' ? 'Last Payment' : 'Name'} 
                      ({sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'})
                    </Typography>
                    <SortIcon sx={{ 
                      transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'none',
                      color: 'text.secondary',
                      fontSize: '1rem'
                    }} />
                  </Box>
                </Paper>

                {paginatedStudents.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                      {statusFilter !== 'all' || searchQuery ? "No students found matching your criteria" : "No students found"}
                    </Typography>
                  </Paper>
                ) : (
                  paginatedStudents.map((student) => (
                    <StudentCard key={student.id || student.seatNumber} student={student} />
                  ))
                )}
                
                {/* Mobile Pagination */}
                <Paper sx={{ mt: 2 }}>
                  <TablePagination
                    component="div"
                    count={filteredStudents.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={isSmallScreen ? [5, 10, 25] : [10, 25, 50]}
                    labelRowsPerPage={isSmallScreen ? "Per page:" : t('common.rowsPerPage')}
                  />
                </Paper>
              </Box>
            )}
          </>
        )}
      </Container>

      {/* Edit Student Dialog */}
      <EditStudentDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        student={selectedStudent}
        onSave={fetchStudents}
      />

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        student={selectedStudent}
        onSave={fetchStudents}
      />

      {/* Payment History Dialog */}
      <PaymentHistory
        open={paymentHistoryOpen}
        onClose={() => setPaymentHistoryOpen(false)}
        student={selectedStudent}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete student "{selectedStudent?.name}" (Seat: {selectedStudent?.seatNumber})?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteStudent} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Student</DialogTitle>
        <DialogContent>
          {addStudentError && (
            <Alert severity="error" sx={{ mb: 2 }}>{addStudentError}</Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Student Name"
                value={newStudent.name}
                onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Seat Number"
                value={newStudent.seatNumber}
                onChange={e => setNewStudent({ ...newStudent, seatNumber: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Number"
                value={newStudent.contact}
                onChange={e => setNewStudent({ ...newStudent, contact: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={newStudent.sex}
                  label="Gender"
                  onChange={e => setNewStudent({ ...newStudent, sex: e.target.value })}
                  required
                >
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Father's Name (optional)"
                value={newStudent.fatherName}
                onChange={e => setNewStudent({ ...newStudent, fatherName: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              setAddStudentLoading(true);
              setAddStudentError('');
              try {
                const params = new URLSearchParams({
                  action: 'addStudent',
                  name: newStudent.name,
                  seatNumber: newStudent.seatNumber,
                  contact: newStudent.contact,
                  sex: newStudent.sex,
                  fatherName: newStudent.fatherName,
                });
                const response = await fetch(`${import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL}?${params.toString()}`);
                const result = await response.json();
                if (result.code !== 200) {
                  throw new Error(result.data?.error || 'Failed to add student');
                }
                setAddDialogOpen(false);
                setNewStudent({ name: '', seatNumber: '', contact: '', sex: '', fatherName: '' });
                fetchStudents();
              } catch (err) {
                setAddStudentError(err.message);
              } finally {
                setAddStudentLoading(false);
              }
            }}
            variant="contained"
            disabled={addStudentLoading || !newStudent.name || !newStudent.seatNumber || !newStudent.contact || !newStudent.sex}
            startIcon={addStudentLoading ? <CircularProgress size={16} /> : <AddIcon />}
          >
            Add Student
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Edit Student Dialog Component
function EditStudentDialog({ open, onClose, student, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    sex: '',
    membershipStatus: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to normalize gender values
  const normalizeGender = (value) => {
    if (!value) return '';
    const normalized = value.toString().toLowerCase();
    if (normalized === 'f' || normalized === 'female') return 'Female';
    if (normalized === 'm' || normalized === 'male') return 'Male';
    if (normalized === 'o' || normalized === 'other') return 'Other';
    return 'Other';
  };

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name || '',
        contact: student.contact || '',
        sex: normalizeGender(student.sex),
        membershipStatus: student.membershipStatus || ''
      });
    }
  }, [student]);

  const handleSave = async () => {
    if (!student) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'updateStudent',
          seatNumber: student.seatNumber,
          ...formData
        })
      });
      
      const result = await response.json();
      
      if (result.code !== 200) {
        throw new Error(result.data?.error || 'Failed to update student');
      }
      
      onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Student Details</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Student Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Contact Number"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={formData.sex}
                label="Gender"
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
              >
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Add Payment Dialog Component
function AddPaymentDialog({ open, onClose, student, onSave }) {
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
    type: 'payment', // 'payment', 'refund', or 'extend'
    months: '1', // for membership extension
    reason: '' // for membership extension
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!student) return;
    
    // Validation based on type
    if (formData.type === 'extend') {
      if (!formData.months || formData.months < 1) {
        setError('Please specify number of months to extend');
        return;
      }
    } else {
      if (!formData.amount) {
        setError('Please enter an amount');
        return;
      }
    }
    
    setLoading(true);
    setError('');
    
    try {
      let actionType, params;
      
      if (formData.type === 'extend') {
        actionType = 'extendMembership';
        params = new URLSearchParams({
          action: actionType,
          seatNumber: student.seatNumber,
          months: parseInt(formData.months),
          date: formData.date,
          reason: formData.reason || 'Manual extension'
        });
      } else {
        actionType = formData.type === 'refund' ? 'addRefund' : 'addPayment';
        params = new URLSearchParams({
          action: actionType,
          seatNumber: student.seatNumber,
          amount: parseFloat(formData.amount),
          date: formData.date,
          paymentMode: formData.paymentMode,
          type: formData.type
        });
      }
      
      const response = await fetch(`${import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL}?${params.toString()}`);
      
      const result = await response.json();
      
      if (result.code !== 200) {
        throw new Error(result.data?.error || `Failed to ${formData.type === 'extend' ? 'extend membership' : 'add payment'}`);
      }
      
      onSave();
      onClose();
      setFormData({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'Cash',
        type: 'payment',
        months: '1',
        reason: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDialogTitle = () => {
    switch (formData.type) {
      case 'refund': return 'Add Refund';
      case 'extend': return 'Extend Membership';
      default: return 'Add Payment';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {getDialogTitle()} for {student?.name}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <MenuItem value="payment">
                  <Box display="flex" alignItems="center" gap={1}>
                    <PaymentIcon fontSize="small" />
                    Payment
                  </Box>
                </MenuItem>
                <MenuItem value="refund">
                  <Box display="flex" alignItems="center" gap={1}>
                    <PaymentIcon fontSize="small" color="error" />
                    Refund
                  </Box>
                </MenuItem>
                <MenuItem value="extend">
                  <Box display="flex" alignItems="center" gap={1}>
                    <ScheduleIcon fontSize="small" color="primary" />
                    Extend Membership
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Payment/Refund Fields */}
          {formData.type !== 'extend' && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Amount (₹)"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={formData.paymentMode}
                    label="Payment Mode"
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  >
                    <MenuItem value="Cash">Cash</MenuItem>
                    <MenuItem value="Online">Online</MenuItem>
                    <MenuItem value="Card">Card</MenuItem>
                    <MenuItem value="UPI">UPI</MenuItem>
                    <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
          
          {/* Membership Extension Fields */}
          {formData.type === 'extend' && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Extend by (months)"
                  type="number"
                  value={formData.months}
                  onChange={(e) => setFormData({ ...formData, months: e.target.value })}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Reason (optional)"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Complimentary extension"
                />
              </Grid>
            </>
          )}
          
          <Grid item xs={12} sm={formData.type === 'extend' ? 12 : 6}>
            <TextField
              fullWidth
              label={formData.type === 'extend' ? 'Extension Date' : 'Payment Date'}
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={loading || (formData.type === 'extend' ? !formData.months : !formData.amount)}
          startIcon={loading ? <CircularProgress size={16} /> : null}
          color={formData.type === 'refund' ? 'error' : 'primary'}
        >
          {formData.type === 'refund' ? 'Add Refund' : 
           formData.type === 'extend' ? 'Extend Membership' : 'Add Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default Students;
