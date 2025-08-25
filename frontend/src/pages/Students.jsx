import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Box,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  useTheme,
  useMediaQuery,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Snackbar,
  Paper,
  MenuItem,
  Chip,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  Avatar,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Payment as PaymentIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  Phone as PhoneIcon,
  EventSeat as EventSeatIcon,
  TableView as TableViewIcon,
  Close as CloseIcon,
  PersonOutline as PersonOutlineIcon,
  AccessTime as AccessTimeIcon,
  CalendarMonth as CalendarMonthIcon
} from '@mui/icons-material';
import { pageStyles, cardStyles } from '../styles/commonStyles';
import { useTranslation } from 'react-i18next';
import { getSeatChartData, markSeatAsVacant } from '../services/api';

// Seat colors for the chart
const seatColors = {
  occupied: {
    male: {
      primary: '#1976d2',
      secondary: '#42a5f5',
      gradient: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)'
    },
    female: {
      primary: '#e91e63',
      secondary: '#f06292',
      gradient: 'linear-gradient(135deg, #e91e63 0%, #f06292 100%)'
    }
  },
  vacant: {
    primary: '#f5f5f5',
    secondary: '#e0e0e0',
    gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)'
  },
  expiring: {
    male: {
      primary: '#ff9800',
      secondary: '#ffb74d',
      gradient: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)'
    },
    female: {
      primary: '#ff5722',
      secondary: '#ff8a65',
      gradient: 'linear-gradient(135deg, #ff5722 0%, #ff8a65 100%)'
    }
  },
  removed: {
    primary: '#bdbdbd',
    secondary: '#9e9e9e',
    gradient: 'linear-gradient(135deg, #bdbdbd 0%, #9e9e9e 100%)'
  }
};

