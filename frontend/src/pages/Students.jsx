import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Card,
  CardContent,
  Grid,
  IconButton,
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
  Stack,
  Divider,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import MobileFilters from '../components/MobileFilters';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterAlt as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Payment as PaymentIcon,
  Delete as DeleteIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  Man as ManIcon,
  Woman as WomanIcon,
  Phone as PhoneIcon,
  EventSeat as EventSeatIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
  CalendarMonth as CalendarMonthIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  AssignmentInd as AssignmentIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { getSeatChartData, markSeatAsVacant } from '../services/api';

// Helper function to format dates consistently in DD-MMM-YYYY format
const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).replace(/ /g, '-');
  } catch (error) {
    return 'N/A';
  }
};

function Students() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Helper function to handle API errors, especially token expiration
  const handleApiError = (error, defaultMessage = 'An error occurred') => {
    if (error.message === 'TOKEN_EXPIRED') {
      // Token expiration is handled globally by the AuthContext
      // Don't show additional error messages as user will be redirected to login
      return;
    }
    
    console.error('API Error:', error);
    setSnackbarMessage(error.message || defaultMessage);
    setSnackbarSeverity('error');
    setSnackbarOpen(true);
  };
  
  const [students, setStudents] = useState([]);
  const [unassignedSeats, setUnassignedSeats] = useState([]);
  const [seatData, setSeatData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // View modes: 0=Seats, 1=Students (removed Available Seats)
  const [currentTab, setCurrentTab] = useState(0);
  
  // Filters
  const [seatNumberFilter, setSeatNumberFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [studentNameFilter, setStudentNameFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  
  // Active stat filter
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  
  // Dialog states
  const [selectedItem, setSelectedItem] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [seatHistoryOpen, setSeatHistoryOpen] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [assignSeatOpen, setAssignSeatOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  
  // Menu states
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [selectedItemForAction, setSelectedItemForAction] = useState(null);
  
  // History data
  const [seatHistoryData, setSeatHistoryData] = useState([]);
  const [paymentHistoryData, setPaymentHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Form states
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [availableSeats, setAvailableSeats] = useState([]);
  const [seatLoading, setSeatLoading] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: '',
    seatNumber: '',
    contact: '',
    sex: '',
    fatherName: '',
  });

  // Fetch available seats when gender is selected
  const fetchAvailableSeats = async (gender) => {
    if (!gender) {
      setAvailableSeats([]);
      return;
    }
    
    setSeatLoading(true);
    try {
      const response = await fetch(`/api/students/available-seats/${gender}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch available seats');
      
      const data = await response.json();
      setAvailableSeats(data.availableSeats || []);
    } catch (err) {
      handleApiError(err, 'Failed to load available seats');
      setAvailableSeats([]);
    } finally {
      setSeatLoading(false);
    }
  };

  // Handle gender change in add student form
  const handleGenderChange = (gender) => {
    setNewStudent({ 
      ...newStudent, 
      sex: gender,
      seatNumber: '' // Reset seat selection when gender changes
    });
    fetchAvailableSeats(gender);
  };

  // Fetch available seats for edit student when gender is selected
  const fetchEditAvailableSeats = async (gender, currentSeatNumber = null) => {
    if (!gender) {
      setEditAvailableSeats([]);
      return;
    }
    
    setEditSeatLoading(true);
    try {
      const response = await fetch(`/api/students/available-seats/${gender}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch available seats');
      
      const data = await response.json();
      let availableSeats = data.availableSeats || [];
      
      // If editing and student has a current seat, include it in the options
      if (currentSeatNumber) {
        const currentSeatExists = availableSeats.some(seat => seat.seat_number === currentSeatNumber);
        if (!currentSeatExists) {
          // Add current seat to the list
          availableSeats.unshift({
            seat_number: currentSeatNumber,
            status: 'occupied', // Current seat
            is_current: true
          });
        } else {
          // Mark existing seat as current
          availableSeats = availableSeats.map(seat => 
            seat.seat_number === currentSeatNumber 
              ? { ...seat, is_current: true }
              : seat
          );
        }
      }
      
      setEditAvailableSeats(availableSeats);
    } catch (err) {
      handleApiError(err, 'Failed to load available seats');
      setEditAvailableSeats([]);
    } finally {
      setEditSeatLoading(false);
    }
  };

  // Handle gender change in edit student form
  const handleEditGenderChange = (gender) => {
    setEditStudent({ 
      ...editStudent, 
      sex: gender,
      seatNumber: '' // Reset seat selection when gender changes
    });
    fetchEditAvailableSeats(gender);
  };

  const [editStudent, setEditStudent] = useState({
    id: '',
    name: '',
    seatNumber: '',
    contact: '',
    sex: '',
    fatherName: '',
    membershipDate: '',
    membershipTill: '',
  });

  // Additional states for edit student seat management
  const [editAvailableSeats, setEditAvailableSeats] = useState([]);
  const [editSeatLoading, setEditSeatLoading] = useState(false);

  const [assignSeatData, setAssignSeatData] = useState({
    seatNumber: '',
    studentId: ''
  });

  // Additional dialog states
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [editStudentOpen, setEditStudentOpen] = useState(false);
  const [viewStudentOpen, setViewStudentOpen] = useState(false);
  const [viewStudentData, setViewStudentData] = useState(null); // Store student data for view dialog
  const [viewStudentTotalPaid, setViewStudentTotalPaid] = useState(0); // Store total paid amount for view dialog
  const [seatHistoryContext, setSeatHistoryContext] = useState(null); // Store context data for seat history dialog
  
  // Data states
  const [seatHistory, setSeatHistory] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: 'cash',
    type: 'monthly_fee',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [paymentLoading, setPaymentLoading] = useState(false);
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
    console.log('🔄 [fetchData] Starting data fetch...');
    setLoading(true);
    setError(null);
    try {
      console.log('📡 [fetchData] Making API calls...');
      const [studentsResponse, seatChartData] = await Promise.all([
        fetch(`/api/students/with-unassigned-seats`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }),
        getSeatChartData()
      ]);
      
      console.log('📡 [fetchData] Students response status:', studentsResponse.status);
      
      if (!studentsResponse.ok) {
        throw new Error(`API error! status: ${studentsResponse.status}`);
      }
      
      const studentsData = await studentsResponse.json();
      console.log('📋 [fetchData] Raw students data received:', studentsData);
      console.log('📋 [fetchData] Students array:', studentsData.students);
      console.log('📋 [fetchData] Unassigned seats:', studentsData.unassignedSeats);
      console.log('🪑 [fetchData] Seat chart data:', seatChartData);
      
      // Validate and clean data
      const cleanStudents = (studentsData.students || []).filter(student => student && typeof student === 'object');
      const cleanUnassignedSeats = studentsData.unassignedSeats || [];
      
      console.log('✅ [fetchData] Cleaned students:', cleanStudents.length);
      console.log('✅ [fetchData] Cleaned unassigned seats:', cleanUnassignedSeats.length);
      
      setStudents(cleanStudents);
      setUnassignedSeats(cleanUnassignedSeats);
      setSeatData(seatChartData);
      
      console.log('✅ [fetchData] Data fetch completed successfully');
    } catch (err) {
      console.error('❌ [fetchData] Error occurred:', err);
      console.error('❌ [fetchData] Error stack:', err.stack);
      handleApiError(err, 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      console.log('🔄 [fetchData] Loading state set to false');
    }
  };

  // Calculate statistics
  const getStats = () => {
    console.log('📊 [getStats] Calculating statistics...');
    console.log('Raw students data:', students);
    console.log('Raw seatData:', seatData);
    
    // Filter out null/undefined students
    const validStudents = students.filter(student => student && typeof student === 'object');
    console.log('Valid students after null check:', validStudents.length);
    
    const totalStudents = validStudents.length;
    const assignedSeats = validStudents.filter(s => s.seat_number).length;
    const availableSeats = unassignedSeats.length;
    
    // Calculate expiring students based on membership_till within 7 days
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    
    const expiringSeats = validStudents.filter(student => {
      if (!student.membership_till) {
        return false;
      }
      
      const expiryDate = new Date(student.membership_till);
      return expiryDate >= today && expiryDate <= sevenDaysFromNow;
    }).length;
    
    const unassignedStudents = validStudents.filter(s => !s.seat_number).length;
    const totalSeats = seatData.length;
    
    // Calculate male and female seat counts
    console.log('Processing seat data for gender counts...');
    const maleSeats = seatData.filter(s => s && s.occupantSexRestriction === 'male').length;
    const femaleSeats = seatData.filter(s => s && s.occupantSexRestriction === 'female').length;
    const neutralSeats = totalSeats - maleSeats - femaleSeats; // Seats with no gender restriction

    console.log('📈 [getStats] Statistics calculated:');
    console.log('- Total Students:', totalStudents);
    console.log('- Assigned Seats:', assignedSeats);
    console.log('- Available Seats:', availableSeats);
    console.log('- Expiring Seats:', expiringSeats);
    console.log('- Unassigned Students:', unassignedStudents);
    console.log('- Total Seats:', totalSeats);
    console.log('- Male Seats:', maleSeats);
    console.log('- Female Seats:', femaleSeats);
    console.log('- Neutral Seats:', neutralSeats);

    return {
      totalStudents,
      assignedSeats,
      availableSeats,
      expiringSeats,
      unassignedStudents,
      totalSeats,
      maleSeats,
      femaleSeats,
      neutralSeats
    };
  };

  const stats = getStats();

  // Handle stat clicks for filtering
  const handleStatClick = (statType) => {
    setActiveStatFilter(statType);
    clearAllFilters();
    
    switch (statType) {
      case 'total':
        setCurrentTab(0); // Seats view
        clearAllFilters();
        break;
      case 'totalStudents':
        setCurrentTab(1); // Students view
        clearAllFilters();
        break;
      case 'available':
        setCurrentTab(0); // Seats view
        setStatusFilter('available');
        break;
      case 'expiring':
        setCurrentTab(0); // Seats view
        setStatusFilter('expiring');
        break;
      case 'assigned':
        setCurrentTab(1); // Students view
        setStatusFilter('assigned');
        break;
      case 'unassigned':
        setCurrentTab(1); // Students view
        setStatusFilter('unassigned');
        break;
      case 'male':
        setGenderFilter('male');
        break;
      case 'female':
        setGenderFilter('female');
        break;
      default:
        break;
    }
  };

  const clearAllFilters = () => {
    setSeatNumberFilter('');
    setStatusFilter('');
    setGenderFilter('');
    setStudentNameFilter('');
    setContactFilter('');
    setActiveStatFilter(null);
  };

  // Filter data based on current tab and filters
  const getFilteredData = () => {
    let data = [];
    
    if (currentTab === 0) { // Seats View
      console.log('🔍 DEBUG: Processing seat data for display');
      console.log('Seat data received from backend:', seatData.slice(0, 3));
      console.log('Students data:', students.slice(0, 3));
      
      data = seatData.map(seat => {
        const student = students.find(s => s.seat_number === seat.seatNumber);
        const processedSeat = {
          ...seat,
          // Preserve backend data when available, fallback to student lookup
          studentName: seat.studentName || student?.name || '',
          studentId: seat.studentId || student?.id || '',
          contact: seat.contactNumber || student?.contact_number || '',
          gender: seat.gender || student?.sex || '',
          // Fix: Determine if seat is occupied based on whether there's a student assigned
          occupied: !!(seat.studentName || student?.name)
        };
        
        // Log occupied seats for debugging
        if (processedSeat.occupied && processedSeat.studentName) {
          console.log(`✅ Occupied seat ${seat.seatNumber}: ${processedSeat.studentName} (backend data preserved)`);
        } else if (processedSeat.occupied && !processedSeat.studentName && student) {
          console.log(`🔄 Occupied seat ${seat.seatNumber}: ${student.name} (from student lookup)`);
        } else if (!processedSeat.occupied) {
          console.log(`🔓 Available seat ${seat.seatNumber}: No student assigned`);
        }
        
        return processedSeat;
      });
      
      console.log('Processed data sample:', data.filter(d => d.occupied).slice(0, 3));
    } else if (currentTab === 1) { // Students View
      console.log('🔍 DEBUG: Processing students data for Students View');
      console.log('Students data received:', students.slice(0, 3));
      
      data = students.map(student => {
        const processedStudent = {
          ...student,
          status: student.seat_number ? 'assigned' : 'unassigned',
          gender: student.sex,
          // Add consistent property for easier access
          seatNumber: student.seat_number
        };
        
        // Log student processing
        console.log(`👤 Processing student: ID=${student.id}, Name=${student.name}, Seat=${student.seat_number || 'UNASSIGNED'}`);
        
        return processedStudent;
      });
      
      console.log('Processed students data sample:', data.slice(0, 3));
    }

    // Apply filters
    if (seatNumberFilter) {
      data = data.filter(item => 
        (item.seatNumber || '').toString() === seatNumberFilter
      );
    }
    
    if (statusFilter) {
      if (statusFilter === 'expiring') {
        data = data.filter(item => item.expiring);
      } else if (statusFilter === 'assigned') {
        data = data.filter(item => item.seatNumber);
      } else if (statusFilter === 'unassigned') {
        data = data.filter(item => !item.seatNumber);
      } else if (statusFilter === 'available') {
        data = data.filter(item => !item.occupied);
      } else if (statusFilter === 'occupied') {
        data = data.filter(item => item.occupied);
      }
    }
    
    if (genderFilter) {
      data = data.filter(item => item.gender === genderFilter);
    }
    
    if (studentNameFilter) {
      data = data.filter(item => 
        (item.name || item.studentName || '').toLowerCase().startsWith(studentNameFilter.toLowerCase())
      );
    }
    
    if (contactFilter) {
      data = data.filter(item => 
        (item.contact || item.contactNumber || '').startsWith(contactFilter)
      );
    }

    return data;
  };

  const filteredData = getFilteredData();

  // Add student handler
  const handleAddStudent = async () => {
    // Basic frontend validation for required fields
    if (!newStudent.name.trim()) {
      setSnackbarMessage('*Student name is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (!newStudent.sex) {
      setSnackbarMessage('*Gender is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setAddStudentLoading(true);
    try {
      // Map frontend field names to backend expected names
      const studentData = {
        name: newStudent.name.trim(),
        sex: newStudent.sex,
        father_name: newStudent.fatherName?.trim() || null,
        contact_number: newStudent.contact?.trim() || null,
        seat_number: newStudent.seat_number || null
      };

      const response = await fetch(`/api/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(studentData)
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Handle validation errors from backend
        if (responseData.details && Array.isArray(responseData.details)) {
          setSnackbarMessage(responseData.details.join(', '));
        } else {
          setSnackbarMessage(responseData.error || 'Failed to add student');
        }
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }

      setSnackbarMessage('Student added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setAddDialogOpen(false);
      setNewStudent({ name: '', seatNumber: '', contact: '', sex: '', fatherName: '' });
      setAvailableSeats([]);
      fetchData();
    } catch (err) {
      console.error('Error adding student:', err);
      handleApiError(err, 'Failed to add student: ' + err.message);
    } finally {
      setAddStudentLoading(false);
    }
  };

  // Action menu handlers
  const handleActionClick = (event, item) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setSelectedItemForAction(item);
  };

  const handleActionClose = () => {
    console.log('🔒 [handleActionClose] Closing action menu and clearing selectedItemForAction');
    console.log('📋 [handleActionClose] Current selectedItemForAction:', selectedItemForAction);
    setActionMenuAnchor(null);
    setSelectedItemForAction(null);
  };

  // Seat history handler
  const handleSeatHistory = async () => {
    console.log('🔍 [History] Starting context-aware history...');
    console.log('🔍 Current tab:', currentTab);
    console.log('🔍 Selected item:', selectedItemForAction);
    console.log('🔍 Selected item keys:', selectedItemForAction ? Object.keys(selectedItemForAction) : 'null');
    
    // Store context data for seat history dialog (similar to view dialog pattern)
    setSeatHistoryContext({ 
      ...selectedItemForAction,
      contextTab: currentTab // Store which tab we're coming from
    });
    
    setHistoryLoading(true);
    try {
      let response;
      
      if (currentTab === 0) {
        // For seats tab (currentTab = 0), show all students who have used this seat
        const seatNumber = selectedItemForAction?.seat_number || selectedItemForAction?.seatNumber;
        console.log('🪑 [Seat History] Fetching seat history for seat:', seatNumber);
        if (!seatNumber) {
          console.error('❌ [Seat History] No seat number available in selectedItemForAction:', selectedItemForAction);
          throw new Error('No seat number available');
        }
        response = await fetch(`/api/seats/${seatNumber}/history`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
      } else {
        // For students tab (currentTab = 1), show all seats this student has occupied
        const studentId = selectedItemForAction?.id;
        console.log('👤 [Student History] Fetching student history for ID:', studentId);
        console.log('👤 [Student History] Student name:', selectedItemForAction?.name);
        if (!studentId) {
          console.error('❌ [Student History] No student ID available in selectedItemForAction:', selectedItemForAction);
          throw new Error('No student ID available');
        }
        response = await fetch(`/api/students/${studentId}/history`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
      }
      
      if (!response.ok) throw new Error('Failed to fetch history');
      
      const historyData = await response.json();
      console.log('📊 [History] Received data:', historyData);
      
      setSeatHistory(historyData);
      setSeatHistoryOpen(true);
    } catch (err) {
      handleApiError(err, 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
    handleActionClose();
  };

  // Assign seat handler
  const handleAssignSeat = () => {
    setAssignSeatData({ 
      seatNumber: selectedItemForAction?.seat_number || '', 
      studentId: '' 
    });
    setAssignSeatOpen(true);
    handleActionClose();
  };

  // Payment history handler
  const handlePaymentHistory = async () => {
    console.log('💰📚 [handlePaymentHistory] Payment history action initiated');
    console.log('📋 Selected item for action:', selectedItemForAction);
    
    if (!selectedItemForAction?.id) {
      console.warn('⚠️ [handlePaymentHistory] No student ID available, aborting payment history fetch');
      return;
    }
    
    console.log(`👤 [handlePaymentHistory] Fetching payment history for student: ID=${selectedItemForAction.id}, Name="${selectedItemForAction.name}"`);
    
    setHistoryLoading(true);
    try {
      console.log('🌐 [handlePaymentHistory] Sending GET request to /api/payments/student/:studentId...');
      const response = await fetch(`/api/payments/student/${selectedItemForAction.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      console.log(`📡 [handlePaymentHistory] API Response status: ${response.status}`);
      
      if (!response.ok) {
        console.error('❌ [handlePaymentHistory] API request failed');
        throw new Error('Failed to fetch payment history');
      }
      
      const historyData = await response.json();
      console.log('✅ [handlePaymentHistory] Payment history received:', historyData);
      console.log(`📊 [handlePaymentHistory] Number of payment records: ${historyData.length}`);
      
      setPaymentHistory(historyData || []);
      setPaymentHistoryOpen(true);
      console.log('✅ [handlePaymentHistory] Payment history dialog opened successfully');
    } catch (err) {
      console.error('❌ [handlePaymentHistory] Error occurred during payment history fetch:', err);
      console.error('🔍 [handlePaymentHistory] Error details:', {
        message: err.message,
        studentId: selectedItemForAction?.id,
        studentName: selectedItemForAction?.name
      });
      handleApiError(err, 'Failed to load payment history');
    } finally {
      setHistoryLoading(false);
      console.log('🔄 [handlePaymentHistory] History loading state set to false');
    }
    handleActionClose();
  };

  // Edit student handler
  const handleEditStudent = () => {
    console.log('🖊️ [handleEditStudent] Edit student action initiated');
    console.log('📋 Selected item for action:', selectedItemForAction);
    
    if (!selectedItemForAction) {
      console.warn('⚠️ [handleEditStudent] No selected item for action, aborting edit');
      return;
    }
    
    console.log(`👤 [handleEditStudent] Editing student: ID=${selectedItemForAction.id}, Name="${selectedItemForAction.name}"`);
    console.log(`📞 [handleEditStudent] Current contact: ${selectedItemForAction.contact_number || 'Not provided'}`);
    console.log(`👫 [handleEditStudent] Current gender: ${selectedItemForAction.sex || 'Not specified'}`);
    console.log(`🪑 [handleEditStudent] Current seat: ${selectedItemForAction.seat_number || 'Unassigned'}`);
    console.log(`📅 [handleEditStudent] Current membership: ${selectedItemForAction.membership_date || 'No start date'} to ${selectedItemForAction.membership_till || 'No end date'}`);
    
    const editData = {
      id: selectedItemForAction.id,
      name: selectedItemForAction.name,
      contactNumber: selectedItemForAction.contact_number,
      sex: selectedItemForAction.sex,
      seatNumber: selectedItemForAction.seat_number || '',
      membershipDate: selectedItemForAction.membership_date ? selectedItemForAction.membership_date.split('T')[0] : '',
      membershipTill: selectedItemForAction.membership_till ? selectedItemForAction.membership_till.split('T')[0] : ''
    };
    
    console.log('📝 [handleEditStudent] Setting edit form data:', editData);
    console.log(`🆔 [handleEditStudent] Student ID being preserved: ${editData.id}`);
    console.log(`📅 [handleEditStudent] Membership dates being set: ${editData.membershipDate || 'No start'} to ${editData.membershipTill || 'No end'}`);
    setEditStudent(editData);
    
    // Fetch available seats if gender is available
    if (editData.sex) {
      fetchEditAvailableSeats(editData.sex, editData.seatNumber);
    }
    
    setEditStudentOpen(true);
    console.log('✅ [handleEditStudent] Edit dialog opened successfully');
    handleActionClose();
  };

  // Add payment handler
  const handleAddPayment = () => {
    console.log('💰 [handleAddPayment] Add payment action initiated');
    console.log('📋 Selected item for action:', selectedItemForAction);
    
    if (!selectedItemForAction) {
      console.warn('⚠️ [handleAddPayment] No selected item for action, aborting payment addition');
      return;
    }
    
    console.log(`👤 [handleAddPayment] Adding payment for student: ID=${selectedItemForAction.id}, Name="${selectedItemForAction.name}"`);
    console.log(`📊 [handleAddPayment] Student details:`, {
      id: selectedItemForAction.id,
      name: selectedItemForAction.name,
      contact: selectedItemForAction.contact_number,
      seat: selectedItemForAction.seat_number,
      membership_till: selectedItemForAction.membership_till
    });
    
    const initialPaymentData = {
      amount: '',
      method: 'cash',
      type: 'monthly_fee',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    };
    
    console.log('💳 [handleAddPayment] Setting initial payment form data:', initialPaymentData);
    setPaymentData(initialPaymentData);
    setAddPaymentOpen(true);
    console.log('✅ [handleAddPayment] Add payment dialog opened successfully');
    // Note: handleActionClose() will be called after payment is confirmed or cancelled
  };

  // Remove student handler
  const handleRemoveStudent = () => {
    setDeleteConfirmOpen(true);
    handleActionClose();
  };

  // View student details handler
  const handleViewStudent = async () => {
    console.log('👀 [handleViewStudent] View student action initiated');
    console.log('📋 Selected item for action:', selectedItemForAction);
    
    if (!selectedItemForAction) {
      console.warn('⚠️ [handleViewStudent] No selected item for action, aborting view');
      return;
    }
    
    console.log(`👤 [handleViewStudent] Viewing student details: ID=${selectedItemForAction.id}, Name="${selectedItemForAction.name}"`);
    console.log(`📞 [handleViewStudent] Contact: ${selectedItemForAction.contact_number || 'Not provided'}`);
    console.log(`👫 [handleViewStudent] Gender: ${selectedItemForAction.sex || 'Not specified'}`);
    console.log(`🪑 [handleViewStudent] Seat assignment: ${selectedItemForAction.seat_number || 'Unassigned'}`);
    console.log(`📅 [handleViewStudent] Membership until: ${selectedItemForAction.membership_till || 'Not set'}`);
    
    // Store student data for the view dialog
    setViewStudentData({ ...selectedItemForAction });
    
    // Fetch total paid amount for this student
    try {
      console.log('🌐 [handleViewStudent] Fetching payment data for total calculation...');
      const response = await fetch(`/api/payments/student/${selectedItemForAction.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const payments = await response.json();
        console.log('💰 [handleViewStudent] Raw payment data received:', payments);
        console.log('💰 [handleViewStudent] Sample payment structure:', payments[0]);
        
        // Calculate total with proper number conversion and logging
        let totalPaid = 0;
        payments.forEach((payment, index) => {
          const rawAmount = payment.amount;
          const parsedAmount = parseFloat(rawAmount);
          const safeAmount = isNaN(parsedAmount) ? 0 : parsedAmount;
          
          console.log(`💰 [handleViewStudent] Payment ${index + 1}:`, {
            raw: rawAmount,
            parsed: parsedAmount,
            safe: safeAmount,
            type: typeof rawAmount
          });
          
          totalPaid += safeAmount;
        });
        
        console.log(`💰 [handleViewStudent] Final total calculated: ₹${totalPaid} from ${payments.length} payments`);
        setViewStudentTotalPaid(totalPaid);
      } else {
        console.warn('⚠️ [handleViewStudent] Failed to fetch payment data, setting total paid to 0');
        setViewStudentTotalPaid(0);
      }
    } catch (error) {
      console.error('❌ [handleViewStudent] Error fetching payment data:', error);
      setViewStudentTotalPaid(0);
    }
    
    setViewStudentOpen(true);
    console.log('✅ [handleViewStudent] View dialog opened successfully');
    handleActionClose(); // Close the action menu
  };

  // Edit student from view dialog
  const handleEditFromView = () => {
    console.log('🔄 [handleEditFromView] Edit from view action initiated');
    console.log('📋 View student data:', viewStudentData);
    
    if (!viewStudentData) {
      console.warn('⚠️ [handleEditFromView] No view student data available, aborting edit from view');
      return;
    }
    
    console.log(`👤 [handleEditFromView] Transitioning to edit mode for student: ID=${viewStudentData.id}, Name="${viewStudentData.name}"`);
    console.log('🔚 [handleEditFromView] Closing view dialog');
    setViewStudentOpen(false);
    
    const editData = {
      id: viewStudentData.id,
      name: viewStudentData.name,
      contactNumber: viewStudentData.contact_number,
      sex: viewStudentData.sex,
      seatNumber: viewStudentData.seat_number || '',
      membershipDate: viewStudentData.membership_date ? viewStudentData.membership_date.split('T')[0] : '',
      membershipTill: viewStudentData.membership_till ? viewStudentData.membership_till.split('T')[0] : ''
    };
    
    console.log('📝 [handleEditFromView] Setting edit form data:', editData);
    console.log(`📞 [handleEditFromView] Contact being set: ${viewStudentData.contact_number || 'Not provided'}`);
    console.log(`👫 [handleEditFromView] Gender being set: ${viewStudentData.sex || 'Not specified'}`);
    console.log(`🪑 [handleEditFromView] Seat being set: ${viewStudentData.seat_number || 'Unassigned'}`);
    
    // Set selectedItemForAction for the edit functions to work
    setSelectedItemForAction({ ...viewStudentData });
    setEditStudent(editData);
    
    // Fetch available seats if gender is available
    if (editData.sex) {
      fetchEditAvailableSeats(editData.sex, editData.seatNumber);
    }
    
    setEditStudentOpen(true);
    console.log('✅ [handleEditFromView] Successfully transitioned from view to edit mode');
  };

  // Confirm delete student
  const confirmDeleteStudent = async () => {
    if (!selectedItemForAction) return;
    
    try {
      const response = await fetch(`/api/students/${selectedItemForAction.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete student');

      setSnackbarMessage('Student removed successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setDeleteConfirmOpen(false);
      fetchData();
    } catch (err) {
      handleApiError(err, 'Failed to remove student');
    }
  };

  // Confirm assign seat
  const handleConfirmAssignSeat = async () => {
    try {
      const response = await fetch('/api/seats/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          seatNumber: selectedItemForAction.seat_number,
          studentId: assignSeatData.studentId
        })
      });

      if (!response.ok) throw new Error('Failed to assign seat');

      setSnackbarMessage('Seat assigned successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setAssignSeatOpen(false);
      setAssignSeatData({ seatNumber: '', studentId: '' });
      fetchData();
    } catch (err) {
      handleApiError(err, 'Failed to assign seat');
    }
  };

  // Confirm add payment
  const handleConfirmAddPayment = async () => {
    console.log('💰✅ [handleConfirmAddPayment] Starting payment creation process');
    console.log('📋 Selected item for action:', selectedItemForAction);
    console.log('💳 Payment form data:', paymentData);
    
    if (!selectedItemForAction) {
      console.warn('⚠️ [handleConfirmAddPayment] No selected item for action, aborting payment creation');
      return;
    }
    
    console.log(`👤 [handleConfirmAddPayment] Creating payment for student: ID=${selectedItemForAction.id}, Name="${selectedItemForAction.name}"`);
    
    // Frontend validation
    const validationErrors = [];
    if (!paymentData.amount || isNaN(paymentData.amount) || parseFloat(paymentData.amount) <= 0) {
      validationErrors.push('Valid payment amount is required');
    }
    if (!paymentData.method) {
      validationErrors.push('Payment method is required');
    }
    if (!paymentData.type) {
      validationErrors.push('Payment type is required');
    }
    if (!paymentData.date) {
      validationErrors.push('Payment date is required');
    }
    
    if (validationErrors.length > 0) {
      console.error('❌ [handleConfirmAddPayment] Frontend validation failed:', validationErrors);
      setSnackbarMessage('Please fill in all required fields: ' + validationErrors.join(', '));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Map frontend fields to backend fields
    const paymentPayload = {
      student_id: selectedItemForAction.id,
      amount: parseFloat(paymentData.amount),
      payment_date: paymentData.date,
      payment_mode: paymentData.method, // Map method to payment_mode
      payment_type: paymentData.type, // Map type to payment_type
      remarks: paymentData.notes || `Payment for ${selectedItemForAction.name}`,
      modified_by: 1 // Will be set by auth middleware but including for completeness
    };
    
    console.log('📤 [handleConfirmAddPayment] Payment payload to send:', paymentPayload);
    console.log(`💰 [handleConfirmAddPayment] Amount: ₹${paymentPayload.amount}, Method: ${paymentPayload.payment_mode}, Type: ${paymentPayload.payment_type}, Date: ${paymentPayload.payment_date}`);
    
    try {
      setPaymentLoading(true);
      console.log('🌐 [handleConfirmAddPayment] Sending POST request to /api/payments...');
      
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(paymentPayload)
      });

      console.log(`📡 [handleConfirmAddPayment] API Response status: ${response.status}`);
      console.log(`📡 [handleConfirmAddPayment] Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [handleConfirmAddPayment] API request failed:', errorData);
        throw new Error(errorData.error || `Failed to add payment (Status: ${response.status})`);
      }

      const responseData = await response.json();
      console.log('✅ [handleConfirmAddPayment] API Response data:', responseData);
      console.log('🎉 [handleConfirmAddPayment] Payment created successfully');

      setSnackbarMessage('Payment added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setAddPaymentOpen(false);
      
      // Reset form data
      const resetData = {
        amount: '',
        method: 'cash',
        type: 'monthly_fee',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      };
      console.log('🔄 [handleConfirmAddPayment] Resetting payment form data:', resetData);
      setPaymentData(resetData);
      
      // Close action menu after successful payment
      handleActionClose();
      
      console.log('🔄 [handleConfirmAddPayment] Refreshing data...');
      fetchData();
    } catch (err) {
      console.error('❌ [handleConfirmAddPayment] Error occurred during payment creation:', err);
      console.error('🔍 [handleConfirmAddPayment] Error details:', {
        message: err.message,
        stack: err.stack,
        studentId: selectedItemForAction?.id,
        paymentData: paymentData,
        paymentPayload: paymentPayload
      });
      handleApiError(err, 'Failed to add payment');
    } finally {
      setPaymentLoading(false);
      console.log('🔄 [handleConfirmAddPayment] Payment loading state set to false');
    }
  };

  // Confirm edit student
  const handleConfirmEditStudent = async () => {
    console.log('✅ [handleConfirmEditStudent] Starting student update process');
    console.log('📋 Selected item for action:', selectedItemForAction);
    console.log('📝 Edit student form data:', editStudent);
    
    // Use editStudent.id if selectedItemForAction is null but editStudent has an ID
    const studentId = selectedItemForAction?.id || editStudent?.id;
    
    if (!studentId) {
      console.warn('⚠️ [handleConfirmEditStudent] No student ID available, aborting update');
      console.error('🔍 [handleConfirmEditStudent] Debug info:', {
        selectedItemForAction,
        editStudent,
        extractedId: studentId
      });
      return;
    }
    
    console.log(`👤 [handleConfirmEditStudent] Using student ID: ${studentId} (source: ${selectedItemForAction?.id ? 'selectedItemForAction' : 'editStudent'})`);
    
    const updateData = {
      name: editStudent.name,
      contact_number: editStudent.contactNumber,
      sex: editStudent.sex,
      seat_number: editStudent.seatNumber || null,
      membership_date: editStudent.membershipDate || null,
      membership_till: editStudent.membershipTill || null
    };
    
    console.log('📊 [handleConfirmEditStudent] Update payload:', updateData);
    console.log(`🪑 [handleConfirmEditStudent] Seat assignment: ${editStudent.seatNumber ? `Seat #${editStudent.seatNumber}` : 'No seat assigned'}`);
    console.log(`📅 [handleConfirmEditStudent] Membership period: ${editStudent.membershipDate ? `From ${editStudent.membershipDate}` : 'No start date'} ${editStudent.membershipTill ? `to ${editStudent.membershipTill}` : 'to no end date'}`);
    
    try {
      console.log('🌐 [handleConfirmEditStudent] Sending PUT request to API...');
      const response = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(updateData)
      });

      console.log(`📡 [handleConfirmEditStudent] API Response status: ${response.status}`);
      
      if (!response.ok) {
        console.error('❌ [handleConfirmEditStudent] API request failed');
        throw new Error('Failed to update student');
      }

      const responseData = await response.json();
      console.log('✅ [handleConfirmEditStudent] API Response data:', responseData);
      console.log('🎉 [handleConfirmEditStudent] Student updated successfully');

      setSnackbarMessage('Student updated successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setEditStudentOpen(false);
      setEditAvailableSeats([]);
      
      console.log('🔄 [handleConfirmEditStudent] Refreshing data...');
      fetchData();
    } catch (err) {
      console.error('❌ [handleConfirmEditStudent] Error occurred during student update:', err);
      console.error('🔍 [handleConfirmEditStudent] Error details:', {
        message: err.message,
        stack: err.stack,
        studentId: studentId,
        editData: editStudent
      });
      handleApiError(err, 'Failed to update student');
    }
  };

  // Render Dashboard Stats - Mobile Optimized
  const renderStats = () => {
    if (isMobile) {
      // Mobile layout: Horizontal scrollable with compact cards
      return (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              overflowX: 'auto',
              gap: 1.5,
              pb: 1,
              '&::-webkit-scrollbar': {
                height: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#c1c1c1',
                borderRadius: '4px',
              },
            }}
          >
            {/* Total Students */}
            <Card 
              sx={{ 
                minWidth: 100,
                cursor: 'pointer', 
                bgcolor: activeStatFilter === 'totalStudents' ? 'primary.light' : 'background.paper',
                '&:hover': { bgcolor: 'primary.light' },
                borderRadius: 2,
                boxShadow: 1
              }}
              onClick={() => handleStatClick('totalStudents')}
            >
              <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <PersonIcon sx={{ color: 'primary.main', fontSize: 16, mr: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {stats.totalStudents}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Students</Typography>
              </CardContent>
            </Card>

            {/* Available Seats */}
            <Card 
              sx={{ 
                minWidth: 100,
                cursor: 'pointer', 
                bgcolor: activeStatFilter === 'available' ? 'info.light' : 'background.paper',
                '&:hover': { bgcolor: 'info.light' },
                borderRadius: 2,
                boxShadow: 1
              }}
              onClick={() => handleStatClick('available')}
            >
              <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <EventSeatIcon sx={{ color: 'info.main', fontSize: 16, mr: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold" color="info.main">
                    {stats.availableSeats}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Available</Typography>
              </CardContent>
            </Card>

            {/* Expiring Soon */}
            <Card 
              sx={{ 
                minWidth: 100,
                cursor: 'pointer', 
                bgcolor: activeStatFilter === 'expiring' ? 'warning.light' : 'background.paper',
                '&:hover': { bgcolor: 'warning.light' },
                borderRadius: 2,
                boxShadow: 1
              }}
              onClick={() => handleStatClick('expiring')}
            >
              <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <AccessTimeIcon sx={{ color: 'warning.main', fontSize: 16, mr: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold" color="warning.main">
                    {stats.expiringSeats}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Expiring</Typography>
              </CardContent>
            </Card>

            {/* Assigned Seats */}
            <Card 
              sx={{ 
                minWidth: 100,
                cursor: 'pointer', 
                bgcolor: activeStatFilter === 'assigned' ? 'success.light' : 'background.paper',
                '&:hover': { bgcolor: 'success.light' },
                borderRadius: 2,
                boxShadow: 1
              }}
              onClick={() => handleStatClick('assigned')}
            >
              <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <EventSeatIcon sx={{ color: 'success.main', fontSize: 16, mr: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {stats.assignedSeats}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Assigned</Typography>
              </CardContent>
            </Card>

            {/* Unassigned */}
            <Card 
              sx={{ 
                minWidth: 100,
                cursor: 'pointer', 
                bgcolor: activeStatFilter === 'unassigned' ? 'error.light' : 'background.paper',
                '&:hover': { bgcolor: 'error.light' },
                borderRadius: 2,
                boxShadow: 1
              }}
              onClick={() => handleStatClick('unassigned')}
            >
              <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <PersonIcon sx={{ color: 'error.main', fontSize: 16, mr: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold" color="error.main">
                    {stats.unassignedStudents}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Unassigned</Typography>
              </CardContent>
            </Card>

            {/* Total Seats */}
            <Card 
              sx={{ 
                minWidth: 120, 
                borderRadius: 2, 
                boxShadow: 1,
                cursor: 'pointer', 
                bgcolor: activeStatFilter === 'total' ? 'grey.200' : 'background.paper',
                '&:hover': { bgcolor: 'grey.200' }
              }}
              onClick={() => handleStatClick('total')}
            >
              <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <EventSeatIcon sx={{ color: 'text.secondary', fontSize: 16, mr: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold">
                    {stats.totalSeats}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block' }}>Total Seats</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <ManIcon sx={{ color: 'primary.main', fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.maleSeats}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <WomanIcon sx={{ color: 'secondary.main', fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.femaleSeats}</Typography>
                  </Box>
                  {stats.neutralSeats > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                        +{stats.neutralSeats}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
          
          {/* Clear filter hint */}
          {activeStatFilter && (
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Chip
                label={`Filtered by: ${activeStatFilter}`}
                onDelete={() => handleStatClick(null)}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
          )}
        </Box>
      );
    }

    // Desktop layout: Grid with larger cards
    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              bgcolor: activeStatFilter === 'totalStudents' ? 'primary.light' : 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: 'primary.light',
                transform: 'translateY(-2px)',
                boxShadow: 3
              }
            }}
            onClick={() => handleStatClick('totalStudents')}
          >
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <PersonIcon sx={{ color: 'primary.main', fontSize: 20, mr: 1 }} />
                <Typography variant="h5" fontWeight="bold" color="primary">
                  {stats.totalStudents}
                </Typography>
              </Box>
              <Typography variant="body2">Total Students</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              bgcolor: activeStatFilter === 'available' ? 'info.light' : 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: 'info.light',
                transform: 'translateY(-2px)',
                boxShadow: 3
              }
            }}
            onClick={() => handleStatClick('available')}
          >
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <EventSeatIcon sx={{ color: 'info.main', fontSize: 20, mr: 1 }} />
                <Typography variant="h5" fontWeight="bold" color="info.main">
                  {stats.availableSeats}
                </Typography>
              </Box>
              <Typography variant="body2">Available Seats</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              bgcolor: activeStatFilter === 'expiring' ? 'warning.light' : 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: 'warning.light',
                transform: 'translateY(-2px)',
                boxShadow: 3
              }
            }}
            onClick={() => handleStatClick('expiring')}
          >
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <AccessTimeIcon sx={{ color: 'warning.main', fontSize: 20, mr: 1 }} />
                <Typography variant="h5" fontWeight="bold" color="warning.main">
                  {stats.expiringSeats}
                </Typography>
              </Box>
              <Typography variant="body2">Expiring Soon</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              bgcolor: activeStatFilter === 'assigned' ? 'success.light' : 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: 'success.light',
                transform: 'translateY(-2px)',
                boxShadow: 3
              }
            }}
            onClick={() => handleStatClick('assigned')}
          >
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <EventSeatIcon sx={{ color: 'success.main', fontSize: 20, mr: 1 }} />
                <Typography variant="h5" fontWeight="bold" color="success.main">
                  {stats.assignedSeats}
                </Typography>
              </Box>
              <Typography variant="body2">Assigned Seats</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              bgcolor: activeStatFilter === 'unassigned' ? 'error.light' : 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: 'error.light',
                transform: 'translateY(-2px)',
                boxShadow: 3
              }
            }}
            onClick={() => handleStatClick('unassigned')}
          >
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <PersonIcon sx={{ color: 'error.main', fontSize: 20, mr: 1 }} />
                <Typography variant="h5" fontWeight="bold" color="error.main">
                  {stats.unassignedStudents}
                </Typography>
              </Box>
              <Typography variant="body2">Unassigned</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              bgcolor: activeStatFilter === 'total' ? 'grey.200' : 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: 'grey.200',
                transform: 'translateY(-2px)',
                boxShadow: 3
              }
            }}
            onClick={() => handleStatClick('total')}
          >
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <EventSeatIcon sx={{ color: 'text.secondary', fontSize: 20, mr: 1 }} />
                <Typography variant="h5" fontWeight="bold">
                  {stats.totalSeats}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Total Seats</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ManIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                  <Typography variant="caption" color="primary.main" fontWeight="medium">
                    {stats.maleSeats}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <WomanIcon sx={{ color: 'secondary.main', fontSize: 16 }} />
                  <Typography variant="caption" color="secondary.main" fontWeight="medium">
                    {stats.femaleSeats}
                  </Typography>
                </Box>
                {stats.neutralSeats > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium">
                      +{stats.neutralSeats}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render filters based on current tab
  const renderFilters = () => {
    const activeFilters = {};
    const filterCount = Object.values({
      seatNumber: seatNumberFilter,
      status: statusFilter,
      gender: genderFilter,
      studentName: studentNameFilter,
      contact: contactFilter
    }).filter(value => value && value !== '').length;

    // Build active filters object for chips
    if (seatNumberFilter) activeFilters.seat = seatNumberFilter;
    if (statusFilter) activeFilters.status = statusFilter;
    if (genderFilter) activeFilters.gender = genderFilter;
    if (studentNameFilter) activeFilters.name = studentNameFilter;
    if (contactFilter) activeFilters.contact = contactFilter;

    const handleFilterRemove = (filterKey) => {
      switch (filterKey) {
        case 'seat': setSeatNumberFilter(''); break;
        case 'status': setStatusFilter(''); break;
        case 'gender': setGenderFilter(''); break;
        case 'name': setStudentNameFilter(''); break;
        case 'contact': setContactFilter(''); break;
      }
    };

    const filterContent = (
      <>
        {currentTab === 0 && (
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Seat Number"
              value={seatNumberFilter}
              onChange={(e) => setSeatNumberFilter(e.target.value)}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="occupied">Occupied</MenuItem>
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="expiring">Expiring</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                label="Gender"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}
        
        {currentTab === 1 && (
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Student Name"
              value={studentNameFilter}
              onChange={(e) => setStudentNameFilter(e.target.value)}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="assigned">Assigned</MenuItem>
                <MenuItem value="unassigned">Unassigned</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                label="Gender"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Contact"
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
              fullWidth
            />
          </Stack>
        )}
      </>
    );

    return (
      <MobileFilters
        title={currentTab === 0 ? "Seat Filters" : "Student Filters"}
        filterCount={filterCount}
        onClearAll={clearAllFilters}
        activeFilters={activeFilters}
        onFilterRemove={handleFilterRemove}
        variant={isMobile ? "drawer" : "collapse"}
      >
        {filterContent}
      </MobileFilters>
    );
  };

  // Render Seats View
  const renderSeatsView = () => (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table size={isMobile ? "small" : "medium"} sx={{ minWidth: isMobile ? 600 : 'auto' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ 
              position: isMobile ? 'sticky' : 'static',
              left: 0,
              bgcolor: 'background.paper',
              zIndex: isMobile ? 10 : 'auto',
              minWidth: 120
            }}>
              <strong>Seat#</strong>
            </TableCell>
            <TableCell sx={{ 
              position: isMobile ? 'sticky' : 'static',
              left: isMobile ? 120 : 'auto',
              bgcolor: 'background.paper',
              zIndex: isMobile ? 10 : 'auto',
              minWidth: 200,
              borderLeft: isMobile ? '1px solid rgba(224, 224, 224, 1)' : 'none'
            }}>
              <strong>Student Details</strong>
            </TableCell>
            <TableCell sx={{ 
              minWidth: 80,
              position: 'sticky',
              right: 0,
              bgcolor: 'background.paper',
              zIndex: isMobile ? 10 : 'auto',
              borderLeft: '1px solid rgba(224, 224, 224, 1)'
            }}>
              <strong>Actions</strong>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredData.filter(seat => seat && seat.seatNumber).map((seat) => (
            <TableRow key={seat.seatNumber}>
              <TableCell sx={{ 
                position: isMobile ? 'sticky' : 'static',
                left: 0,
                bgcolor: 'background.paper',
                zIndex: isMobile ? 5 : 'auto'
              }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EventSeatIcon 
                      sx={{ 
                        color: seat.occupied 
                          ? (seat.gender === 'female' ? 'secondary.main' : 'primary.main')
                          : 'grey.500',
                        fontSize: 20
                      }} 
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 'medium',
                        color: 'text.primary'
                      }}
                    >
                      #{seat.seatNumber}
                    </Typography>
                  </Box>
                  {seat.expiring ? (
                    <Chip label="Expiring" color="warning" size="small" />
                  ) : seat.occupied ? (
                    <Chip label="Occupied" color="success" size="small" />
                  ) : (
                    <Chip label="Available" variant="outlined" size="small" />
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ 
                position: isMobile ? 'sticky' : 'static',
                left: isMobile ? 120 : 'auto',
                bgcolor: 'background.paper',
                zIndex: isMobile ? 5 : 'auto',
                borderLeft: isMobile ? '1px solid rgba(224, 224, 224, 1)' : 'none'
              }}>
                {seat.studentName ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {seat.gender === 'female' ? 
                        <WomanIcon sx={{ color: 'secondary.main', fontSize: 18 }} /> :
                        <ManIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                      }
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 'medium',
                          cursor: 'pointer',
                          color: 'primary.main',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                        onClick={() => {
                          // Find the student by ID or name to set as selected item
                          const student = students.find(s => s.id === seat.studentId);
                          if (student) {
                            setSelectedItemForAction(student);
                            handleViewStudent();
                          }
                        }}
                      >
                        {seat.studentName}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 3 }}>
                      ID: {seat.studentId || 'N/A'}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">Empty</Typography>
                )}
              </TableCell>
              <TableCell sx={{ 
                position: 'sticky',
                right: 0,
                bgcolor: 'background.paper',
                zIndex: isMobile ? 5 : 'auto',
                borderLeft: '1px solid rgba(224, 224, 224, 1)'
              }}>
                <IconButton 
                  size="small" 
                  onClick={(e) => handleActionClick(e, seat)}
                  sx={{ 
                    zIndex: 100,
                    position: 'relative'
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Render Students View
  const renderStudentsView = () => (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table size={isMobile ? "small" : "medium"} sx={{ minWidth: isMobile ? 450 : 'auto' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ 
              position: isMobile ? 'sticky' : 'static',
              left: 0,
              bgcolor: 'background.paper',
              zIndex: isMobile ? 10 : 'auto',
              minWidth: 120
            }}>
              <strong>Student ID</strong>
            </TableCell>
            <TableCell sx={{ 
              position: isMobile ? 'sticky' : 'static',
              left: isMobile ? 120 : 'auto',
              bgcolor: 'background.paper',
              zIndex: isMobile ? 10 : 'auto',
              minWidth: 250,
              borderLeft: isMobile ? '1px solid rgba(224, 224, 224, 1)' : 'none'
            }}>
              <strong>Name</strong>
            </TableCell>
            <TableCell sx={{ 
              minWidth: 80,
              position: 'sticky',
              right: 0,
              bgcolor: 'background.paper',
              zIndex: isMobile ? 10 : 'auto',
              borderLeft: '1px solid rgba(224, 224, 224, 1)'
            }}>
              <strong>Actions</strong>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredData.filter(student => student && student.id).map((student) => (
            <TableRow key={student.id}>
              <TableCell sx={{ 
                position: isMobile ? 'sticky' : 'static',
                left: 0,
                bgcolor: 'background.paper',
                zIndex: isMobile ? 5 : 'auto'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 'medium',
                      cursor: 'pointer',
                      color: 'primary.main',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                    onClick={() => {
                      setSelectedItemForAction(student);
                      handleViewStudent();
                    }}
                  >
                    {student.id}
                  </Typography>
                  <Chip 
                    icon={student.seat_number ? <EventSeatIcon sx={{ fontSize: 14 }} /> : undefined}
                    label={student.seat_number || 'Unassigned'} 
                    color={student.seat_number ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </TableCell>
              <TableCell sx={{ 
                position: isMobile ? 'sticky' : 'static',
                left: isMobile ? 120 : 'auto',
                bgcolor: 'background.paper',
                zIndex: isMobile ? 5 : 'auto',
                borderLeft: isMobile ? '1px solid rgba(224, 224, 224, 1)' : 'none'
              }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {student.sex === 'female' ? 
                      <WomanIcon sx={{ color: 'secondary.main', fontSize: 18 }} /> :
                      <ManIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                    }
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'medium',
                        cursor: 'pointer',
                        color: 'primary.main',
                        '&:hover': {
                          textDecoration: 'underline'
                        }
                      }}
                      onClick={() => {
                        setSelectedItemForAction(student);
                        handleViewStudent();
                      }}
                    >
                      {student.name}
                    </Typography>
                  </Box>
                  {student.membership_till && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTimeIcon sx={{ color: 'grey.600', fontSize: 16 }} />
                      <Typography variant="caption" color="text.secondary">
                        Until: {formatDateForDisplay(student.membership_till)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ 
                position: 'sticky',
                right: 0,
                bgcolor: 'background.paper',
                zIndex: isMobile ? 5 : 'auto',
                borderLeft: '1px solid rgba(224, 224, 224, 1)'
              }}>
                <IconButton 
                  size="small" 
                  onClick={(e) => handleActionClick(e, student)}
                  sx={{ 
                    zIndex: 100,
                    position: 'relative'
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={fetchData} sx={{ mt: 2 }}>Try Again</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">
          👥 Students
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            size={isMobile ? "small" : "medium"}
          >
            Add Student
          </Button>
          <IconButton 
            onClick={fetchData} 
            color="primary"
            sx={{ 
              bgcolor: theme.palette.primary.main + '10',
              '&:hover': { bgcolor: theme.palette.primary.main + '20' }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Dashboard Stats */}
      {renderStats()}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          variant={isMobile ? "fullWidth" : "standard"}
        >
          <Tab label="Seats View" />
          <Tab label="Students View" />
        </Tabs>
      </Paper>

      {/* Filters */}
      {renderFilters()}

      {/* Content */}
      {currentTab === 0 && renderSeatsView()}
      {currentTab === 1 && renderStudentsView()}

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {currentTab === 0 && selectedItemForAction && [ // Seats View Actions
          <MenuItem key="history" onClick={handleSeatHistory}>
            <ListItemIcon>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Seat History</ListItemText>
          </MenuItem>
        ]}
        
        {currentTab === 1 && selectedItemForAction && [ // Students View Actions
          <MenuItem key="viewStudent" onClick={handleViewStudent}>
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Student Details</ListItemText>
          </MenuItem>,
          <MenuItem key="addPayment" onClick={handleAddPayment}>
            <ListItemIcon>
              <PaymentIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add Payment</ListItemText>
          </MenuItem>,
          <MenuItem key="editStudent" onClick={handleEditStudent}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Student</ListItemText>
          </MenuItem>,
          <MenuItem key="paymentHistory" onClick={handlePaymentHistory}>
            <ListItemIcon>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Payment History</ListItemText>
          </MenuItem>,
          <MenuItem key="seatHistory" onClick={handleSeatHistory}>
            <ListItemIcon>
              <EventSeatIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Seat Change History</ListItemText>
          </MenuItem>,
          <Divider key="divider" />,
          <MenuItem key="remove" onClick={handleRemoveStudent} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Remove Student</ListItemText>
          </MenuItem>
        ]}
      </Menu>

      {/* Add Student Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Student</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Student Name *"
              value={newStudent.name}
              onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
              required
              error={!newStudent.name.trim()}
              helperText={!newStudent.name.trim() ? "Name is required" : ""}
            />
            <FormControl fullWidth required error={!newStudent.sex}>
              <InputLabel>Gender *</InputLabel>
              <Select
                value={newStudent.sex}
                onChange={(e) => handleGenderChange(e.target.value)}
                label="Gender *"
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
              {!newStudent.sex && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  Gender is required
                </Typography>
              )}
            </FormControl>
            <FormControl fullWidth disabled={!newStudent.sex || seatLoading}>
              <InputLabel>Seat Number</InputLabel>
              <Select
                value={newStudent.seat_number}
                onChange={(e) => setNewStudent({ ...newStudent, seat_number: e.target.value })}
                label="Seat Number"
              >
                {seatLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading seats...
                  </MenuItem>
                ) : availableSeats.length > 0 ? (
                  availableSeats.map((seat) => (
                    <MenuItem key={seat.seat_number} value={seat.seat_number}>
                      Seat #{seat.seat_number}
                      {seat.floor_number && ` (Floor ${seat.floor_number})`}
                    </MenuItem>
                  ))
                ) : newStudent.sex ? (
                  <MenuItem disabled>No available seats for {newStudent.sex} students</MenuItem>
                ) : (
                  <MenuItem disabled>Select gender first to see available seats</MenuItem>
                )}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                {newStudent.sex ? 
                  `${availableSeats.length} seats available for ${newStudent.sex} students` :
                  "Select gender to see available seats"
                }
              </Typography>
            </FormControl>
            <TextField
              fullWidth
              label="Contact Number"
              value={newStudent.contact}
              onChange={(e) => setNewStudent({ ...newStudent, contact: e.target.value })}
              placeholder="10-digit mobile number"
            />
            <TextField
              fullWidth
              label="Father's Name"
              value={newStudent.fatherName}
              onChange={(e) => setNewStudent({ ...newStudent, fatherName: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddDialogOpen(false);
            setNewStudent({ name: '', seatNumber: '', contact: '', sex: '', fatherName: '' });
            setAvailableSeats([]);
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddStudent}
            disabled={addStudentLoading || !newStudent.name.trim() || !newStudent.sex}
          >
            {addStudentLoading ? 'Adding...' : 'Add Student'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Seat History Dialog */}
      <Dialog open={seatHistoryOpen} onClose={() => setSeatHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {seatHistoryContext?.contextTab === 0 
            ? `Seat History - ${seatHistoryContext?.seatNumber || seatHistoryContext?.seat_number || 'Unknown'}`
            : (() => {
                // For student tab, prioritize student info but fallback gracefully
                const studentName = seatHistoryContext?.name || seatHistoryContext?.student_name;
                const studentId = seatHistoryContext?.id;
                const seatNumber = seatHistoryContext?.seatNumber || seatHistoryContext?.seat_number;
                
                if (studentName) {
                  return `Seat Change History - ${studentName}`;
                } else if (studentId) {
                  return `Seat Change History - Student ID: ${studentId}`;
                } else if (seatNumber) {
                  return `Seat History - Seat #${seatNumber}`;
                } else {
                  return 'Seat History - Unknown';
                }
              })()
          }
        </DialogTitle>
        <DialogContent>
          {seatHistory.length === 0 ? (
            <Typography>
              {seatHistoryContext?.contextTab === 0 
                ? 'No history available for this seat.'
                : 'No seat assignment history available for this student.'
              }
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {seatHistoryContext?.contextTab === 0 ? (
                      <>
                        <TableCell>Student</TableCell>
                        <TableCell>Period</TableCell>
                        <TableCell>Status</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>Seat Number</TableCell>
                        <TableCell>Period</TableCell>
                        <TableCell>Status</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {seatHistory.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {seatHistoryContext?.contextTab === 0 
                          ? (entry.student_name || 'N/A')
                          : (entry.seat_number || 'N/A')
                        }
                      </TableCell>
                      <TableCell>
                        {formatDateForDisplay(entry.start_date)} - {entry.end_date ? formatDateForDisplay(entry.end_date) : 'Current'}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={entry.assignment_status} 
                          color={entry.assignment_status === 'Current' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeatHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Assign Seat Dialog */}
      <Dialog open={assignSeatOpen} onClose={() => setAssignSeatOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Seat #{selectedItemForAction?.seatNumber}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Select Student</InputLabel>
              <Select
                value={assignSeatData.studentId}
                onChange={(e) => setAssignSeatData({ ...assignSeatData, studentId: e.target.value })}
                label="Select Student"
              >
                {(() => {
                  console.log('🔍 [Assign Seat Dialog] Debugging student data:');
                  console.log('Total students array length:', students.length);
                  console.log('Students array:', students);
                  
                  // Filter out null/undefined students first
                  const validStudents = students.filter(student => student && typeof student === 'object');
                  console.log('Valid students after null check:', validStudents.length);
                  
                  // Then filter for unassigned students
                  const unassignedStudents = validStudents.filter(student => {
                    const hasNoSeat = !student.seat_number && student.seat_number !== 0;
                    console.log(`Student ${student.name} (ID: ${student.id}): seat_number=${student.seat_number}, hasNoSeat=${hasNoSeat}`);
                    return hasNoSeat;
                  });
                  
                  console.log('Unassigned students:', unassignedStudents.length);
                  console.log('Unassigned students data:', unassignedStudents);
                  
                  if (unassignedStudents.length === 0) {
                    return (
                      <MenuItem disabled>
                        No unassigned students available
                      </MenuItem>
                    );
                  }
                  
                  return unassignedStudents.map((student) => (
                    <MenuItem key={student.id} value={student.id}>
                      {student.name} (ID: {student.id})
                      {student.seat_number && ` - Currently: Seat ${student.seat_number}`}
                    </MenuItem>
                  ));
                })()}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                {(() => {
                  const validStudents = students.filter(student => student && typeof student === 'object');
                  const unassignedCount = validStudents.filter(student => !student.seat_number && student.seat_number !== 0).length;
                  return `${unassignedCount} unassigned students available`;
                })()}
              </Typography>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignSeatOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmAssignSeat}
            disabled={!assignSeatData.studentId}
          >
            Assign Seat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={paymentHistoryOpen} onClose={() => setPaymentHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Payment History - {selectedItemForAction?.name}
        </DialogTitle>
        <DialogContent>
          {paymentHistory.length === 0 ? (
            <Typography>No payment history available for this student.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentHistory.filter(payment => payment && payment.id).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDateForDisplay(payment.payment_date)}</TableCell>
                      <TableCell>₹{payment.amount}</TableCell>
                      <TableCell>{payment.payment_mode}</TableCell>
                      <TableCell>{payment.payment_type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={addPaymentOpen} onClose={() => {
        setAddPaymentOpen(false);
        handleActionClose();
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payment - {selectedItemForAction?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={paymentData.amount}
              onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={paymentData.method}
                onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                label="Payment Method"
              >
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="online">Online</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Payment Type</InputLabel>
              <Select
                value={paymentData.type}
                onChange={(e) => setPaymentData({ ...paymentData, type: e.target.value })}
                label="Payment Type"
              >
                <MenuItem value="monthly_fee">Monthly Fee</MenuItem>
                <MenuItem value="refund">Refund</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={paymentData.date}
              onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddPaymentOpen(false);
            handleActionClose();
          }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmAddPayment}
            disabled={!paymentData.amount || !paymentData.method}
          >
            Add Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={editStudentOpen} onClose={() => {
        setEditStudentOpen(false);
        setEditAvailableSeats([]);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Student</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Student Name"
              value={editStudent.name}
              onChange={(e) => setEditStudent({ ...editStudent, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="Contact Number"
              value={editStudent.contactNumber}
              onChange={(e) => setEditStudent({ ...editStudent, contactNumber: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={editStudent.sex}
                onChange={(e) => handleEditGenderChange(e.target.value)}
                label="Gender"
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth disabled={!editStudent.sex || editSeatLoading}>
              <InputLabel>Seat Number</InputLabel>
              <Select
                value={editStudent.seatNumber}
                onChange={(e) => setEditStudent({ ...editStudent, seatNumber: e.target.value })}
                label="Seat Number"
              >
                <MenuItem value="">
                  <em>No Seat Assigned</em>
                </MenuItem>
                {editSeatLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading seats...
                  </MenuItem>
                ) : editAvailableSeats.length > 0 ? (
                  editAvailableSeats.map((seat) => (
                    <MenuItem key={seat.seat_number} value={seat.seat_number}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span>Seat #{seat.seat_number}</span>
                        {seat.is_current && (
                          <Chip size="small" label="Current" color="primary" sx={{ ml: 1 }} />
                        )}
                        {seat.status === 'occupied' && !seat.is_current && (
                          <Chip size="small" label="Occupied" color="warning" sx={{ ml: 1 }} />
                        )}
                      </Box>
                      {seat.floor_number && ` (Floor ${seat.floor_number})`}
                    </MenuItem>
                  ))
                ) : editStudent.sex ? (
                  <MenuItem disabled>No available seats for {editStudent.sex} students</MenuItem>
                ) : (
                  <MenuItem disabled>Select gender first to see available seats</MenuItem>
                )}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                {editStudent.sex ? 
                  `${editAvailableSeats.filter(seat => !seat.is_current).length} additional seats available for ${editStudent.sex} students` :
                  "Select gender to see available seats"
                }
              </Typography>
            </FormControl>
            <TextField
              fullWidth
              label="Membership End Date"
              type="date"
              value={editStudent.membershipTill}
              onChange={(e) => setEditStudent({ ...editStudent, membershipTill: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditStudentOpen(false);
            setEditAvailableSeats([]);
          }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmEditStudent}
          >
            Update Student
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Student Details Dialog */}
      <Dialog open={viewStudentOpen} onClose={() => {
        setViewStudentOpen(false);
        setViewStudentTotalPaid(0);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>
          Student Details - {viewStudentData?.name || 'Unknown'}
        </DialogTitle>
        <DialogContent>
          {!viewStudentData ? (
            <Box sx={{ mt: 1, p: 2, textAlign: 'center' }}>
              <Typography color="error">No student data available</Typography>
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Student ID</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{viewStudentData.id || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {viewStudentData.sex === 'female' ? 
                      <WomanIcon sx={{ color: 'secondary.main', fontSize: 18 }} /> :
                      <ManIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                    }
                    <Typography variant="body1">{viewStudentData.name || 'N/A'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Gender</Typography>
                  <Typography variant="body1" sx={{ mb: 2, textTransform: 'capitalize' }}>
                    {viewStudentData.sex || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Contact Number</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{viewStudentData.contact_number || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Father's Name</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{viewStudentData.father_name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Current Seat</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {viewStudentData.seat_number ? (
                      <>
                        <EventSeatIcon sx={{ color: 'success.main', fontSize: 18 }} />
                        <Typography variant="body1">#{viewStudentData.seat_number}</Typography>
                      </>
                    ) : (
                      <Typography variant="body1" color="text.secondary">Unassigned</Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    label={viewStudentData.seat_number ? 'Assigned' : 'Unassigned'} 
                    color={viewStudentData.seat_number ? 'success' : 'error'}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Date Joined</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatDateForDisplay(viewStudentData.membership_date)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Membership Till</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatDateForDisplay(viewStudentData.membership_till)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Total Paid</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                      ₹{viewStudentTotalPaid.toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setViewStudentOpen(false);
            setViewStudentTotalPaid(0);
          }}>Close</Button>
          <Button 
            variant="contained" 
            onClick={handleEditFromView}
            startIcon={<EditIcon />}
          >
            Edit Student
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove student "{selectedItemForAction?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={confirmDeleteStudent}
          >
            Delete Student
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Students;