function Students() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [students, setStudents] = useState([]);
  const [unassignedSeats, setUnassignedSeats] = useState([]);
  const [seatData, setSeatData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // View mode state
  const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'table'
  const [showUnassignedSeats, setShowUnassignedSeats] = useState(true);
  
  // Separate search filters
  const [nameSearch, setNameSearch] = useState('');
  const [seatSearch, setSeatSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [showMale, setShowMale] = useState(true);
  const [showFemale, setShowFemale] = useState(true);
  
  // Dialog states
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [seatHistoryOpen, setSeatHistoryOpen] = useState(false);
  const [seatHistoryData, setSeatHistoryData] = useState([]);
  const [seatHistoryLoading, setSeatHistoryLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  
  // Add student form state
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');
  const [newStudent, setNewStudent] = useState({
    name: '',
    seatNumber: '',
    contact: '',
    sex: '',
    fatherName: '',
  });

  // Payment form state
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [newPayment, setNewPayment] = useState({
    amount: '',
    paymentMode: 'cash',
    remarks: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    console.log('🔄 === FETCH DATA START ===');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    setLoading(true);
    setError(null);
    try {
      console.log('🚀 Step 1: Fetching students, unassigned seats, and seat chart data...');
      
      // Fetch students with unassigned seats and seat chart data
      const [studentsWithSeatsResponse, seatChartData] = await Promise.all([
  fetch(`/api/students/with-unassigned-seats`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }),
        getSeatChartData()
      ]);
      
      console.log('📡 Students with seats API response status:', studentsWithSeatsResponse.status);
      
      if (!studentsWithSeatsResponse.ok) {
        const errorText = await studentsWithSeatsResponse.text();
        console.error('❌ Students with seats API error response:', errorText);
        throw new Error(`Students API error! status: ${studentsWithSeatsResponse.status} - ${errorText}`);
      }
      
      const studentsWithSeatsData = await studentsWithSeatsResponse.json();
      console.log('✅ Step 2: Students with seats data received:', studentsWithSeatsData);
      console.log('✅ Step 3: Seat chart data received:', seatChartData.length, 'seats');
      
      setStudents(studentsWithSeatsData.students || []);
      setUnassignedSeats(studentsWithSeatsData.unassignedSeats || []);
      setSeatData(seatChartData);
      
      console.log('📊 Data summary:', {
        students: studentsWithSeatsData.students?.length || 0,
        unassignedSeats: studentsWithSeatsData.unassignedSeats?.length || 0,
        seatChartData: seatChartData.length
      });
      
      console.log('🎉 === FETCH DATA SUCCESS ===');
    } catch (error) {
      console.error('💥 === FETCH DATA ERROR ===');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📄 Error message:', error.message);
      console.error('📍 Error stack:', error.stack);
      console.error('🌐 Network error details:', {
  url: `/api/students/with-unassigned-seats`,
        headers: {
          'Authorization': localStorage.getItem('authToken') ? 'Bearer [TOKEN_PRESENT]' : '[NO_TOKEN]',
          'Content-Type': 'application/json'
        }
      });
      
      setError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
      console.log('🏁 Fetch data operation completed');
    }
  };

  // Function to fetch seat history
  const fetchSeatHistory = async (seatNumber) => {
    console.log('🔄 === FETCH SEAT HISTORY START ===');
    console.log('🪑 Seat Number:', seatNumber);
    console.log('📅 Timestamp:', new Date().toISOString());
    
    setSeatHistoryLoading(true);
    try {
      console.log('🚀 Making API request to fetch seat history...');
      
  const response = await fetch(`/api/seats/${seatNumber}/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Seat history API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Seat history API error response:', errorText);
        throw new Error(`Seat history API error! status: ${response.status} - ${errorText}`);
      }
      
      const historyData = await response.json();
      console.log('✅ Seat history data received:', historyData.length, 'records');
      console.log('📊 History data:', historyData);
      
      setSeatHistoryData(historyData);
      console.log('🎉 === FETCH SEAT HISTORY SUCCESS ===');
    } catch (error) {
      console.error('💥 === FETCH SEAT HISTORY ERROR ===');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📄 Error message:', error.message);
      console.error('📍 Error stack:', error.stack);
      console.error('🌐 Request details:', {
  url: `/api/seats/${seatNumber}/history`,
        seatNumber: seatNumber
      });
      
      setSnackbarMessage(`Error fetching seat history: ${error.message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setSeatHistoryLoading(false);
      console.log('🏁 Fetch seat history operation completed');
    }
  };

  // Utility functions
  const normalizeGender = (value) => {
    if (!value) return '';
    const normalized = value.toString().toLowerCase();
    if (normalized === 'f' || normalized === 'female') return 'Female';
    if (normalized === 'm' || normalized === 'male') return 'Male';
    return 'Unknown'; // Changed from 'Other' to 'Unknown'
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

  // Filter functions
  const getFilteredSeatData = () => {
    return seatData.filter(seat => {
      // Name filter
      if (nameSearch.trim() && seat.studentName) {
        if (!seat.studentName.toLowerCase().includes(nameSearch.toLowerCase().trim())) {
          return false;
        }
      } else if (nameSearch.trim() && !seat.studentName) {
        return false;
      }

      // Seat number filter
      if (seatSearch.trim()) {
        if (!seat.seatNumber.toLowerCase().includes(seatSearch.toLowerCase().trim())) {
          return false;
        }
      }

      // Contact filter
      if (contactSearch.trim() && seat.contactNumber) {
        if (!seat.contactNumber.toLowerCase().includes(contactSearch.toLowerCase().trim())) {
          return false;
        }
      } else if (contactSearch.trim() && !seat.contactNumber) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        switch (statusFilter) {
          case 'active':
            if (!seat.occupied || !isMembershipActive(seat.membershipExpiry)) return false;
            break;
          case 'expiring':
            if (!seat.occupied || !isMembershipExpiring(seat.membershipExpiry)) return false;
            break;
          case 'expired':
            if (!seat.occupied || isMembershipActive(seat.membershipExpiry)) return false;
            break;
          case 'vacant':
            if (seat.occupied) return false;
            break;
        }
      }

      // Gender filter
      if (seat.occupied && seat.gender) {
        const gender = normalizeGender(seat.gender);
        if (gender === 'Male' && !showMale) return false;
        if (gender === 'Female' && !showFemale) return false;
      }

      return true;
    });
  };

  const getSeatColor = (seat) => {
    if (seat.removed) {
      return seatColors.removed.gradient;
    }
    
    if (!seat.occupied) {
      return seatColors.vacant.gradient;
    }
    
    const gender = normalizeGender(seat.gender);
    const isExpiring = seat.expiring;
    
    if (isExpiring) {
      return gender === 'Male' ? seatColors.expiring.male.gradient : seatColors.expiring.female.gradient;
    }
    
    return gender === 'Male' ? seatColors.occupied.male.gradient : seatColors.occupied.female.gradient;
  };

  const handleSeatClick = (seat) => {
    setSelectedSeat(seat);
    if (seat.occupied && seat.studentName) {
      // Find the full student data
      const studentData = students.find(s => s.name === seat.studentName);
      setSelectedStudent(studentData);
    }
  };

  const handleSeatHistoryClick = (seat) => {
    fetchSeatHistory(seat.seatNumber);
    setSeatHistoryOpen(true);
  };

  const clearAllFilters = () => {
    setNameSearch('');
    setSeatSearch('');
    setContactSearch('');
    setStatusFilter('all');
    setShowMale(true);
    setShowFemale(true);
  };

  // Handle marking expired seat as vacant
  const handleMarkVacant = async () => {
    if (!selectedSeat || !selectedStudent) return;
    
    try {
      setLoading(true);
      console.log('🔄 Marking seat as vacant:', selectedSeat.seatNumber);
      
      await markSeatAsVacant(selectedSeat.seatNumber);
      
      // Refresh data to show updated status
      await fetchData();
      
      // Close dialogs and clear selections
      setSelectedSeat(null);
      setSelectedStudent(null);
      
      // Show success notification
      setSnackbarMessage(`Seat ${selectedSeat.seatNumber} marked as vacant successfully`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      console.log('✅ Seat marked as vacant successfully');
    } catch (error) {
      console.error('❌ Error marking seat as vacant:', error);
      setSnackbarMessage(`Failed to mark seat as vacant: ${error.message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Statistics calculation
  const calculateStats = () => {
    const total = seatData.length;
    const occupied = seatData.filter(seat => seat.occupied).length;
    const vacant = total - occupied;
    const expiring = seatData.filter(seat => seat.occupied && seat.expiring).length;
    const male = seatData.filter(seat => seat.occupied && normalizeGender(seat.gender) === 'Male').length;
    const female = seatData.filter(seat => seat.occupied && normalizeGender(seat.gender) === 'Female').length;
    const studentsWithoutSeats = students.filter(student => !student.assigned_seat || student.assigned_seat === 'UNASSIGNED').length;
    const availableSeats = unassignedSeats.length;
    
    return { 
      total, 
      occupied, 
      vacant, 
      expiring, 
      male, 
      female, 
      studentsWithoutSeats,
      availableSeats,
      totalStudents: students.length
    };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={pageStyles?.container || {}}>
        <Container maxWidth="xl">
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        </Container>
      </Box>
    );
  }

  const stats = calculateStats();
  const filteredSeats = getFilteredSeatData();

  return (
    <Box sx={pageStyles?.container || {}}>
      <Container maxWidth="xl">
        {/* Header with view toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" gutterBottom>
            🎯 Study Room Management
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={fetchData} size="small" sx={{ border: 1, borderColor: 'divider' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Student
            </Button>
          </Box>
        </Box>

        {/* View Mode Toggle */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Tabs
            value={viewMode}
            onChange={(e, newValue) => setViewMode(newValue)}
            centered
            sx={{ mb: 2 }}
          >
            <Tab
              label="🪑 Seat Chart View"
              value="chart"
              icon={<EventSeatIcon />}
              iconPosition="start"
            />
            <Tab
              label="📋 Students Table"
              value="table"
              icon={<TableViewIcon />}
              iconPosition="start"
            />
            <Tab
              label="🔓 Available Seats"
              value="unassigned"
              icon={<PersonOutlineIcon />}
              iconPosition="start"
            />
          </Tabs>
          
          {/* Show/Hide Unassigned Seats Toggle for Chart View */}
          {viewMode === 'chart' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showUnassignedSeats}
                    onChange={(e) => setShowUnassignedSeats(e.target.checked)}
                    color="primary"
                  />
                }
                label="Show Available Seats in Chart"
              />
            </Box>
          )}
        </Paper>

        {/* Statistics Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={2}>
            <Card sx={cardStyles?.base || {}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary">
                  {stats.totalStudents}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Students
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card sx={cardStyles?.base || {}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="success.main">
                  {stats.occupied}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Assigned Seats
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card sx={cardStyles?.base || {}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="info.main">
                  {stats.availableSeats}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available Seats
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card sx={cardStyles?.base || {}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="warning.main">
                  {stats.expiring}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Expiring Soon
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card sx={cardStyles?.base || {}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="error.main">
                  {stats.studentsWithoutSeats}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Unassigned Students
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card sx={cardStyles?.base || {}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="text.primary">
                  {stats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Seats
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filter Section */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🎯 Enhanced Filters (3 Separate Search Fields)
          </Typography>
          <Grid container spacing={2} alignItems="center">
            {/* Name Filter */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search by Name"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
                  endAdornment: nameSearch && (
                    <IconButton size="small" onClick={() => setNameSearch('')}>
                      <ClearIcon />
                    </IconButton>
                  )
                }}
              />
            </Grid>

            {/* Seat Number Filter */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search by Seat Number"
                value={seatSearch}
                onChange={(e) => setSeatSearch(e.target.value)}
                InputProps={{
                  startAdornment: <EventSeatIcon sx={{ color: 'action.active', mr: 1 }} />,
                  endAdornment: seatSearch && (
                    <IconButton size="small" onClick={() => setSeatSearch('')}>
                      <ClearIcon />
                    </IconButton>
                  )
                }}
              />
            </Grid>

            {/* Contact Filter */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search by Contact"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                InputProps={{
                  startAdornment: <PhoneIcon sx={{ color: 'action.active', mr: 1 }} />,
                  endAdornment: contactSearch && (
                    <IconButton size="small" onClick={() => setContactSearch('')}>
                      <ClearIcon />
                    </IconButton>
                  )
                }}
              />
            </Grid>

            {/* Status Filter */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="expiring">Expiring Soon</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                  <MenuItem value="vacant">Vacant</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Gender Filters */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showMale}
                    onChange={(e) => setShowMale(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MaleIcon color="primary" />
                    Male
                  </Box>
                }
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showFemale}
                    onChange={(e) => setShowFemale(e.target.checked)}
                    color="secondary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FemaleIcon color="secondary" />
                    Female
                  </Box>
                }
              />
            </Grid>

            {/* Clear Filters */}
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                onClick={clearAllFilters}
                startIcon={<ClearIcon />}
                fullWidth
              >
                Clear All Filters
              </Button>
            </Grid>

            {/* Filter Results Count */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredSeats.length} of {seatData.length} seats
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Main Content */}
        {viewMode === 'chart' ? (
          <SeatChartView
            seats={filteredSeats}
            unassignedSeats={showUnassignedSeats ? unassignedSeats : []}
            onSeatClick={handleSeatClick}
            onSeatHistoryClick={handleSeatHistoryClick}
            getSeatColor={getSeatColor}
            isMobile={isMobile}
          />
        ) : viewMode === 'table' ? (
          <TableView
            seats={filteredSeats}
            onSeatClick={handleSeatClick}
            onSeatHistoryClick={handleSeatHistoryClick}
            normalizeGender={normalizeGender}
            isMembershipActive={isMembershipActive}
            isMobile={isMobile}
          />
        ) : (
          <UnassignedSeatsView
            unassignedSeats={unassignedSeats}
            students={students}
            onSeatClick={handleSeatClick}
            onSeatHistoryClick={handleSeatHistoryClick}
            isMobile={isMobile}
          />
        )}

        {/* Add Student Dialog */}
        <AddStudentDialog
          open={addDialogOpen}
          onClose={() => {
            setAddDialogOpen(false);
            setNewStudent({ name: '', seatNumber: '', contact: '', sex: '', fatherName: '' });
            setAddStudentError('');
          }}
          student={newStudent}
          setStudent={setNewStudent}
          loading={addStudentLoading}
          error={addStudentError}
          seatData={seatData}
          unassignedSeats={unassignedSeats}
          onSubmit={async () => {
            console.log('🔄 === ADD STUDENT START ===');
            console.log('📅 Timestamp:', new Date().toISOString());
            console.log('👤 Student data to submit:', newStudent);
            
            setAddStudentLoading(true);
            setAddStudentError('');
            try {
              console.log('🚀 Step 1: Preparing student data...');
              
              const studentData = {
                seat_number: newStudent.seatNumber,
                name: newStudent.name,
                father_name: newStudent.fatherName,
                contact_number: newStudent.contact,
                sex: newStudent.sex.toLowerCase(),
                membership_till: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                modified_by: 1
              };
              
              console.log('📝 Prepared student data:', studentData);
              console.log('🚀 Step 2: Making API request...');
              
              const response = await fetch(`/api/students`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(studentData)
              });
              
              console.log('📡 Add student API response status:', response.status);
              
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('❌ Add student API error response:', errorData);
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
              }
              
              const result = await response.json();
              console.log('✅ Student added successfully:', result);
              
              setAddDialogOpen(false);
              setNewStudent({ name: '', seatNumber: '', contact: '', sex: '', fatherName: '' });
              
              console.log('🔄 Step 3: Refreshing data...');
              fetchData();
              
              setSnackbarMessage('Student added successfully');
              setSnackbarSeverity('success');
              setSnackbarOpen(true);
              
              console.log('🎉 === ADD STUDENT SUCCESS ===');
            } catch (err) {
              console.error('💥 === ADD STUDENT ERROR ===');
              console.error('🔍 Error type:', err.constructor.name);
              console.error('📄 Error message:', err.message);
              console.error('📍 Error stack:', err.stack);
              console.error('📤 Request payload:', {
                url: `/api/students`,
                method: 'POST',
                studentData: newStudent
              });
              
              setAddStudentError(err.message);
            } finally {
              setAddStudentLoading(false);
              console.log('🏁 Add student operation completed');
            }
          }}
        />

        {/* Payment Dialog */}
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setNewPayment({ amount: '', paymentMode: 'cash', remarks: '', paymentDate: new Date().toISOString().split('T')[0] });
            setPaymentError('');
          }}
          student={selectedStudent}
          payment={newPayment}
          setPayment={setNewPayment}
          loading={paymentLoading}
          error={paymentError}
          onSubmit={async () => {
            console.log('🔥 Payment submission started');
            console.log('Selected Student:', selectedStudent);
            console.log('Payment Data:', newPayment);
            
            setPaymentLoading(true);
            setPaymentError('');
            try {
              if (!selectedStudent?.id) {
                throw new Error('No student selected for payment');
              }

              const paymentData = {
                student_id: selectedStudent.id,
                amount: parseFloat(newPayment.amount),
                payment_date: newPayment.paymentDate,
                payment_mode: newPayment.paymentMode.toUpperCase(),
                remarks: newPayment.remarks || '',
                modified_by: 1
              };
              
              console.log('🚀 Sending payment request:', paymentData);
              
              const response = await fetch(`/api/payments`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentData)
              });
              
              console.log('📡 Response status:', response.status);
              
              if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Payment error response:', errorData);
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
              }
              
              const result = await response.json();
              console.log('✅ Payment success result:', result);
              
              setPaymentDialogOpen(false);
              setNewPayment({ amount: '', paymentMode: 'cash', remarks: '', paymentDate: new Date().toISOString().split('T')[0] });
              fetchData(); // Refresh data
              setSnackbarMessage('Payment added successfully');
              setSnackbarSeverity('success');
              setSnackbarOpen(true);
            } catch (err) {
              console.error('💥 Payment submission error:', err);
              setPaymentError(err.message);
            } finally {
              setPaymentLoading(false);
            }
          }}
        />

        {/* Seat Detail Dialog */}
        <SeatDetailDialog
          open={Boolean(selectedSeat)}
          seat={selectedSeat}
          student={selectedStudent}
          onClose={() => {
            setSelectedSeat(null);
            setSelectedStudent(null);
          }}
          onEdit={() => setEditDialogOpen(true)}
          onPayment={() => setPaymentDialogOpen(true)}
          onHistory={() => handleSeatHistoryClick(selectedSeat)}
          onDelete={() => setDeleteConfirmOpen(true)}
          onMarkVacant={handleMarkVacant}
        />

        {/* Seat History Dialog */}
        <SeatHistoryDialog
          open={seatHistoryOpen}
          onClose={() => setSeatHistoryOpen(false)}
          seatNumber={selectedSeat?.seatNumber}
          historyData={seatHistoryData}
          loading={seatHistoryLoading}
        />

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}

// Seat Chart View Component
function SeatChartView({ seats, unassignedSeats, onSeatClick, onSeatHistoryClick, getSeatColor, isMobile }) {
  const seatSize = isMobile ? 40 : 50;
  const seatsPerRow = isMobile ? 8 : 12;
  
  // Combine assigned seats and unassigned seats for display
  const allSeats = [...seats];
  
  // Add unassigned seats to the display if they're being shown
  if (unassignedSeats && unassignedSeats.length > 0) {
    const unassignedSeatDisplay = unassignedSeats.map(seat => ({
      seatNumber: seat.seat_number,
      occupied: false,
      studentName: null,
      gender: null,
      studentId: null,
      contactNumber: null,
      membershipExpiry: null,
      lastPayment: null,
      expiring: false,
      removed: false,
      maintenance: false,
      isUnassigned: true
    }));
    allSeats.push(...unassignedSeatDisplay);
  }
  
  // Sort seats by seat number for consistent display
  allSeats.sort((a, b) => {
    const aNum = parseInt(a.seatNumber);
    const bNum = parseInt(b.seatNumber);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.seatNumber.localeCompare(b.seatNumber);
  });
  
  const rows = [];
  for (let i = 0; i < allSeats.length; i += seatsPerRow) {
    rows.push(allSeats.slice(i, i + seatsPerRow));
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        🪑 Interactive Seat Chart {unassignedSeats && unassignedSeats.length > 0 && `(Including ${unassignedSeats.length} Available Seats)`}
      </Typography>
      
      {/* Legend */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, justifyContent: 'center' }}>
        <Chip icon={<MaleIcon />} label="Male Occupied" sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', color: 'white' }} />
        <Chip icon={<FemaleIcon />} label="Female Occupied" sx={{ background: 'linear-gradient(135deg, #e91e63 0%, #f06292 100%)', color: 'white' }} />
        <Chip icon={<WarningIcon />} label="Expiring Soon" sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)', color: 'white' }} />
        <Chip icon={<PersonOutlineIcon />} label="Available" sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)', color: 'white' }} />
        <Chip icon={<EventSeatIcon />} label="Vacant (Assigned)" sx={{ background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)', color: 'black' }} />
      </Box>

      {/* Instructions */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>💡 Interactive Features:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>🖱️ <strong>Left click</strong> a seat to view student details</li>
          <li>🖱️ <strong>Right click</strong> a seat to view change history</li>
          <li>🎨 <strong>Green seats</strong> are available for assignment</li>
          <li>🎨 Colors indicate gender and membership status</li>
        </ul>
      </Alert>

      {/* Seat Grid */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
        {rows.map((row, rowIndex) => (
          <Box key={rowIndex} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            {row.map((seat) => (
              <Tooltip
                key={seat.seatNumber}
                title={
                  <Box>
                    <Typography variant="body2">Seat: {seat.seatNumber}</Typography>
                    {seat.occupied ? (
                      <>
                        <Typography variant="body2">Student: {seat.studentName}</Typography>
                        <Typography variant="body2">Contact: {seat.contactNumber}</Typography>
                        <Typography variant="body2">
                          Expires: {seat.membershipExpiry ? new Date(seat.membershipExpiry).toLocaleDateString() : 'N/A'}
                        </Typography>
                      </>
                    ) : seat.isUnassigned ? (
                      <Typography variant="body2" color="success.main">Available for Assignment</Typography>
                    ) : (
                      <Typography variant="body2">Vacant</Typography>
                    )}
                    <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                      Left click: Details | Right click: History
                    </Typography>
                  </Box>
                }
              >
                <Box
                  onClick={() => onSeatClick(seat)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onSeatHistoryClick(seat);
                  }}
                  sx={{
                    width: seatSize,
                    height: seatSize,
                    background: seat.isUnassigned 
                      ? 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)'
                      : getSeatColor(seat),
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: seat.isUnassigned ? '2px solid #4caf50' : '2px solid transparent',
                    transition: 'all 0.2s',
                    position: 'relative',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      border: '2px solid #333',
                      zIndex: 1,
                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                    }
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: seat.isUnassigned || seat.occupied ? 'white' : 'black',
                      fontWeight: 'bold',
                      fontSize: isMobile ? '10px' : '12px'
                    }}
                  >
                    {seat.seatNumber}
                  </Typography>
                  {seat.expiring && (
                    <WarningIcon
                      sx={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        fontSize: 16,
                        color: '#ff9800'
                      }}
                    />
                  )}
                  {seat.isUnassigned && (
                    <CheckCircleIcon
                      sx={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        fontSize: 16,
                        color: '#4caf50'
                      }}
                    />
                  )}
                </Box>
              </Tooltip>
            ))}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// Table View Component
function TableView({ seats, onSeatClick, onSeatHistoryClick, normalizeGender, isMembershipActive, isMobile }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        📋 Seat Table View
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Seat</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Student</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {seats.map((seat) => (
              <TableRow key={seat.seatNumber} hover>
                <TableCell>
                  <Chip
                    label={seat.seatNumber}
                    sx={{
                      background: seat.occupied ? 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)' : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                      color: seat.occupied ? 'white' : 'black'
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={seat.occupied ? 'Occupied' : 'Vacant'}
                    color={seat.occupied ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>{seat.studentName || '-'}</TableCell>
                <TableCell>{seat.contactNumber || '-'}</TableCell>
                <TableCell>
                  {seat.gender && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {normalizeGender(seat.gender) === 'Male' ? <MaleIcon color="primary" /> : <FemaleIcon color="secondary" />}
                      {normalizeGender(seat.gender)}
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  {seat.membershipExpiry ? (
                    <Box>
                      <Typography variant="body2">
                        {new Date(seat.membershipExpiry).toLocaleDateString()}
                      </Typography>
                      {seat.expiring && (
                        <Chip size="small" label="Expiring" color="warning" />
                      )}
                    </Box>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => onSeatClick(seat)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View History">
                      <IconButton size="small" onClick={() => onSeatHistoryClick(seat)}>
                        <HistoryIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// Seat Detail Dialog Component
function SeatDetailDialog({ open, seat, student, onClose, onEdit, onPayment, onHistory, onDelete, onMarkVacant }) {
  if (!seat) return null;

  // Check if student membership is expired
  const isExpired = student && student.membership_till && new Date(student.membership_till) < new Date();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          🪑 Seat {seat.seatNumber} Details
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {seat.occupied && student ? (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonOutlineIcon />
                {student.name}
                {isExpired && (
                  <Chip
                    label="EXPIRED"
                    color="error"
                    size="small"
                    sx={{ ml: 1 }}
                  />
                )}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">📞 Contact:</Typography>
              <Typography variant="body1">{student.contact_number}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">👤 Gender:</Typography>
              <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {student.sex === 'male' ? <MaleIcon color="primary" /> : <FemaleIcon color="secondary" />}
                {student.sex}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">👨‍👦 Father's Name:</Typography>
              <Typography variant="body1">{student.father_name || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">📅 Membership Till:</Typography>
              <Typography 
                variant="body1" 
                color={isExpired ? 'error' : 'inherit'}
                sx={{ fontWeight: isExpired ? 'bold' : 'normal' }}
              >
                {student.membership_till ? new Date(student.membership_till).toLocaleDateString() : 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">💰 Total Paid:</Typography>
              <Typography variant="body1">₹{student.total_paid || 0}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">💳 Last Payment:</Typography>
              <Typography variant="body1">
                {student.last_payment_date ? new Date(student.last_payment_date).toLocaleDateString() : 'N/A'}
              </Typography>
            </Grid>
            {isExpired && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    ⚠️ This student's membership has expired. You can mark this seat as vacant to make it available for new students.
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <EventSeatIcon sx={{ fontSize: 64, color: 'action.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">This seat is currently vacant</Typography>
            <Typography variant="body2" color="text.secondary">
              Available for new student assignment
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onHistory} startIcon={<HistoryIcon />} variant="outlined">
          View History
        </Button>
        {seat.occupied && (
          <>
            {isExpired && (
              <Button 
                onClick={onMarkVacant} 
                startIcon={<CheckCircleIcon />} 
                color="warning" 
                variant="contained"
                sx={{ mr: 1 }}
              >
                Mark as Vacant
              </Button>
            )}
            <Button onClick={onPayment} startIcon={<PaymentIcon />} variant="outlined">
              Add Payment
            </Button>
            <Button onClick={onEdit} startIcon={<EditIcon />} variant="outlined">
              Edit Student
            </Button>
            <Button onClick={onDelete} startIcon={<DeleteIcon />} color="error" variant="outlined">
              Remove Student
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

// Seat History Dialog Component
function SeatHistoryDialog({ open, onClose, seatNumber, historyData, loading }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          📝 Seat {seatNumber} Change History
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : historyData.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date & Time</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Occupant Sex</TableCell>
                  <TableCell>Modified By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyData.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon sx={{ fontSize: 16, color: 'action.active' }} />
                        {new Date(entry.action_timestamp).toLocaleString()}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={entry.action}
                        color={
                          entry.action === 'INSERT' ? 'success' :
                          entry.action === 'UPDATE' ? 'warning' :
                          'error'
                        }
                      />
                    </TableCell>
                    <TableCell>{entry.status}</TableCell>
                    <TableCell>
                      {entry.occupant_sex ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {entry.occupant_sex === 'male' ? <MaleIcon color="primary" /> : <FemaleIcon color="secondary" />}
                          {entry.occupant_sex}
                        </Box>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>{entry.modified_by_name || 'System'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <HistoryIcon sx={{ fontSize: 64, color: 'action.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No history available</Typography>
            <Typography variant="body2" color="text.secondary">
              This seat has no recorded changes yet
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Add Student Dialog Component
function AddStudentDialog({ open, onClose, student, setStudent, loading, error, onSubmit, seatData = [], unassignedSeats = [] }) {
  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Validation functions
  const validateName = (name) => {
    if (!name || name.trim().length === 0) return 'Name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters long';
    if (name.trim().length > 100) return 'Name must not exceed 100 characters';
    if (!/^[a-zA-Z\s\.\-']+$/.test(name.trim())) return 'Name can only contain letters, spaces, dots, hyphens, and apostrophes';
    return '';
  };

  const validateContact = (contact) => {
    if (!contact || contact.trim().length === 0) return 'Contact number is required';
    const cleanContact = contact.replace(/[\s\-\(\)]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(cleanContact)) return 'Contact number must be 10-15 digits (may include country code with +)';
    return '';
  };

  const validateFatherName = (fatherName) => {
    if (!fatherName) return ''; // Optional field
    if (fatherName.trim().length < 2) return "Father's name must be at least 2 characters long if provided";
    if (fatherName.trim().length > 100) return "Father's name must not exceed 100 characters";
    if (!/^[a-zA-Z\s\.\-']+$/.test(fatherName.trim())) return "Father's name can only contain letters, spaces, dots, hyphens, and apostrophes";
    return '';
  };

  const validateSeatNumber = (seatNumber) => {
    if (!seatNumber || seatNumber.trim().length === 0) return 'Seat number is required';
    if (!/^[A-Za-z0-9\-]+$/.test(seatNumber.trim()) && seatNumber !== 'UNASSIGNED') return 'Seat number can only contain letters, numbers, and hyphens';
    if (seatNumber.trim().length > 20) return 'Seat number must not exceed 20 characters';
    return '';
  };

  const validateGender = (gender) => {
    if (!gender) return 'Gender is required';
    if (!['Male', 'Female'].includes(gender)) return 'Gender must be either Male or Female';
    return '';
  };

  // Get available seats based on selected gender
  const getAvailableSeats = () => {
    const selectedGender = student.sex;
    if (!selectedGender) return [];
    
    // Always include "Unassigned" option
    const unassignedOption = {
      value: 'UNASSIGNED',
      label: '📍 Unassigned (No physical seat)',
      designation: ''
    };
    
    // Get seats from unassigned seats data (these are confirmed available)
    const availableSeatsFromUnassigned = unassignedSeats.map(seat => ({
      value: seat.seat_number,
      label: `Seat ${seat.seat_number}`,
      designation: '',
      source: 'unassigned'
    }));
    
    // Also check seatData for compatibility (for gender restrictions)
    const availableSeatsFromSeatData = seatData
      .filter(seat => {
        // Seat must not be occupied
        if (seat.occupied) return false;
        
        // Seat must not be removed/maintenance
        if (seat.removed || seat.maintenance) return false;
        
        // Gender restriction logic:
        if (seat.gender) {
          // Seat has a gender designation - must match student's gender
          if (seat.gender.toLowerCase() !== selectedGender.toLowerCase()) {
            return false;
          }
        }
        
        return true;
      })
      .map(seat => ({
        value: seat.seatNumber,
        label: `Seat ${seat.seatNumber}`,
        designation: seat.designation || '',
        source: 'seatData'
      }));
    
    // Combine and deduplicate seats
    const allAvailableSeats = [...availableSeatsFromUnassigned];
    
    // Add seats from seatData that aren't already in unassigned seats
    availableSeatsFromSeatData.forEach(seat => {
      if (!allAvailableSeats.find(existing => existing.value === seat.value)) {
        allAvailableSeats.push(seat);
      }
    });
    
    // Sort numerically if possible, otherwise alphabetically
    allAvailableSeats.sort((a, b) => {
      const aNum = parseInt(a.value);
      const bNum = parseInt(b.value);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.value.localeCompare(b.value);
    });
    
    // Return unassigned option first, then available seats
    return [unassignedOption, ...allAvailableSeats];
  };

  // Handle field changes with validation
  const handleFieldChange = (field, value) => {
    const updates = { [field]: value };
    
    // If gender changes, clear seat selection since available seats will change
    if (field === 'sex' && student.seatNumber) {
      updates.seatNumber = '';
      if (validationErrors.seatNumber) {
        setValidationErrors({ ...validationErrors, [field]: '', seatNumber: '' });
      }
    }
    
    setStudent({ ...student, ...updates });
    
    // Clear error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: '' });
    }
  };

  // Validate all fields
  const validateForm = () => {
    const errors = {
      name: validateName(student.name),
      contact: validateContact(student.contact),
      fatherName: validateFatherName(student.fatherName),
      seatNumber: validateSeatNumber(student.seatNumber),
      sex: validateGender(student.sex)
    };
    
    setValidationErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  // Enhanced submit handler
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit();
    }
  };

  const availableSeats = getAvailableSeats();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>✨ Add New Student</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Student Name *"
              value={student.name || ''}
              onChange={e => handleFieldChange('name', e.target.value)}
              required
              error={!!validationErrors.name}
              helperText={validationErrors.name || 'Enter the full name of the student'}
              inputProps={{ maxLength: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required error={!!validationErrors.sex}>
              <InputLabel>Gender *</InputLabel>
              <Select
                value={student.sex || ''}
                label="Gender *"
                onChange={e => handleFieldChange('sex', e.target.value)}
                required
              >
                <MenuItem value="Male">👨 Male</MenuItem>
                <MenuItem value="Female">👩 Female</MenuItem>
              </Select>
              {validationErrors.sex && (
                <Typography variant="caption" color="error" sx={{ ml: 2, mt: 0.5 }}>
                  {validationErrors.sex}
                </Typography>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Contact Number *"
              value={student.contact || ''}
              onChange={e => handleFieldChange('contact', e.target.value)}
              required
              error={!!validationErrors.contact}
              helperText={validationErrors.contact || 'Enter 10-15 digit phone number'}
              inputProps={{ maxLength: 20 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required error={!!validationErrors.seatNumber}>
              <InputLabel>Seat Number *</InputLabel>
              <Select
                value={student.seatNumber || ''}
                label="Seat Number *"
                onChange={e => handleFieldChange('seatNumber', e.target.value)}
                required
                disabled={!student.sex} // Disable until gender is selected
                displayEmpty
              >
                {!student.sex && (
                  <MenuItem value="" disabled>
                  </MenuItem>
                )}
                {student.sex && availableSeats.length === 0 && (
                  <MenuItem value="" disabled>
                    <em>No seats available for {student.sex}</em>
                  </MenuItem>
                )}
                {student.sex && availableSeats.map((seat) => (
                  <MenuItem key={seat.value} value={seat.value}>
                    {seat.value === 'UNASSIGNED' ? seat.label : `🪑 ${seat.label} ${seat.designation}`}
                  </MenuItem>
                ))}
              </Select>
              {validationErrors.seatNumber ? (
                <Typography variant="caption" color="error" sx={{ ml: 2, mt: 0.5 }}>
                  {validationErrors.seatNumber}
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2, mt: 0.5 }}>
                  {!student.sex 
                    ? 'Select gender first to see available seats'
                    : `${availableSeats.length} seats available for ${student.sex} (${unassignedSeats.length} confirmed available)`
                  }
                </Typography>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Father's Name (optional)"
              value={student.fatherName || ''}
              onChange={e => handleFieldChange('fatherName', e.target.value)}
              error={!!validationErrors.fatherName}
              helperText={validationErrors.fatherName || 'Enter father\'s full name (optional)'}
              inputProps={{ maxLength: 100 }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !student.name || !student.seatNumber || !student.contact || !student.sex}
          startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
        >
          Add Student
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Payment Dialog Component  
function PaymentDialog({ open, onClose, student, payment, setPayment, loading, error, onSubmit }) {
  if (!student) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          💳 Add Payment for {student.name}
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        
        {/* Student Info */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Student:</Typography>
              <Typography variant="body1" fontWeight="bold">{student.name}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Current Balance:</Typography>
              <Typography variant="body1" fontWeight="bold" color="success.main">
                ₹{student.total_paid || 0}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Last Payment:</Typography>
              <Typography variant="body1">
                {student.last_payment_date ? new Date(student.last_payment_date).toLocaleDateString() : 'No payments yet'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Membership Till:</Typography>
              <Typography variant="body1">
                {student.membership_till ? new Date(student.membership_till).toLocaleDateString() : 'N/A'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Payment Form */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Payment Amount"
              type="number"
              value={payment.amount}
              onChange={e => setPayment({ ...payment, amount: e.target.value })}
              required
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
              }}
              placeholder="Enter amount"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Payment Date"
              type="date"
              value={payment.paymentDate}
              onChange={e => setPayment({ ...payment, paymentDate: e.target.value })}
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Payment Mode</InputLabel>
              <Select
                value={payment.paymentMode}
                label="Payment Mode"
                onChange={e => setPayment({ ...payment, paymentMode: e.target.value })}
                required
              >
                <MenuItem value="cash">💵 Cash</MenuItem>
                <MenuItem value="online">💳 Online</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Remarks (Optional)"
              value={payment.remarks}
              onChange={e => setPayment({ ...payment, remarks: e.target.value })}
              placeholder="Payment description..."
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={loading || !payment.amount || !payment.paymentDate || !payment.paymentMode}
          startIcon={loading ? <CircularProgress size={16} /> : <PaymentIcon />}
          color="success"
        >
          {loading ? 'Processing...' : 'Add Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Unassigned Seats View Component
function UnassignedSeatsView({ unassignedSeats, students, onSeatClick, onSeatHistoryClick, isMobile }) {
  const unassignedStudents = students.filter(student => !student.assigned_seat || student.assigned_seat === 'UNASSIGNED');
  
  return (
    <Box>
      {/* Available Seats Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          🔓 Available Seats ({unassignedSeats.length})
          <Chip 
            label={`${unassignedSeats.length} Available`} 
            color="success" 
            size="small" 
          />
        </Typography>
        
        {unassignedSeats.length > 0 ? (
          <Grid container spacing={2}>
            {unassignedSeats.map((seat) => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={seat.seat_number}>
                <Card 
                  sx={{ 
                    p: 2, 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    border: '2px solid #4caf50',
                    bgcolor: 'success.50',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: 3
                    }
                  }}
                  onClick={() => onSeatClick({
                    seatNumber: seat.seat_number,
                    occupied: false,
                    isUnassigned: true
                  })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onSeatHistoryClick({
                      seatNumber: seat.seat_number
                    });
                  }}
                >
                  <EventSeatIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                  <Typography variant="h6" color="success.main">
                    {seat.seat_number}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Available
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <EventSeatIcon sx={{ fontSize: 64, color: 'action.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No Available Seats
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All seats are currently assigned or under maintenance
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Unassigned Students Section */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          👥 Students Without Seats ({unassignedStudents.length})
          <Chip 
            label={`${unassignedStudents.length} Unassigned`} 
            color="warning" 
            size="small" 
          />
        </Typography>
        
        {unassignedStudents.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Student Name</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Gender</TableCell>
                  <TableCell>Membership Status</TableCell>
                  <TableCell>Membership Till</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unassignedStudents.map((student) => (
                  <TableRow key={student.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'warning.main' }}>
                          <PersonOutlineIcon />
                        </Avatar>
                        {student.name}
                      </Box>
                    </TableCell>
                    <TableCell>{student.contact_number}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {student.sex === 'male' ? 
                          <MaleIcon color="primary" /> : 
                          <FemaleIcon color="secondary" />
                        }
                        {student.sex}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={student.membership_status || 'active'}
                        color={
                          student.membership_status === 'active' ? 'success' :
                          student.membership_status === 'expired' ? 'error' :
                          'warning'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {student.membership_till ? (
                        <Box>
                          <Typography variant="body2">
                            {new Date(student.membership_till).toLocaleDateString()}
                          </Typography>
                          {new Date(student.membership_till) < new Date() && (
                            <Chip size="small" label="Expired" color="error" />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not set
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Assign Seat">
                        <IconButton 
                          size="small" 
                          onClick={() => {
                            // Handle seat assignment - could open a dialog
                            console.log('Assign seat to student:', student);
                          }}
                        >
                          <EventSeatIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" color="success.main">
              All Students Have Seats!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Every student has been assigned a seat
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default Students;
