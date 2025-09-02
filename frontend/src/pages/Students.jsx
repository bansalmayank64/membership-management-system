import { useState, useEffect, useMemo, useRef } from 'react';
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
  InputAdornment,
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
import { Autocomplete } from '@mui/material';
import MobileFilters from '../components/MobileFilters';
import Footer from '../components/Footer';
import logger from '../utils/clientLogger';
import { useAuth } from '../contexts/AuthContext';
import { getSeatChartData } from '../services/api';
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
  EventSeat as EventSeatIcon,
  Visibility as VisibilityIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
  SwapHoriz as SwapHorizIcon,
  LinkOff as LinkOffIcon,
  CalendarToday as CalendarTodayIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CloseIcon from '@mui/icons-material/Close';
 
function Students() {
  // Theme and mobile breakpoint detection
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Header ref and dynamic sticky offset for stats (prevents visual gap)
  const headerRef = useRef(null);
  const [stickyTopOffset, setStickyTopOffset] = useState(isMobile ? 56 : 80);
  // If the app has a left drawer open (permanent/persistent), measure its width so the header can be pushed
  const [drawerOffset, setDrawerOffset] = useState(0);

  // Authenticated user
  const { user } = useAuth();

  // Global API error handler (keeps parity with other pages)
  const handleApiError = (error, fallbackMessage = 'An error occurred') => {
    // If a token-expired error shape is returned by the backend/interceptor, allow global logic to handle it
    if (error?.response?.data?.error === 'TOKEN_EXPIRED') {
      return;
    }
    try {
      setError(error?.response?.data?.message || error?.message || fallbackMessage);
    } catch (e) {
      // If setError isn't available for some reason, fallback to logging
      logger.error('handleApiError failed to set error state', e, error);
    }
  };

  const openUnassignConfirm = (seat) => {
    setUnassignTargetSeat(seat);
    setConfirmUnassignOpen(true);
  };

  // Open change seat flow: reuse assign dialog but pre-fill student and open
  const handleChangeSeat = (seat) => {
    try {
      // Resolve student object for this seat
      const student = students.find(s => s && (s.id === seat.studentId || s.id === seat.studentId || s.id === seat.studentId));
      if (!student) {
        setSnackbarMessage('No student assigned to this seat');
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
        return;
      }
      // Reuse assign seat dialog UI for changing seat
      handleAssignSeatToStudent(student);
    } catch (err) {
      logger.error('❌ [handleChangeSeat] Error', err);
      setSnackbarMessage('Unable to start seat change');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Unassign seat from student: clear seat_number for the student assigned to this seat
  const handleUnassignSeat = async (seat) => {
    try {
      const student = students.find(s => s && (s.id === seat.studentId || s.id === seat.studentId));
      if (!student || !student.id) {
        setSnackbarMessage('No student assigned to this seat');
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
        return;
      }

      // Call API to update student and remove seat assignment
      const response = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ ...student, seat_number: null })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Failed to unassign seat: ${text}`);
      }

      setSnackbarMessage('Seat unassigned successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      fetchData();
    } catch (err) {
      logger.error('❌ [handleUnassignSeat] Error', err);
      handleApiError(err, 'Failed to unassign seat');
    }
  };

  // Local helper to format dates to IST for display (kept consistent with StudentProfile.jsx)
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      }).replace(/ /g, '-');
    } catch (err) {
      return 'N/A';
    }
  };

  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [assignSeatOpen, setAssignSeatOpen] = useState(false);
  // Aadhaar conflict dialog state
  const [aadhaarConflictOpen, setAadhaarConflictOpen] = useState(false);
  const [aadhaarConflictStudent, setAadhaarConflictStudent] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  
  // Menu states
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [selectedItemForAction, setSelectedItemForAction] = useState(null);
  
  // Reactivation state
  const [reactivateSelectedSeat, setReactivateSelectedSeat] = useState('');
  const [reactivateAvailableSeats, setReactivateAvailableSeats] = useState([]);
  
  // Assign seat state
  const [assignSeatDialogOpen, setAssignSeatDialogOpen] = useState(false);
  const [assignSelectedSeat, setAssignSelectedSeat] = useState('');
  const [assignAvailableSeats, setAssignAvailableSeats] = useState([]);
  const [studentForSeatAssignment, setStudentForSeatAssignment] = useState(null);
  // Unassign confirmation dialog state
  const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
  const [unassignTargetSeat, setUnassignTargetSeat] = useState(null);
  
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
  seat_number: '',
  contact: '',
  sex: '',
  fatherName: '',
  // default membership_date to today (YYYY-MM-DD)
  membership_date: new Date().toISOString().split('T')[0],
  aadhaar_number: '',
  address: ''
  });

  // Track whether user attempted to submit the Add Student form
  const [addAttempted, setAddAttempted] = useState(false);

  // Filter states (ensure these are declared to avoid runtime ReferenceErrors)
  const [seatNumberFilter, setSeatNumberFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [studentNameFilter, setStudentNameFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [activeStatFilter, setActiveStatFilter] = useState(null);

  // Keep per-tab filter state so Seats and Students filters are independent
  const [seatsFilters, setSeatsFilters] = useState({ seatNumber: '', status: '', gender: '' });
  // Include seatNumber in studentsFilters so Students tab can have its own seat-number filter independent from Seats view
  const [studentsFilters, setStudentsFilters] = useState({ studentName: '', status: '', gender: '', contact: '', seatNumber: '' });
  
  // Add Student dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  // Seat history dialog state
  const [seatHistoryOpen, setSeatHistoryOpen] = useState(false);
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Deactivate / refund states
  const [deactivateRefundAmount, setDeactivateRefundAmount] = useState(0);
  const [deactivateRefundDays, setDeactivateRefundDays] = useState(0);
  const [deactivateFeeConfig, setDeactivateFeeConfig] = useState(null);
  const [processingDeactivate, setProcessingDeactivate] = useState(false);

  // Reactivate confirmation dialog state
  const [reactivateConfirmOpen, setReactivateConfirmOpen] = useState(false);

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
      seat_number: '' // Reset seat selection when gender changes
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

  // Fetch available seats for reactivation
  const fetchReactivateAvailableSeats = async (gender) => {
    try {
      setReactivateAvailableSeats([]);
      if (!gender) return;

      const response = await fetch(`/api/students/available-seats/${gender}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch available seats');

      const data = await response.json();
      setReactivateAvailableSeats(data.availableSeats || []);
    } catch (err) {
      handleApiError(err, 'Failed to load available seats');
      setReactivateAvailableSeats([]);
    }
  };

  // Fetch available seats for assignment
  const fetchAssignAvailableSeats = async (gender) => {
    try {
      setAssignAvailableSeats([]);
      if (!gender) return;

      const response = await fetch(`/api/students/available-seats/${gender}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch available seats');

      const data = await response.json();
      setAssignAvailableSeats(data.availableSeats || []);
    } catch (err) {
      handleApiError(err, 'Failed to load available seats for assignment');
      setAssignAvailableSeats([]);
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
    aadhaarNumber: '',
    address: ''
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
  // Track whether user attempted to submit the Edit Student form
  const [editAttempted, setEditAttempted] = useState(false);
  const [editStudentLoading, setEditStudentLoading] = useState(false);
  const [viewStudentData, setViewStudentData] = useState(null); // Store student data for view dialog
  const [viewStudentTotalPaid, setViewStudentTotalPaid] = useState(0); // Store total paid amount for view dialog
  const [seatHistoryContext, setSeatHistoryContext] = useState(null); // Store context data for seat history dialog
  
  // Data states
  const [seatHistory, setSeatHistory] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  // Core data and loading/error states
  const [students, setStudents] = useState([]);
  const [seatData, setSeatData] = useState([]);
  const [unassignedSeats, setUnassignedSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // UI tab (0=Seats,1=Active,2=Inactive)
  const [currentTab, setCurrentTab] = useState(0);
  // Student view sub-tab: 0 = Active, 1 = Inactive
  const [studentSubTab, setStudentSubTab] = useState(0);
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

  // Fee configuration states
  const [feeConfig, setFeeConfig] = useState(null);
  const [membershipExtensionDays, setMembershipExtensionDays] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  // Measure header height (including margin-bottom) and update sticky top offset
  useEffect(() => {
    const measure = () => {
      try {
        if (headerRef && headerRef.current) {
          const rect = headerRef.current.getBoundingClientRect();
          const style = window.getComputedStyle(headerRef.current);
          const marginBottom = parseFloat(style.marginBottom) || 0;
          const computed = Math.max(0, Math.round(rect.height + marginBottom));
          setStickyTopOffset(computed + 8); // a small extra gap for breathing room
        } else {
          setStickyTopOffset(isMobile ? 56 : 80);
        }
      } catch (e) {
        setStickyTopOffset(isMobile ? 56 : 80);
      }
    };

    // Measure once and on resize
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isMobile]);

  // Measure left drawer width (if present) and update drawerOffset so header can be pushed when drawer is open
  useEffect(() => {
    const measureDrawer = () => {
      try {
        // Find all drawer papers and select the left-side one (if any).
        const els = Array.from(document.querySelectorAll('.MuiDrawer-paper'));
        if (!els || els.length === 0) {
          setDrawerOffset(0);
          return;
        }

        const leftDrawer = els.find(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          // left drawer: fairly narrow compared to viewport, aligned to left edge
          const isLeftAligned = Math.abs(rect.left) <= 2;
          const notFullWidth = rect.width < window.innerWidth * 0.9;
          const visible = rect.width > 0 && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
          return isLeftAligned && notFullWidth && visible;
        });

        if (!leftDrawer) {
          setDrawerOffset(0);
          return;
        }

        const rect = leftDrawer.getBoundingClientRect();
        setDrawerOffset(Math.round(rect.width));
      } catch (e) {
        setDrawerOffset(0);
      }
    };

    measureDrawer();
    const mo = new MutationObserver(measureDrawer);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', measureDrawer);
    return () => {
      mo.disconnect();
      window.removeEventListener('resize', measureDrawer);
    };
  }, [isMobile]);

  // Effect to calculate membership extension days when payment amount changes
  useEffect(() => {
    if (paymentData.amount && feeConfig && feeConfig.monthly_fees) {
      const amount = parseFloat(paymentData.amount);
      const monthlyFee = feeConfig.monthly_fees;
      
      if (amount > 0 && monthlyFee > 0) {
        const days = Math.floor((amount / monthlyFee) * 30);
        setMembershipExtensionDays(days);
        logger.debug('[membershipCalculation] Payment amount/extension', { amount, monthlyFee, days });
      } else {
        setMembershipExtensionDays(0);
      }
    } else {
      setMembershipExtensionDays(0);
    }
  }, [paymentData.amount, feeConfig]);

  const fetchData = async () => {
    logger.debug('[fetchData] Starting data fetch');
     setLoading(true);
     setError(null);
     try {
      logger.debug('[fetchData] Making API calls');
       const [studentsResponse, seatChartData] = await Promise.all([
         fetch(`/api/students/with-unassigned-seats`, {
           headers: {
             'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
             'Content-Type': 'application/json'
           }
         }),
         getSeatChartData()
       ]);
       
       logger.debug('[fetchData] Students response status', { status: studentsResponse.status });
       
       if (!studentsResponse.ok) {
         throw new Error(`API error! status: ${studentsResponse.status}`);
       }
       
       const studentsData = await studentsResponse.json();
       logger.debug('[fetchData] Raw students data summary', { studentsCount: (studentsData.students || []).length, unassignedSeats: (studentsData.unassignedSeats || []).length });
       logger.debug('[fetchData] Seat chart data summary', { seatChartCount: (seatChartData || []).length });
      
      // Validate and clean data
      const cleanStudents = (studentsData.students || []).filter(student => student && typeof student === 'object');
      const cleanUnassignedSeats = studentsData.unassignedSeats || [];
      
  logger.debug('✅ [fetchData] Cleaned students:', cleanStudents.length);
  logger.debug('✅ [fetchData] Cleaned unassigned seats:', cleanUnassignedSeats.length);
      
      setStudents(cleanStudents);
      setUnassignedSeats(cleanUnassignedSeats);
      setSeatData(seatChartData);
      
  logger.info('✅ [fetchData] Data fetch completed successfully');
    } catch (err) {
  logger.error('❌ [fetchData] Error occurred:', err);
  logger.error('❌ [fetchData] Error stack:', err.stack);
      handleApiError(err, 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
  logger.debug('[fetchData] Loading state set to false');
    }
   };

  // Calculate statistics
  const getStats = () => {
  logger.debug('📊 [getStats] Calculating statistics...', { studentsCount: students.length, seatDataCount: seatData.length });
    
    // Filter out null/undefined students
    const validStudents = students.filter(student => student && typeof student === 'object');
  logger.debug('Valid students after null check:', validStudents.length);
    
    // Filter only active students (membership_status !== 'inactive')
    const activeStudents = validStudents.filter(student => student.membership_status !== 'inactive');
  logger.debug('Active students after status check:', activeStudents.length);
    
    const totalStudents = activeStudents.length;
    const assignedSeats = activeStudents.filter(s => s.seat_number).length;
  const availableSeats = unassignedSeats.length;
    // Available seats gender breakdown (derive from seatData by checking if seat has no assigned student)
    const availableMaleSeats = (seatData || []).filter(s => {
      if (!s) return false;
      const hasStudent = !!(s.studentName || s.studentId || s.student || s.student_id);
      if (hasStudent) return false;
      const sex = (s.occupantSexRestriction || s.occupant_sex || '').toString().toLowerCase();
      return sex === 'male';
    }).length;
    const availableFemaleSeats = (seatData || []).filter(s => {
      if (!s) return false;
      const hasStudent = !!(s.studentName || s.studentId || s.student || s.student_id);
      if (hasStudent) return false;
      const sex = (s.occupantSexRestriction || s.occupant_sex || '').toString().toLowerCase();
      return sex === 'female';
    }).length;
    
    // Calculate expiring/expired counts from seatData so values match Seats view filtering
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    let expiringSeatsCount = 0;
    let expiredSeatsCount = 0;

    // Use seatData to count only seats (assigned) that are expiring/expired using IST adjustment
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    (seatData || []).forEach(seat => {
      if (!seat) return;
      const student = students.find(s => s && (s.id === seat.studentId || s.seat_number === seat.seatNumber || s.id === seat.studentId));
      const membershipTill = seat.membershipExpiry || student?.membership_till;
      const hasStudent = !!(seat.studentName || student?.name);

      let membershipTillIST = null;
      if (membershipTill) {
        const raw = new Date(membershipTill);
        if (!isNaN(raw.getTime())) membershipTillIST = new Date(raw.getTime() + IST_OFFSET_MS);
      }

      const isExpired = hasStudent && (membershipTillIST ? (membershipTillIST < now) : true);
      const isExpiring = hasStudent && (membershipTillIST ? (membershipTillIST > now && membershipTillIST <= sevenDaysFromNow) : false);

      if (isExpiring && !isExpired) expiringSeatsCount += 1;
      if (isExpired) expiredSeatsCount += 1;
    });

    const expiringSeats = expiringSeatsCount;
    const expiredSeats = expiredSeatsCount;
    
    const unassignedStudents = activeStudents.filter(s => !s.seat_number).length;
    const totalSeats = seatData.length;
    
    // Calculate male and female seat counts
  logger.debug('Processing seat data for gender counts...');
    const maleSeats = seatData.filter(s => s && s.occupantSexRestriction === 'male').length;
    const femaleSeats = seatData.filter(s => s && s.occupantSexRestriction === 'female').length;
    const neutralSeats = totalSeats - maleSeats - femaleSeats; // Seats with no gender restriction

  // Student gender counts (based on active students)
  const maleStudents = activeStudents.filter(s => (s.sex || s.gender || '').toString().toLowerCase() === 'male').length;
  const femaleStudents = activeStudents.filter(s => (s.sex || s.gender || '').toString().toLowerCase() === 'female').length;

  // Note: logging moved outside so we don't spam console on every render

    return {
      totalStudents,
      assignedSeats,
      availableSeats,
  expiringSeats,
      expiredSeats,
      unassignedStudents,
      totalSeats,
      maleSeats,
      femaleSeats,
      neutralSeats
  ,
  maleStudents,
  femaleStudents
  ,
  availableMaleSeats,
  availableFemaleSeats
    };
  };

  // Memoize stats so getStats runs only when its inputs change (prevents repeated logs)
  const stats = useMemo(() => getStats(), [students, seatData, unassignedSeats]);

  // Log stats once when they change
  useEffect(() => {
    try {
      logger.info('📈 [getStats] Statistics calculated', stats);
    } catch (e) {
      logger.debug('Failed to log stats', e);
    }
  }, [stats]);

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
        setCurrentTab(1); // Active Students view
        clearAllFilters();
        break;
      case 'available':
        setCurrentTab(0); // Seats view
        setSeatsFilters(prev => ({ ...prev, status: 'available' }));
        break;
      case 'expiring':
        setCurrentTab(0); // Seats view
        setSeatsFilters(prev => ({ ...prev, status: 'expiring' }));
        break;
      case 'expired':
        setCurrentTab(0); // Seats view
        setSeatsFilters(prev => ({ ...prev, status: 'expired' }));
        break;
      case 'assigned':
        setCurrentTab(1); // Active Students view
        setStudentsFilters(prev => ({ ...prev, status: 'assigned' }));
        break;
      case 'unassigned':
        setCurrentTab(1); // Active Students view
        setStudentsFilters(prev => ({ ...prev, status: 'unassigned' }));
        break;
      case 'male':
        // Set gender filter only for the active tab so filters are independent
        if (currentTab === 0) {
          setSeatsFilters(prev => ({ ...prev, gender: 'male' }));
        } else {
          setStudentsFilters(prev => ({ ...prev, gender: 'male' }));
        }
        break;
      case 'female':
        if (currentTab === 0) {
          setSeatsFilters(prev => ({ ...prev, gender: 'female' }));
        } else {
          setStudentsFilters(prev => ({ ...prev, gender: 'female' }));
        }
        break;
      default:
        break;
    }
  };

  const clearAllFilters = () => {
  // Clear both per-tab storage and the active UI values
  setSeatsFilters({ seatNumber: '', status: '', gender: '' });
  setStudentsFilters({ studentName: '', status: '', gender: '', contact: '' });
  setSeatNumberFilter('');
  setStatusFilter('');
  setStudentNameFilter('');
  setContactFilter('');
  setActiveStatFilter(null);
  };

  // Handle tab change - clear filters that may hide records when switching to Inactive tab
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    // When opening Inactive tab, clear filters which often come from Seats/Active view
    if (newValue === 2) {
  // Clear both per-tab filter objects and the legacy UI values
  setSeatsFilters({ seatNumber: '', status: '', gender: '' });
  setStudentsFilters({ studentName: '', status: '', gender: '', contact: '' });
  setSeatNumberFilter('');
  setStatusFilter('');
  setStudentNameFilter('');
  setContactFilter('');
      setActiveStatFilter(null);
      // Also clear any selected action item to avoid accidental actions
      setSelectedItemForAction(null);
    }
  };

  // Student sub-tab change handler (Active / Inactive)
  const handleStudentSubTabChange = (event, newValue) => {
    setStudentSubTab(newValue);
  };

  // Filter data based on current tab and filters
  const getFilteredData = () => {
    let data = [];
  // Ensure student arrays used in different tabs are defined
    const validStudents = students.filter(student => student && typeof student === 'object');
    const activeStudents = validStudents.filter(student => {
      const s = (student.membership_status || student.status || '').toString().toLowerCase();
      return s !== 'inactive' && s !== 'deactivated';
    });
    const deactivatedStudents = validStudents.filter(student => {
      const s = (student.membership_status || student.status || '').toString().toLowerCase();
      return s === 'inactive' || s === 'deactivated';
    });
    
    if (currentTab === 0) { // Seats View
      logger.debug('Processing seat data for display', { sampleSeatData: seatData.slice(0,3), sampleStudents: students.slice(0,3) });
      data = seatData.map(seat => {
        const student = students.find(s => s.seat_number === seat.seatNumber);
        
        // Check membership expiry and expiring window (use IST-adjusted calculation like students view)
        const membershipTill = seat.membershipExpiry || student?.membership_till;
        const hasStudent = !!(seat.studentName || student?.name);
        // Adjust to IST consistently (frontend displays IST elsewhere)
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        let membershipTillIST = null;
        if (membershipTill) {
          const raw = new Date(membershipTill);
          if (!isNaN(raw.getTime())) {
            membershipTillIST = new Date(raw.getTime() + IST_OFFSET_MS);
          }
        }
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);
        const isExpired = hasStudent && (membershipTillIST ? (membershipTillIST < now) : true);
        const isExpiring = hasStudent && (membershipTillIST ? (membershipTillIST > now && membershipTillIST <= sevenDaysFromNow) : false);
        
        const processedSeat = {
          ...seat,
          // Preserve backend data when available, fallback to student lookup
          studentName: seat.studentName || student?.name || '',
          studentId: seat.studentId || student?.id || '',
          contact: seat.contactNumber || student?.contact_number || '',
          // gender: occupant (if occupied) fallback to student.sex
          gender: seat.gender || student?.sex || '',
          // occupantSexRestriction: the seat's configured gender restriction (from DB occupant_sex)
          occupantSexRestriction: seat.occupantSexRestriction || seat.occupant_sex || null,
          membership_till: membershipTill,
          // Fix: Determine if seat is occupied based on whether there's a student assigned
          occupied: !!(seat.studentName || student?.name),
          // Add expired and expiring status
          expired: isExpired,
          expiring: isExpiring
        };
        
    // Reduced logging: only debug summary per seat rather than one log per seat
    logger.debug('Seat processed', { seatNumber: seat.seatNumber, occupied: processedSeat.occupied, studentName: processedSeat.studentName ? processedSeat.studentName.slice(0,50) : null });
        
        return processedSeat;
      });
      
  logger.debug('Processed data sample (occupied, up to 3):', data.filter(d => d.occupied).slice(0, 3).map(d => ({ seatNumber: d.seatNumber, studentName: d.studentName })));
    } else if (currentTab === 1) { // Students tab - include both active and inactive so desktop/table shows all
      logger.debug('Processing students for view (including inactive)', { sampleStudents: students.slice(0,3) });
      // Use the full validStudents list so both active and inactive records are present
      data = validStudents.map(student => {
        // Compute expiry flags using IST-adjusted view (consistent with Seats view)
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        let membershipTillIST = null;
        if (student.membership_till) {
          const raw = new Date(student.membership_till);
          if (!isNaN(raw.getTime())) {
            membershipTillIST = new Date(raw.getTime() + IST_OFFSET_MS);
          }
        }
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);

        const isExpired = membershipTillIST ? (membershipTillIST < now) : true; // no end date => expired
        const isExpiring = membershipTillIST ? (membershipTillIST > now && membershipTillIST <= sevenDaysFromNow) : false;

        // Normalize status: if backend marked inactive/deactivated, keep it; otherwise derive from seat
        const rawStatus = (student.membership_status || student.status || '').toString().toLowerCase();
        const normalizedStatus = (rawStatus === 'inactive' || rawStatus === 'deactivated') ? 'inactive' : (student.seat_number ? 'assigned' : 'unassigned');

        const processedStudent = {
          ...student,
          status: normalizedStatus,
          gender: student.sex,
          // Add consistent property for easier access
          seatNumber: student.seat_number,
          expiring: isExpiring,
          expired: isExpired
        };

        logger.debug('Processing student', { id: student.id, name: student.name, status: processedStudent.status, seat: student.seat_number || 'UNASSIGNED' });
        return processedStudent;
      });

      logger.debug('Processed students data sample (up to 3)', data.slice(0, 3).map(s => ({ id: s.id, name: s.name, status: s.status })));
      // Sort by name (dictionary order) before applying filters
      data.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    } else if (currentTab === 2) { // Deactivated Students View
      logger.debug('Processing deactivated students for view', { sampleStudents: students.slice(0,3) });
      data = deactivatedStudents.map(student => {
        const processedStudent = {
            ...student,
            // normalize to 'inactive' so other code and filters treat it consistently
            status: 'inactive',
            gender: student.sex,
            // Add consistent property for easier access
            seatNumber: student.seat_number
          };
        
  // Reduced logging: debug summary per deactivated student
  logger.debug('Processing deactivated student', { id: student.id, name: student.name });
        
        return processedStudent;
      });
      
  logger.debug('Processed deactivated students data sample (up to 3)', data.slice(0, 3).map(s => ({ id: s.id, name: s.name })));
  // Sort deactivated students by name (dictionary order) before applying filters
  data.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    }

    // Apply filters (use per-tab filter state so seats and students filters are independent)
  const seatNumberFilterLocal = currentTab === 0 ? (seatsFilters.seatNumber || '') : (studentsFilters.seatNumber || '');
  const statusFilterLocal = currentTab === 0 ? (seatsFilters.status || '') : (studentsFilters.status || '');
  const genderFilterLocal = currentTab === 0 ? (seatsFilters.gender || '') : (studentsFilters.gender || '');

    if (seatNumberFilterLocal) {
      const filterVal = seatNumberFilterLocal.toString();
      // Seats view should allow prefix matching (e.g. entering "12" matches "120")
      if (currentTab === 0) {
        data = data.filter(item => {
          const sn = (item.seatNumber !== undefined && item.seatNumber !== null)
            ? String(item.seatNumber)
            : ((item.seat_number !== undefined && item.seat_number !== null) ? String(item.seat_number) : '');
          return sn.startsWith(filterVal);
        });
      } else {
        // For students/deactivated views keep exact match semantics
        data = data.filter(item => {
          const sn = (item.seatNumber !== undefined && item.seatNumber !== null)
            ? String(item.seatNumber)
            : ((item.seat_number !== undefined && item.seat_number !== null) ? String(item.seat_number) : '');
          return sn === filterVal;
        });
      }
    }

    if (statusFilterLocal) {
      if (statusFilterLocal === 'expiring') {
        // Only items that are expiring soon and not already expired
        data = data.filter(item => item.expiring && !item.expired);
      } else if (statusFilterLocal === 'assigned') {
        data = data.filter(item => item.seatNumber);
      } else if (statusFilterLocal === 'unassigned') {
        data = data.filter(item => !item.seatNumber);
      } else if (statusFilterLocal === 'available') {
        data = data.filter(item => !item.occupied);
      } else if (statusFilterLocal === 'occupied') {
        data = data.filter(item => item.occupied);
      } else if (statusFilterLocal === 'deactivated') {
        data = data.filter(item => item.status === 'inactive');
      } else if (statusFilterLocal === 'expired') {
        data = data.filter(item => {
          // For seats view, check if seat has expired membership
          if (currentTab === 0) {
            return item.expired;
          }
          // For students view, check if membership is expired
          if (!item.membership_till) return true; // No membership end date means expired
          const expiryDate = new Date(item.membership_till);
          const today = new Date();
          return expiryDate < today;
        });
      }
    }

    if (genderFilterLocal) {
      if (currentTab === 0) {
        // For Seats view, filter by seat's occupant restriction (occupant_sex column).
        data = data.filter(item => (item.occupantSexRestriction || '') === genderFilterLocal);
      } else {
        data = data.filter(item => item.gender === genderFilterLocal);
      }
    }
    
    // Apply name filter only when in Students tab (tab index 1).
  const nameFilterLocal = currentTab === 1 ? (studentsFilters.studentName || '').toString().trim().toLowerCase() : '';
    if (nameFilterLocal) {
      const q = nameFilterLocal;
      // Students tab: prefix match against name, id or contact/mobile
      data = data.filter(item => {
        const name = (item.name || item.studentName || '').toString().toLowerCase();
        const id = (item.id || item.studentId || item.student_id || '').toString().toLowerCase();
        const contact = (item.contact || item.contactNumber || item.contact_number || '').toString().toLowerCase();
        return (
          (name && name.startsWith(q)) ||
          (id && id.startsWith(q)) ||
          (contact && contact.startsWith(q))
        );
      });
    }
    
    // Apply contact filter only for Students tab
  const contactFilterLocal = currentTab === 1 ? (studentsFilters.contact || '') : '';
    if (contactFilterLocal) {
      data = data.filter(item => 
        (item.contact || item.contactNumber || '').toString().startsWith(contactFilterLocal)
      );
    }

    return data;
  };

  const filteredData = getFilteredData();

  // Add student handler
  const handleAddStudent = async () => {
  setAddAttempted(true);
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

    if (!newStudent.membership_date || !newStudent.membership_date.trim()) {
      setSnackbarMessage('*Membership start date is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (!newStudent.contact || !newStudent.contact.trim()) {
      setSnackbarMessage('*Contact number is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Contact must be exactly 10 digits
    const newContact = (newStudent.contact || '').trim();
    if (!/^\d{10}$/.test(newContact)) {
      setSnackbarMessage('*Contact number must be exactly 10 digits');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (!newStudent.fatherName || !newStudent.fatherName.trim()) {
      setSnackbarMessage("*Father's name is required");
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (!newStudent.aadhaar_number || !newStudent.aadhaar_number.trim()) {
      setSnackbarMessage('*Aadhaar number is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (!newStudent.address || !newStudent.address.trim()) {
      setSnackbarMessage('*Address is required');
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
  seat_number: newStudent.seat_number || null,
  membership_date: newStudent.membership_date || null,
  aadhaar_number: newStudent.aadhaar_number?.trim() || null,
  address: newStudent.address?.trim() || null
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
        // Handle aadhaar conflict specially
        if (response.status === 409 && responseData && responseData.error && responseData.error.toLowerCase().includes('aadhaar')) {
          // Show dialog with existing student info
          setAadhaarConflictStudent(responseData.student || null);
          setAadhaarConflictOpen(true);
          return;
        }

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
  setNewStudent({ name: '', seat_number: '', contact: '', sex: '', fatherName: '', membership_date: new Date().toISOString().split('T')[0], aadhaar_number: '', address: '' });
  setAddAttempted(false);
      setAvailableSeats([]);
      fetchData();
    } catch (err) {
      logger.error('Error adding student', err);
      handleApiError(err, 'Failed to add student: ' + err.message);
    } finally {
      setAddStudentLoading(false);
    }
  };

  // Action menu handlers
  const handleActionClick = (event, item) => {
  logger.debug('[handleActionClick] item selected', { id: item?.id, name: item?.name, tab: currentTab });
    
    event.stopPropagation();
    // If the clicked item is a seat (from Seats view) and contains student info, normalize it
    let contextItem = item;
    try {
      const isSeat = !!(item && (item.seatNumber || item.seat_number));
      if (isSeat) {
        // Try to resolve a student object for this seat
        const studentId = item.studentId || item.studentId === 0 ? item.studentId : (item.student?.id || item.studentId || item.studentId);
        let studentObj = null;
        if (studentId) {
          studentObj = students.find(s => s && (s.id === studentId || s.id === Number(studentId)));
        }
        // If not found but seat contains studentName and studentId-like fields, create a minimal student object
        if (!studentObj && (item.studentName || item.studentId)) {
          studentObj = {
            id: item.studentId || item.studentId === 0 ? item.studentId : undefined,
            name: item.studentName || item.student_name || undefined,
            seat_number: item.seatNumber || item.seat_number || undefined
          };
        }

        // Merge seat + student info into a single action context so handlers can work
        contextItem = {
          ...item,
          // normalized student fields at top-level when available
          ...(studentObj ? { ...studentObj } : {}),
          // keep raw seat context for seat-specific handlers
          __seatContext: { seatNumber: item.seatNumber || item.seat_number }
        };
      }
    } catch (e) {
      // fallback to original item
      contextItem = item;
    }

    setActionMenuAnchor(event.currentTarget);
    setSelectedItemForAction(contextItem);
    
  logger.debug('[handleActionClick] Set selectedItemForAction', { id: item?.id });
  };

  const handleActionClose = () => {
    logger.debug('🔒 [handleActionClose] Closing action menu and clearing selectedItemForAction', { selectedItemForAction });
    setActionMenuAnchor(null);
    setSelectedItemForAction(null);
  };

  // Seat history handler
  // Seat history handler (seat-focused: shows student change history for a seat)
  const handleSeatHistory = async () => {
    logger.debug('🔍 [History] Starting seat-focused history', { selectedItemForAction });

    // Seat contextTab === 0
    setSeatHistoryContext({ 
      ...selectedItemForAction,
      contextTab: 0
    });

    setHistoryLoading(true);
    try {
      // Resolve seat number from the selected action context
      const seatNumber = selectedItemForAction?.seat_number || selectedItemForAction?.seatNumber || selectedItemForAction?.seat || selectedItemForAction?.seatNumber;
      if (!seatNumber) {
        setSnackbarMessage('No seat selected for history');
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
        return handleActionClose();
      }

      const response = await fetch(`/api/seats/${seatNumber}/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Seat history API error! status: ${response.status} - ${text}`);
      }

      const history = await response.json();
      setSeatHistory(history || []);
      setSeatHistoryOpen(true);
    } catch (err) {
      logger.error('❌ [handleSeatHistory] Error fetching seat history', err);
      handleApiError(err, 'Failed to fetch seat history');
    } finally {
      setHistoryLoading(false);
    }
    handleActionClose();
  };

  // Student seat history handler (student-focused: shows seat change history for a student)
  const handleStudentSeatHistory = async () => {
    logger.debug('🔍 [History] Starting student-focused seat history', { selectedItemForAction });

    // Student contextTab === 1
    setSeatHistoryContext({
      ...selectedItemForAction,
      contextTab: 1
    });

    setHistoryLoading(true);
    try {
      // Resolve student id from selected action context
      const studentId = selectedItemForAction?.id || selectedItemForAction?.studentId || selectedItemForAction?.student_id;
      if (!studentId) {
        setSnackbarMessage('No student selected for history');
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
        return handleActionClose();
      }

      const response = await fetch(`/api/students/${studentId}/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Student history API error! status: ${response.status} - ${text}`);
      }

      const history = await response.json();
      setSeatHistory(history || []);
      setSeatHistoryOpen(true);
    } catch (err) {
      logger.error('❌ [handleStudentSeatHistory] Error fetching student history', err);
      handleApiError(err, 'Failed to fetch student seat history');
    } finally {
      setHistoryLoading(false);
    }
    handleActionClose();
  };

  // Payment history handler (accept optional student argument or handle being invoked as a menu click event)
  const handlePaymentHistory = async (studentArg = null) => {
    // studentArg may be:
    // - a student object (contains id)
    // - a click event (when passed directly as onClick handler)
    // - null (use selectedItemForAction)
    let student = null;
  logger.debug('[handlePaymentHistory] invoked with', { studentArgType: typeof studentArg, selectedItemForActionId: selectedItemForAction?.id });

    if (studentArg && typeof studentArg === 'object') {
      // event-like objects usually have target/currentTarget
      if ('id' in studentArg && studentArg.id) {
        student = studentArg;
      } else if (studentArg.currentTarget || studentArg.target) {
        // likely an event from MenuItem onClick
        try { studentArg.stopPropagation && studentArg.stopPropagation(); } catch (e) {}
        student = selectedItemForAction;
      } else {
        // fallback: treat as student-like if it has id property truthy
        student = studentArg;
      }
    } else {
      student = selectedItemForAction;
    }

  logger.debug('[handlePaymentHistory] Resolved student', { id: student?.id, name: student?.name });

    if (!student || !student.id) {
      logger.warn('[handlePaymentHistory] No student ID available, aborting payment history fetch');
      setSnackbarMessage('No student selected for payment history');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      handleActionClose();
      return;
    }

  logger.info('[handlePaymentHistory] Fetching payment history', { id: student.id, name: student.name });

    setHistoryLoading(true);
    try {
      logger.debug('🌐 [handlePaymentHistory] Sending GET request to /api/payments/student', { studentId: student.id });
      const response = await fetch(`/api/payments/student/${student.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      logger.debug('[handlePaymentHistory] API Response status', { status: response.status });

      if (!response.ok) {
        logger.error('❌ [handlePaymentHistory] API request failed');
        throw new Error('Failed to fetch payment history');
      }

      const historyData = await response.json();
      logger.info('[handlePaymentHistory] Payment history received', { count: (historyData && historyData.length) || 0 });

      setPaymentHistory(historyData || []);
      setPaymentHistoryOpen(true);
      logger.debug('✅ [handlePaymentHistory] Payment history dialog opened');
    } catch (err) {
      logger.error('❌ [handlePaymentHistory] Error occurred during payment history fetch', err);
      logger.debug('🔍 [handlePaymentHistory] Error details', { message: err.message, studentId: student?.id, studentName: student?.name });
      handleApiError(err, 'Failed to load payment history');
    } finally {
      setHistoryLoading(false);
      logger.debug('🔄 [handlePaymentHistory] History loading state set to false');
    }
    handleActionClose();
  };

  // Edit student handler
  const handleEditStudent = () => {
    logger.debug('🖊️ [handleEditStudent] Edit student action initiated', { selectedItemForAction });
    
    if (!selectedItemForAction) {
      logger.warn('⚠️ [handleEditStudent] No selected item for action, aborting edit');
      return;
    }

    logger.debug('👤 [handleEditStudent] Editing student', { id: selectedItemForAction.id, name: selectedItemForAction.name, contact: selectedItemForAction.contact_number, sex: selectedItemForAction.sex, seat: selectedItemForAction.seat_number, membership: { from: selectedItemForAction.membership_date, to: selectedItemForAction.membership_till } });
    
    const editData = {
      id: selectedItemForAction.id,
      name: selectedItemForAction.name,
      contactNumber: selectedItemForAction.contact_number,
      sex: selectedItemForAction.sex,
      seatNumber: selectedItemForAction.seat_number || '',
  fatherName: selectedItemForAction.father_name || selectedItemForAction.fatherName || '',
      membershipDate: selectedItemForAction.membership_date ? selectedItemForAction.membership_date.split('T')[0] : '',
      membershipTill: selectedItemForAction.membership_till ? selectedItemForAction.membership_till.split('T')[0] : ''
    };

  // Include Aadhaar and Address so edit dialog can show existing values
  editData.aadhaarNumber = selectedItemForAction.aadhaar_number || selectedItemForAction.aadhaarNumber || '';
  editData.address = selectedItemForAction.address || '';
    
  logger.debug('📝 [handleEditStudent] Setting edit form data', editData);
  logger.debug('🆔 [handleEditStudent] Student ID being preserved', { id: editData.id });
  logger.debug('📅 [handleEditStudent] Membership dates being set', { membershipDate: editData.membershipDate, membershipTill: editData.membershipTill });
    setEditStudent(editData);
    
    // Fetch available seats if gender is available
    if (editData.sex) {
      fetchEditAvailableSeats(editData.sex, editData.seatNumber);
    }
    
    setEditStudentOpen(true);
  logger.debug('✅ [handleEditStudent] Edit dialog opened successfully');
    handleActionClose();
  };

  // Add payment handler
  const handleAddPayment = async () => {
    logger.debug('💰 [handleAddPayment] Add payment action initiated', { selectedItemForAction });
    
    if (!selectedItemForAction) {
      logger.warn('⚠️ [handleAddPayment] No selected item for action, aborting payment addition');
      return;
    }

    logger.debug('👤 [handleAddPayment] Adding payment for student', { id: selectedItemForAction.id, name: selectedItemForAction.name, contact: selectedItemForAction.contact_number, sex: selectedItemForAction.sex, seat: selectedItemForAction.seat_number, membership: { from: selectedItemForAction.membership_date, to: selectedItemForAction.membership_till } });
    
    // Fetch fee configuration for this student's gender
    if (selectedItemForAction.sex) {
      try {
        console.log(`💰 [handleAddPayment] Fetching fee configuration for gender: ${selectedItemForAction.sex}`);
        const response = await fetch(`/api/students/fee-config/${selectedItemForAction.sex}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const feeConfigData = await response.json();
          logger.debug('💰 [handleAddPayment] Fee configuration received', feeConfigData);
          setFeeConfig(feeConfigData);
        } else {
          logger.warn('⚠️ [handleAddPayment] Failed to fetch fee configuration');
          setFeeConfig(null);
        }
      } catch (error) {
        console.error('❌ [handleAddPayment] Error fetching fee configuration:', error);
        setFeeConfig(null);
      }
    }
    
    const initialPaymentData = {
      amount: '',
      method: 'cash',
      type: 'monthly_fee',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    };
    
  logger.debug('💳 [handleAddPayment] Setting initial payment form data', initialPaymentData);
  setPaymentData(initialPaymentData);
  setMembershipExtensionDays(0);
  setAddPaymentOpen(true);
  logger.debug('✅ [handleAddPayment] Add payment dialog opened successfully');
    // Note: handleActionClose() will be called after payment is confirmed or cancelled
  };

  // Deactivate student handler
  const handleDeactivateStudent = () => {
    logger.debug('🔴 [handleDeactivateStudent] Called', { selectedItemForAction });
    logger.debug('🔴 [handleDeactivateStudent] Student name', { name: selectedItemForAction?.name });
    
    if (!selectedItemForAction) {
      logger.error('❌ [handleDeactivateStudent] No student selected for deactivation');
      return;
    }
    logger.debug('🔴 [handleDeactivateStudent] Opening delete confirmation dialog and preparing refund info');
    // Compute refund based on remaining days between membership_till and today
    (async () => {
      try {
        setDeactivateRefundAmount(0);
        setDeactivateRefundDays(0);
        setDeactivateFeeConfig(null);

        const membershipTillRaw = selectedItemForAction?.membership_till || selectedItemForAction?.membershipTill || null;
        if (!membershipTillRaw) {
          // No end date => no refundable days
          setDeactivateRefundAmount(0);
          setDeactivateRefundDays(0);
          setDeleteConfirmOpen(true);
          return;
        }

        const today = new Date();
        const membershipTill = new Date(membershipTillRaw);
        // Only refund if membership_till is in the future
        if (isNaN(membershipTill.getTime()) || membershipTill <= today) {
          setDeactivateRefundAmount(0);
          setDeactivateRefundDays(0);
          setDeleteConfirmOpen(true);
          return;
        }

        // Calculate extra days (round up partial days)
        const diffMs = membershipTill.getTime() - today.getTime();
        const extraDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        setDeactivateRefundDays(extraDays);

        // Fetch monthly fee config for this student's gender
        if (selectedItemForAction?.sex) {
          const resp = await fetch(`/api/students/fee-config/${selectedItemForAction.sex}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
            }
          });
          if (resp.ok) {
            const cfg = await resp.json();
            setDeactivateFeeConfig(cfg);
            if (cfg && cfg.monthly_fees) {
              const dailyRate = cfg.monthly_fees / 30;
              const refundAmount = Math.round(dailyRate * extraDays);
              setDeactivateRefundAmount(refundAmount);
            } else {
              setDeactivateRefundAmount(0);
            }
          } else {
            setDeactivateFeeConfig(null);
            setDeactivateRefundAmount(0);
          }
        }

        setDeleteConfirmOpen(true);
      } catch (err) {
        logger.error('❌ [handleDeactivateStudent] Error while preparing refund info', err);
        // Open dialog anyway but with no refund info
        setDeactivateRefundAmount(0);
        setDeactivateRefundDays(0);
        setDeactivateFeeConfig(null);
        setDeleteConfirmOpen(true);
      }
    })();
    // Don't call handleActionClose() here - keep selectedItemForAction for the confirmation
  };

  // View student details handler
  const handleViewStudent = async (item) => {
    // item is optional; if provided, use it, otherwise fall back to selectedItemForAction
    const ctx = (item && item.id) ? item : selectedItemForAction;
    logger.debug('👀 [handleViewStudent] View student action initiated', { selectedContext: ctx });

    if (!ctx) {
      logger.warn('⚠️ [handleViewStudent] No selected item for action, aborting view');
      return;
    }

    logger.debug('👤 [handleViewStudent] Viewing student details', { id: ctx.id, name: ctx.name, contact: ctx.contact_number, sex: ctx.sex, seat: ctx.seat_number, membershipTill: ctx.membership_till });

    // Store student data for the view dialog
    setViewStudentData({ ...ctx });

    // Fetch total paid amount for this student
    try {
      console.log('🌐 [handleViewStudent] Fetching payment data for total calculation...', { studentId: ctx.id });
      const response = await fetch(`/api/payments/student/${ctx.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const payments = await response.json();
        logger.debug('💰 [handleViewStudent] payments received', { count: (payments && payments.length) || 0 });

        // Calculate total with proper number conversion and logging
        let totalPaid = 0;
        payments.forEach((payment, index) => {
          const rawAmount = payment.amount;
          const parsedAmount = parseFloat(rawAmount);
          const safeAmount = isNaN(parsedAmount) ? 0 : parsedAmount;

          logger.debug('💰 [handleViewStudent] Payment item', { index: index+1, raw: rawAmount, safe: safeAmount });

          totalPaid += safeAmount;
        });

        logger.info(`💰 [handleViewStudent] Final total calculated`, { totalPaid, count: payments.length });
        setViewStudentTotalPaid(totalPaid);
      } else {
        logger.warn('⚠️ [handleViewStudent] Failed to fetch payment data, setting total paid to 0');
        setViewStudentTotalPaid(0);
      }
    } catch (error) {
      logger.error('❌ [handleViewStudent] Error fetching payment data', error);
      setViewStudentTotalPaid(0);
    }

    setViewStudentOpen(true);
    logger.debug('✅ [handleViewStudent] View dialog opened successfully');
    handleActionClose(); // Close the action menu
  };

  // Edit student from view dialog
  const handleEditFromView = () => {
    logger.debug('🔄 [handleEditFromView] Edit from view action initiated', { viewStudentData });
    
    if (!viewStudentData) {
      logger.warn('⚠️ [handleEditFromView] No view student data available, aborting edit from view');
      return;
    }

    logger.debug('👤 [handleEditFromView] Transitioning to edit mode for student', { id: viewStudentData.id, name: viewStudentData.name });
    logger.debug('🔚 [handleEditFromView] Closing view dialog');
    setViewStudentOpen(false);
    
    const editData = {
      id: viewStudentData.id,
      name: viewStudentData.name,
      contactNumber: viewStudentData.contact_number,
      sex: viewStudentData.sex,
      seatNumber: viewStudentData.seat_number || '',
  fatherName: viewStudentData.father_name || viewStudentData.fatherName || '',
      membershipDate: viewStudentData.membership_date ? viewStudentData.membership_date.split('T')[0] : '',
      membershipTill: viewStudentData.membership_till ? viewStudentData.membership_till.split('T')[0] : ''
    };
  // Preserve Aadhaar and Address when transitioning from view -> edit
  editData.aadhaarNumber = viewStudentData.aadhaar_number || viewStudentData.aadhaarNumber || '';
  editData.address = viewStudentData.address || viewStudentData.address || '';
    
  logger.debug('📝 [handleEditFromView] Setting edit form data', editData);
  logger.debug('📞 [handleEditFromView] Contact being set', { contact: viewStudentData.contact_number });
  logger.debug('👫 [handleEditFromView] Gender being set', { sex: viewStudentData.sex });
  logger.debug('🪑 [handleEditFromView] Seat being set', { seat: viewStudentData.seat_number });
    
    // Set selectedItemForAction for the edit functions to work
    setSelectedItemForAction({ ...viewStudentData });
    setEditStudent(editData);
    
    // Fetch available seats if gender is available
    if (editData.sex) {
      fetchEditAvailableSeats(editData.sex, editData.seatNumber);
    }
    
    setEditStudentOpen(true);
  logger.debug('✅ [handleEditFromView] Successfully transitioned from view to edit mode');
  };

  // Confirm deactivate student
  const confirmDeactivateStudent = async () => {
    logger.debug('🔴 [confirmDeactivateStudent] Called', { selectedItemForAction, deactivateRefundAmount, deactivateRefundDays });

    if (!selectedItemForAction) {
      logger.error('❌ [confirmDeactivateStudent] No selected item for action, aborting');
      return;
    }

    setProcessingDeactivate(true);
    try {
      // If there is a refund to process, create a refund payment first
      if (deactivateRefundAmount > 0) {
        const paymentPayload = {
          student_id: selectedItemForAction.id,
          amount: -Math.abs(deactivateRefundAmount), // negative amount for refund
          payment_date: new Date().toISOString().split('T')[0],
          payment_mode: 'cash',
          payment_type: 'refund',
          remarks: `Refund on deactivation for ${selectedItemForAction.name} (${deactivateRefundDays} days)`,
          modified_by: 1,
          extend_membership: false
        };

        logger.debug('[confirmDeactivateStudent] Creating refund payment', paymentPayload);
        const payResp = await fetch('/api/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(paymentPayload)
        });

        if (!payResp.ok) {
          const errBody = await payResp.json().catch(() => ({}));
          logger.error('❌ [confirmDeactivateStudent] Refund payment failed', errBody);
          throw new Error(errBody.error || 'Failed to create refund payment');
        }
      }

      // Now update student's membership_status, clear seat assignment and set membership_till to today
      // Build a normalized payload to satisfy backend validation rules
      const todayStr = new Date().toISOString().split('T')[0];
      // Ensure membership_date is before membership_till. If not, set membership_date to yesterday.
      let membershipDateRaw = selectedItemForAction?.membership_date || selectedItemForAction?.membershipDate || null;
      let membershipDateToSend = membershipDateRaw;
      try {
        if (membershipDateRaw) {
          const md = new Date(membershipDateRaw);
          const mt = new Date(todayStr);
          if (!isNaN(md.getTime()) && md >= mt) {
            const yesterday = new Date(mt);
            yesterday.setDate(yesterday.getDate() - 1);
            membershipDateToSend = yesterday.toISOString().split('T')[0];
          } else {
            membershipDateToSend = membershipDateRaw.split('T')[0];
          }
        }
      } catch (e) {
        membershipDateToSend = null;
      }

      const updateBody = {
        name: selectedItemForAction?.name || '',
        father_name: selectedItemForAction?.father_name || selectedItemForAction?.fatherName || null,
        contact_number: selectedItemForAction?.contact_number || selectedItemForAction?.contact || null,
        sex: selectedItemForAction?.sex || selectedItemForAction?.gender || '',
        seat_number: null,
        membership_date: membershipDateToSend,
        membership_till: todayStr,
        membership_status: 'inactive'
      };

      logger.debug('[confirmDeactivateStudent] Updating student to inactive', { id: selectedItemForAction.id, updateBody });
      const response = await fetch(`/api/students/${selectedItemForAction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(updateBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ [confirmDeactivateStudent] Student update failed', { errorText });
        throw new Error('Failed to deactivate student');
      }

      setSnackbarMessage(deactivateRefundAmount > 0 ? `Student deactivated and refunded ₹${deactivateRefundAmount}` : 'Student deactivated successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setDeleteConfirmOpen(false);
      handleActionClose();
      // Refresh data
      fetchData();
    } catch (err) {
      logger.error('❌ [confirmDeactivateStudent] Error', err);
      handleApiError(err, 'Failed to deactivate student');
    } finally {
      setProcessingDeactivate(false);
    }
  };

  // Handle reactivate student
  const handleReactivateStudent = () => {
    logger.debug('🟢 [handleReactivateStudent] Called', { selectedItemForAction });
    logger.debug('🟢 [handleReactivateStudent] Student name', { name: selectedItemForAction?.name });
    
    if (!selectedItemForAction) {
      logger.error('❌ [handleReactivateStudent] No student selected for reactivation');
      return;
    }

    // Reset seat selection and fetch available seats for this student's gender
    setReactivateSelectedSeat('');
    fetchReactivateAvailableSeats(selectedItemForAction.sex);
    
  logger.debug('🟢 [handleReactivateStudent] Opening reactivate confirmation dialog');
    setReactivateConfirmOpen(true);
    // Don't call handleActionClose() here - keep selectedItemForAction for the confirmation
  };

  // Confirm reactivate student
  const confirmReactivateStudent = async () => {
    logger.debug('🟢 [confirmReactivateStudent] Called', { selectedItemForAction, selectedSeat: reactivateSelectedSeat });
    
    if (!selectedItemForAction) {
      logger.error('❌ [confirmReactivateStudent] No selected item for action, aborting');
      return;
    }

    try {
      logger.debug('🟢 [confirmReactivateStudent] Preparing to reactivate student', { id: selectedItemForAction.id, name: selectedItemForAction.name });
      
      // Update student's membership_status to 'active' and optionally assign seat
      const requestBody = {
        ...selectedItemForAction,
        membership_status: 'active'
      };
      
      // Only include seat_number if a seat was selected
      if (reactivateSelectedSeat) {
        requestBody.seat_number = reactivateSelectedSeat;
      }
      
  logger.debug('🟢 [confirmReactivateStudent] Request body', requestBody);
      
      const response = await fetch(`/api/students/${selectedItemForAction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(requestBody)
      });

  logger.debug('🟢 [confirmReactivateStudent] Response status', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [confirmReactivateStudent] Response error:', errorText);
        throw new Error('Failed to reactivate student');
      }

      const responseData = await response.json();
  logger.debug('✅ [confirmReactivateStudent] Response data', responseData);

      setSnackbarMessage('Student reactivated successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setReactivateConfirmOpen(false);
      handleActionClose(); // Close action menu after successful reactivation
      fetchData();
    } catch (err) {
      logger.error('❌ [confirmReactivateStudent] Error', err);
      handleApiError(err, 'Failed to reactivate student');
    }
  };

  // Handle assign seat to student
  const handleAssignSeatToStudent = (student) => {
    logger.debug('🟢 [handleAssignSeatToStudent] Opening assign seat dialog for student', { id: student?.id, name: student?.name });
    setStudentForSeatAssignment(student);
    setAssignSelectedSeat('');
    fetchAssignAvailableSeats(student.sex);
    setAssignSeatDialogOpen(true);
  };

  // Confirm assign seat to student
  const confirmAssignSeatToStudent = async () => {
    if (!studentForSeatAssignment || !assignSelectedSeat) {
      setSnackbarMessage('Please select a seat');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      logger.debug('🟢 [confirmAssignSeatToStudent] Assigning seat', { seat: assignSelectedSeat, studentId: studentForSeatAssignment.id });
      
      const response = await fetch(`/api/students/${studentForSeatAssignment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          ...studentForSeatAssignment,
          seat_number: assignSelectedSeat
        })
      });

  if (!response.ok) throw new Error('Failed to assign seat');

  logger.info('Seat assigned successfully', { seat: assignSelectedSeat, studentId: studentForSeatAssignment.id });
  setSnackbarMessage('Seat assigned successfully');
  setSnackbarSeverity('success');
  setSnackbarOpen(true);
  setAssignSeatDialogOpen(false);
  setStudentForSeatAssignment(null);
  setAssignSelectedSeat('');
  fetchData();
    } catch (err) {
  logger.error('❌ [confirmAssignSeatToStudent] Error', err);
  handleApiError(err, 'Failed to assign seat');
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

  logger.info('Seat assign API succeeded');
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
  const handleConfirmAddPayment = async () => { await processPayment(false); };
  const handleConfirmAddPaymentWithMembership = async () => { await processPayment(true); };

  const processPayment = async (extendMembership = false) => {
  logger.info('[processPayment] starting', { extendMembership, studentId: selectedItemForAction?.id });
    
    if (!selectedItemForAction) {
      logger.warn('⚠️ [processPayment] No selected item for action, aborting payment creation');
      return;
    }

    logger.debug('👤 [processPayment] Creating payment for student', { id: selectedItemForAction.id, name: selectedItemForAction.name });
    
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
      logger.warn('❌ [processPayment] Frontend validation failed', { validationErrors });
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
      modified_by: 1, // Will be set by auth middleware but including for completeness
      extend_membership: extendMembership
    };
    
  logger.debug('[processPayment] payment payload', { amount: paymentPayload.amount, mode: paymentPayload.payment_mode, type: paymentPayload.payment_type, extendMembership, membershipExtensionDays });
    
    try {
  setPaymentLoading(true);
  logger.debug('🌐 [processPayment] Sending POST request to /api/payments', { payloadSummary: { amount: paymentPayload.amount, extendMembership } });
      
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(paymentPayload)
      });

  logger.debug('[processPayment] API response', { status: response.status });
      
      if (!response.ok) {
        const errorData = await response.json();
        logger.error('❌ [processPayment] API request failed', errorData);
        throw new Error(errorData.error || `Failed to add payment (Status: ${response.status})`);
      }

      const responseData = await response.json();
  logger.info('[processPayment] Payment created successfully');

      const successMessage = extendMembership && membershipExtensionDays > 0 
        ? `Payment added successfully! Membership extended by ${membershipExtensionDays} days.`
        : 'Payment added successfully';
      
      setSnackbarMessage(successMessage);
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
  logger.debug('🔄 [processPayment] Resetting payment form data');
      setPaymentData(resetData);
      setFeeConfig(null);
      setMembershipExtensionDays(0);
      
      // Close action menu after successful payment
      handleActionClose();
      
  logger.debug('🔄 [processPayment] Refreshing data');
      fetchData();
    } catch (err) {
      logger.error('❌ [processPayment] Error occurred during payment creation', err);
      logger.debug('🔍 [processPayment] Error details', { message: err.message, studentId: selectedItemForAction?.id });
      handleApiError(err, 'Failed to add payment');
    } finally {
      setPaymentLoading(false);
      logger.debug('🔄 [processPayment] Payment loading state set to false');
    }
  };

  // Handle student click in seat history dialog
  const handleStudentClick = async (event, studentId, studentName) => {
    event.stopPropagation();
    event.preventDefault();
    
  logger.debug('🔍 [Seat History] Clicked on student', { id: studentId, name: studentName });
  logger.debug('🔍 [Seat History] Available students (sample)', students.slice(0,5).map(s => ({ id: s.id, name: s.name })));
    
    // Find the student by ID first (most reliable), then by name as fallback
    let student = students.find(s => s.id === studentId);
      if (!student && studentName) {
      student = students.find(s => s.name === studentName);
      logger.debug('🔍 [Seat History] Student not found by ID, tried name lookup', { found: !!student, student });
    }

    logger.debug('🔍 [Seat History] Found student', { found: !!student, studentSummary: student ? { id: student.id, name: student.name } : null });
    
    if (student) {
  logger.debug('✅ [Seat History] Opening student details for', { name: student.name });
      // Set selected item and trigger view directly
      setSelectedItemForAction(student);
      setViewStudentData({ ...student });
      
      // Calculate total paid amount inline
      try {
        const response = await fetch(`/api/payments/student/${student.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const payments = await response.json();
          const totalPaid = payments.reduce((sum, payment) => {
            const amount = parseFloat(payment.amount);
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0);
          setViewStudentTotalPaid(totalPaid);
        } else {
          setViewStudentTotalPaid(0);
        }
      } catch (error) {
        logger.error('Error fetching payment data', error);
        setViewStudentTotalPaid(0);
      }
      
  setViewStudentOpen(true);
    } else {
  // Student not found in current list, show a message
  logger.warn('⚠️ [Seat History] Student not found', { id: studentId, name: studentName });
      const identifier = studentName || `ID: ${studentId}`;
      setSnackbarMessage(`Student "${identifier}" not found in current student list. They may have been deactivated or removed.`);
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  // Confirm edit student
  const handleConfirmEditStudent = async () => {
  setEditAttempted(true);
  logger.debug('✅ [handleConfirmEditStudent] Starting student update process', { selectedItemForAction, editStudent });
    
    // Use editStudent.id if selectedItemForAction is null but editStudent has an ID
    const studentId = selectedItemForAction?.id || editStudent?.id;
    
    if (!studentId) {
      logger.warn('⚠️ [handleConfirmEditStudent] No student ID available, aborting update');
      logger.debug('🔍 [handleConfirmEditStudent] Debug info', { selectedItemForAction, editStudent, extractedId: studentId });
      return;
    }

    logger.debug('👤 [handleConfirmEditStudent] Using student ID', { studentId, source: selectedItemForAction?.id ? 'selectedItemForAction' : 'editStudent' });
    
    // Validate required fields for edit
    if (!editStudent.membershipDate || !editStudent.membershipDate.trim()) {
      setSnackbarMessage('*Membership start date is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    if (!editStudent.contactNumber || !editStudent.contactNumber.trim()) {
      setSnackbarMessage('*Contact number is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Contact must be exactly 10 digits
    const editedContact = (editStudent.contactNumber || '').trim();
    if (!/^\d{10}$/.test(editedContact)) {
      setSnackbarMessage('*Contact number must be exactly 10 digits');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    if (!editStudent.fatherName || !editStudent.fatherName.trim()) {
      setSnackbarMessage("*Father's name is required");
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Validate father's name characters. Server accepts only letters, spaces, dots, hyphens and apostrophes.
    const rawFather = (editStudent.fatherName || '').trim();
    const fatherPattern = /^[A-Za-z.\-\'\s]+$/;
    if (!fatherPattern.test(rawFather)) {
      // Try a best-effort clean: replace common separators (e.g. "/") with space, remove other invalid chars,
      // collapse multiple spaces, then re-validate.
      const cleaned = rawFather
        .replace(/[\/_()]/g, ' ')
        .replace(/[^A-Za-z.\-\'\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned && fatherPattern.test(cleaned)) {
        // Apply cleaned value and notify user (non-blocking)
        setEditStudent(prev => ({ ...prev, fatherName: cleaned }));
        setSnackbarMessage(`Father's name contained invalid characters; changed to "${cleaned}"`);
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
        // continue with cleaned value
      } else {
        setSnackbarMessage("Father's name is invalid, Please check.");
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
    }
    if (!editStudent.aadhaarNumber || !editStudent.aadhaarNumber.trim()) {
      setSnackbarMessage('*Aadhaar number is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    // Check if aadhaar is used by another student
    try {
      const cleanAadhaar = (editStudent.aadhaarNumber || '').replace(/\D/g, '');
      if (cleanAadhaar) {
        const lookupResp = await fetch(`/api/students/by-aadhaar/${cleanAadhaar}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
        if (lookupResp.ok) {
          const found = await lookupResp.json();
          // If found and id differs, abort
          if (found && found.id && Number(found.id) !== Number(studentId)) {
            setSnackbarMessage('Aadhaar number already exists for another student. Please use a unique Aadhaar.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
          }
        }
      }
    } catch (err) {
      // ignore lookup errors and proceed to backend which will enforce uniqueness
      logger.warn('Aadhaar lookup failed', err);
    }
    if (!editStudent.address || !editStudent.address.trim()) {
      setSnackbarMessage('*Address is required');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    const updateData = {
      name: editStudent.name,
      contact_number: editStudent.contactNumber,
      father_name: editStudent.fatherName || null,
      sex: editStudent.sex,
      seat_number: editStudent.seatNumber || null,
      membership_date: editStudent.membershipDate || null,
      membership_till: editStudent.membershipTill || null,
      aadhaar_number: editStudent.aadhaarNumber || null,
      address: editStudent.address || null
    };
    
  logger.debug('📊 [handleConfirmEditStudent] Update payload', updateData);
  logger.debug('🪑 [handleConfirmEditStudent] Seat assignment', { seat: editStudent.seatNumber });
  logger.debug('📅 [handleConfirmEditStudent] Membership period', { from: editStudent.membershipDate, to: editStudent.membershipTill });
    
  // Show progress indicator while the update request is in-flight
  setEditStudentLoading(true);
  try {
  logger.debug('🌐 [handleConfirmEditStudent] Sending PUT request to API', { studentId });
      const response = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(updateData)
      });

  logger.debug('📡 [handleConfirmEditStudent] API Response status', { status: response.status });
      
      // Always read response body to surface server-side validation messages
      let responseData = null;
      try {
        responseData = await response.json();
      } catch (err) {
        // ignore JSON parse errors
      }

      if (!response.ok) {
        logger.warn('❌ [handleConfirmEditStudent] API request failed', { status: response.status, body: responseData });
        // Surface validation errors from backend (400)
        if (response.status === 400 && responseData && Array.isArray(responseData.details)) {
          setSnackbarMessage(responseData.details.join(', '));
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          return;
        }

        // Conflict (e.g., duplicate aadhaar)
        if (response.status === 409 && responseData && responseData.error) {
          setSnackbarMessage(responseData.error || 'Conflict while updating');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          return;
        }

        // Fallback to generic handler
        throw new Error(responseData?.error || 'Failed to update student');
      }

  logger.debug('✅ [handleConfirmEditStudent] API Response data', responseData);
      logger.info('🎉 [handleConfirmEditStudent] Student updated successfully', { studentId });

      setSnackbarMessage('Student updated successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
  setEditStudentOpen(false);
  setEditAttempted(false);
      setEditAvailableSeats([]);

      logger.debug('🔄 [handleConfirmEditStudent] Refreshing data');
      fetchData();
    } catch (err) {
  logger.error('❌ [handleConfirmEditStudent] Error occurred during student update', err);
  logger.debug('🔍 [handleConfirmEditStudent] Error details', { message: err.message, stack: err.stack, studentId: studentId, editData: editStudent });
  handleApiError(err, 'Failed to update student');
    } finally {
      setEditStudentLoading(false);
    }
  };

  // Render Dashboard Stats - Mobile Optimized
  const renderStats = () => {
    // Keep stats visually grouped but not independently sticky when the whole top section is fixed
    const outerSx = {
      mb: 3,
      backgroundColor: 'background.paper',
      pt: 1
    };

    if (isMobile) {
      // Mobile layout: Horizontal scrollable with compact cards
      return (
        <Box sx={outerSx}>
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
            {/* Total Seats (moved to first) */}
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
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <ManIcon sx={{ color: 'primary.main', fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.maleStudents}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <WomanIcon sx={{ color: 'secondary.main', fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.femaleStudents}</Typography>
                  </Box>
                </Box>
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
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Available Seats</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <ManIcon sx={{ color: 'primary.main', fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.availableMaleSeats}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <WomanIcon sx={{ color: 'secondary.main', fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.availableFemaleSeats}</Typography>
                  </Box>
                </Box>
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

            {/* Expired */}
            <Card
              sx={{
                minWidth: 100,
                cursor: 'pointer',
                bgcolor: activeStatFilter === 'expired' ? 'error.light' : 'background.paper',
                '&:hover': { bgcolor: 'error.light' },
                borderRadius: 2,
                boxShadow: 1
              }}
              onClick={() => handleStatClick('expired')}
            >
              <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <HistoryIcon sx={{ color: 'error.main', fontSize: 16, mr: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold" color="error.main">
                    {stats.expiredSeats}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Expired</Typography>
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
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Assigned Seats</Typography>
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
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Unassigned Seats</Typography>
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

    // Desktop: horizontally-scrollable compact cards to match mobile behavior but slightly larger
    return (
      <Box sx={{ ...outerSx }}>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            overflowX: 'auto',
            pb: 1,
            alignItems: 'stretch',
            '&::-webkit-scrollbar': { height: '6px' },
            '&::-webkit-scrollbar-track': { background: '#f1f1f1', borderRadius: 4 },
            '&::-webkit-scrollbar-thumb': { background: '#c1c1c1', borderRadius: 4 }
          }}
        >
          {/** Helper to render a card with slightly smaller sizing */}
          <Card sx={{ minWidth: 140, borderRadius: 2, boxShadow: 1, cursor: 'pointer', bgcolor: activeStatFilter === 'total' ? 'grey.200' : 'background.paper' }} onClick={() => handleStatClick('total')}>
            <CardContent sx={{ p: 1.25, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                <EventSeatIcon sx={{ color: 'text.secondary', fontSize: 18, mr: 0.5 }} />
                <Typography variant="h6" fontWeight="bold">{stats.totalSeats}</Typography>
              </Box>
              <Typography variant="caption" display="block">Total Seats</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <ManIcon sx={{ color: 'primary.main', fontSize: 12 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.maleSeats}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <WomanIcon sx={{ color: 'secondary.main', fontSize: 12 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.femaleSeats}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 120, borderRadius: 2, boxShadow: 1, cursor: 'pointer', bgcolor: activeStatFilter === 'totalStudents' ? 'primary.light' : 'background.paper' }} onClick={() => handleStatClick('totalStudents')}>
            <CardContent sx={{ p: 1.25, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                <PersonIcon sx={{ color: 'primary.main', fontSize: 18, mr: 0.5 }} />
                <Typography variant="h6" fontWeight="bold" color="primary">{stats.totalStudents}</Typography>
              </Box>
              <Typography variant="caption">Total Students</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <ManIcon sx={{ color: 'primary.main', fontSize: 12 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.maleStudents}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <WomanIcon sx={{ color: 'secondary.main', fontSize: 12 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.femaleStudents}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 120, borderRadius: 2, boxShadow: 1, cursor: 'pointer', bgcolor: activeStatFilter === 'available' ? 'info.light' : 'background.paper' }} onClick={() => handleStatClick('available')}>
            <CardContent sx={{ p: 1.25, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                <EventSeatIcon sx={{ color: 'info.main', fontSize: 18, mr: 0.5 }} />
                <Typography variant="h6" fontWeight="bold" color="info.main">{stats.availableSeats}</Typography>
              </Box>
              <Typography variant="caption">Available Seats</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <ManIcon sx={{ color: 'primary.main', fontSize: 12 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.availableMaleSeats}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <WomanIcon sx={{ color: 'secondary.main', fontSize: 12 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.availableFemaleSeats}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 120, borderRadius: 2, boxShadow: 1, cursor: 'pointer', bgcolor: activeStatFilter === 'expiring' ? 'warning.light' : 'background.paper' }} onClick={() => handleStatClick('expiring')}>
            <CardContent sx={{ p: 1.25, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                <AccessTimeIcon sx={{ color: 'warning.main', fontSize: 18, mr: 0.5 }} />
                <Typography variant="h6" fontWeight="bold" color="warning.main">{stats.expiringSeats}</Typography>
              </Box>
              <Typography variant="caption">Expiring</Typography>
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 120, borderRadius: 2, boxShadow: 1, cursor: 'pointer', bgcolor: activeStatFilter === 'expired' ? 'error.light' : 'background.paper' }} onClick={() => handleStatClick('expired')}>
            <CardContent sx={{ p: 1.25, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                <HistoryIcon sx={{ color: 'error.main', fontSize: 18, mr: 0.5 }} />
                <Typography variant="h6" fontWeight="bold" color="error.main">{stats.expiredSeats}</Typography>
              </Box>
              <Typography variant="caption">Expired</Typography>
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 120, borderRadius: 2, boxShadow: 1, cursor: 'pointer', bgcolor: activeStatFilter === 'assigned' ? 'success.light' : 'background.paper' }} onClick={() => handleStatClick('assigned')}>
            <CardContent sx={{ p: 1.25, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                <EventSeatIcon sx={{ color: 'success.main', fontSize: 18, mr: 0.5 }} />
                <Typography variant="h6" fontWeight="bold" color="success.main">{stats.assignedSeats}</Typography>
              </Box>
              <Typography variant="caption">Assigned Seats</Typography>
              {/* If you have assigned gender breakdown available, show small counters — fallback to nothing if undefined */}
              {(typeof stats.assignedMaleSeats !== 'undefined' || typeof stats.assignedFemaleSeats !== 'undefined') && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <ManIcon sx={{ color: 'primary.main', fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.assignedMaleSeats || 0}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <WomanIcon sx={{ color: 'secondary.main', fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{stats.assignedFemaleSeats || 0}</Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 120, borderRadius: 2, boxShadow: 1, cursor: 'pointer', bgcolor: activeStatFilter === 'unassigned' ? 'error.light' : 'background.paper' }} onClick={() => handleStatClick('unassigned')}>
            <CardContent sx={{ p: 1.25, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                <PersonIcon sx={{ color: 'error.main', fontSize: 18, mr: 0.5 }} />
                <Typography variant="h6" fontWeight="bold" color="error.main">{stats.unassignedStudents}</Typography>
              </Box>
              <Typography variant="caption">Unassigned Seats</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  // Render filters based on current tab (separate seats vs students filters)
  const renderFilters = () => {
    const activeFilters = {};

    // Build active filters from per-tab state
    if (currentTab === 0) {
      if (seatsFilters.seatNumber) activeFilters.seat = seatsFilters.seatNumber;
      if (seatsFilters.status) activeFilters.status = seatsFilters.status;
      if (seatsFilters.gender) activeFilters.gender = seatsFilters.gender;
    } else {
      if (studentsFilters.studentName) activeFilters.name = studentsFilters.studentName;
      if (studentsFilters.status) activeFilters.status = studentsFilters.status;
      if (studentsFilters.gender) activeFilters.gender = studentsFilters.gender;
      if (studentsFilters.contact) activeFilters.contact = studentsFilters.contact;
    }

    const filterCount = Object.keys(activeFilters).length;

    const handleFilterRemove = (filterKey) => {
      switch (filterKey) {
        case 'seat': setSeatsFilters(prev => ({ ...prev, seatNumber: '' })); break;
        case 'status': if (currentTab === 0) { setSeatsFilters(prev => ({ ...prev, status: '' })); } else { setStudentsFilters(prev => ({ ...prev, status: '' })); } break;
  case 'gender': if (currentTab === 0) { setSeatsFilters(prev => ({ ...prev, gender: '' })); } else { setStudentsFilters(prev => ({ ...prev, gender: '' })); } break;
        case 'name': setStudentsFilters(prev => ({ ...prev, studentName: '' })); break;
        case 'contact': setStudentsFilters(prev => ({ ...prev, contact: '' })); break;
      }
    };

    const filterContent = (
      <>
        {currentTab === 0 && (
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Seat Number"
              value={seatsFilters.seatNumber}
              onChange={(e) => { setSeatsFilters(prev => ({ ...prev, seatNumber: e.target.value })); }}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {seatsFilters.seatNumber ? (
                      <IconButton size="small" onClick={() => setSeatsFilters(prev => ({ ...prev, seatNumber: '' }))} aria-label="clear seat number">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                )
              }}
              sx={{ maxWidth: 120 }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={seatsFilters.status}
                onChange={(e) => { setSeatsFilters(prev => ({ ...prev, status: e.target.value })); }}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="occupied">Occupied</MenuItem>
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="expiring">Expiring</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={seatsFilters.gender}
                onChange={(e) => { setSeatsFilters(prev => ({ ...prev, gender: e.target.value })); }}
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
              value={studentsFilters.studentName}
              onChange={(e) => { setStudentsFilters(prev => ({ ...prev, studentName: e.target.value })); }}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {studentsFilters.studentName ? (
                      <IconButton size="small" onClick={() => setStudentsFilters(prev => ({ ...prev, studentName: '' }))} aria-label="clear student search">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                )
              }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={studentsFilters.status}
                onChange={(e) => { setStudentsFilters(prev => ({ ...prev, status: e.target.value })); }}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="assigned">Assigned</MenuItem>
                <MenuItem value="expiring">Expiring</MenuItem>
                <MenuItem value="unassigned">Unassigned</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={studentsFilters.gender}
                onChange={(e) => { setStudentsFilters(prev => ({ ...prev, gender: e.target.value })); }}
                label="Gender"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}

        {currentTab === 2 && (
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Student Name"
              value={studentsFilters.studentName}
              onChange={(e) => { setStudentsFilters(prev => ({ ...prev, studentName: e.target.value })); }}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {studentsFilters.studentName ? (
                      <IconButton size="small" onClick={() => setStudentsFilters(prev => ({ ...prev, studentName: '' }))} aria-label="clear student search">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                )
              }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={studentsFilters.status}
                onChange={(e) => { setStudentsFilters(prev => ({ ...prev, status: e.target.value })); }}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={studentsFilters.gender}
                onChange={(e) => { setStudentsFilters(prev => ({ ...prev, gender: e.target.value })); }}
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
              value={studentsFilters.contact}
              onChange={(e) => { setStudentsFilters(prev => ({ ...prev, contact: e.target.value })); }}
              fullWidth
            />
          </Stack>
        )}
      </>
    );

    // On mobile, show inline top filters instead of the floating filter button
    if (isMobile) {
      if (currentTab === 0) {
        // Seats mobile top filter (single-row compact bar)
        return (
          <Paper sx={{ p: 1, mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto' }}>
            <TextField
              size="small"
              placeholder="Seat #"
              value={seatsFilters.seatNumber}
              onChange={(e) => { setSeatsFilters(prev => ({ ...prev, seatNumber: e.target.value })); }}
              sx={{ minWidth: 80, flex: '0 0 auto' }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1 }} />,
                endAdornment: (
                  <InputAdornment position="end">
                    {seatsFilters.seatNumber ? (
                      <IconButton size="small" onClick={() => setSeatsFilters(prev => ({ ...prev, seatNumber: '' }))} aria-label="clear seat number">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                )
              }}
            />
            <FormControl size="small" sx={{ minWidth: 120, flex: '0 0 auto' }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={seatsFilters.status}
                onChange={(e) => { setSeatsFilters(prev => ({ ...prev, status: e.target.value })); }}
                label="Status"
                sx={{ pl: 0.5 }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="occupied">Occupied</MenuItem>
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="expiring">Expiring</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120, flex: '0 0 auto' }}>
              <InputLabel>Gender</InputLabel>
              <Select
                value={seatsFilters.gender}
                onChange={(e) => { setSeatsFilters(prev => ({ ...prev, gender: e.target.value })); }}
                label="Gender"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
            </FormControl>
          </Paper>
        );
      }

      // Students mobile top search
      if (currentTab === 1) {
        // Students mobile top search (single-row compact)
        return (
          <Paper sx={{ p: 1, mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto' }}>
              <TextField
                size="small"
                placeholder="Search name / ID / mobile"
                value={studentsFilters.studentName}
                onChange={(e) => { setStudentsFilters(prev => ({ ...prev, studentName: e.target.value })); }}
                sx={{ minWidth: 200, flex: '1 0 auto' }}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1 }} />,
                  endAdornment: (
                    <InputAdornment position="end">
                      {studentsFilters.studentName ? (
                        <IconButton size="small" onClick={() => setStudentsFilters(prev => ({ ...prev, studentName: '' }))} aria-label="clear student search">
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </InputAdornment>
                  )
                }}
              />
            <FormControl size="small" sx={{ minWidth: 120, flex: '0 0 auto' }}>
              <InputLabel>Gender</InputLabel>
              <Select
                value={studentsFilters.gender}
                onChange={(e) => { setStudentsFilters(prev => ({ ...prev, gender: e.target.value })); }}
                label="Gender"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
            </FormControl>
          </Paper>
        );
      }
    }

    // Desktop: keep existing MobileFilters collapse UI
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

  // Render Seats View (desktop: table; mobile: card list similar to Active students)
  const renderSeatsView = () => {
    const seats = filteredData.filter(seat => seat && seat.seatNumber);

    if (isMobile) {
      return (
        <Stack spacing={2}>
          {seats.map((seat) => {
            const statusLabel = seat.expired ? 'Expired' : (seat.expiring ? 'Expiring' : (seat.occupied ? 'Occupied' : 'Available'));
            const statusColor = seat.expired ? 'error' : (seat.expiring ? 'warning' : (seat.occupied ? 'success' : 'default'));
            return (
              <Paper key={seat.seatNumber} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 2, boxShadow: 2, '&:hover': { boxShadow: 6 } }}>
                {/* Left: unified seat chip (icon + number) to match Students view */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 64 }}>
                  <Chip
                    icon={<EventSeatIcon sx={{ fontSize: 14 }} />}
                    label={seat.seatNumber ? `#${seat.seatNumber}` : 'Unassigned'}
                    color={seat.expired ? 'error' : (seat.expiring ? 'warning' : (seat.occupied ? 'success' : 'default'))}
                    size="small"
                    sx={{ fontWeight: 700, minWidth: 64 }}
                  />
                  {/* Status as colored text (no chip) to match seat chip color */}
                  <Typography variant="caption" sx={{ mt: 0.5, fontWeight: 700, color: statusColor === 'default' ? 'text.secondary' : `${statusColor}.main` }}>
                    {statusLabel}
                  </Typography>
                </Box>

                {/* Middle: student details or empty */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {seat.studentName ? (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                           onClick={async (event) => {
                             event.stopPropagation();
                             const student = students.find(s => s.id === seat.studentId);
                             if (student) {
                               setSelectedItemForAction(student);
                               setViewStudentData({ ...student });
                               try {
                                 const resp = await fetch(`/api/payments/student/${student.id}`, {
                                   headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}`, 'Content-Type': 'application/json' }
                                 });
                                 if (resp.ok) {
                                   const payments = await resp.json();
                                   const totalPaid = (payments || []).reduce((sum, p) => { const a = parseFloat(p.amount); return sum + (isNaN(a) ? 0 : a); }, 0);
                                   setViewStudentTotalPaid(totalPaid);
                                 } else {
                                   setViewStudentTotalPaid(0);
                                 }
                               } catch (err) {
                                 logger.error('❌ [seat card click] Error fetching payments', err);
                                 setViewStudentTotalPaid(0);
                               }
                               setViewStudentOpen(true);
                             }
                           }}>
                        {seat.gender === 'female' ? (
                          <WomanIcon sx={{ color: 'secondary.main', fontSize: 18 }} />
                        ) : (
                          <ManIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                        )}
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: 700,
                            color: 'primary.main',
                            // Allow the name to wrap or shrink rather than being truncated.
                            maxWidth: 'calc(100% - 28px)',
                            fontSize: 'clamp(0.75rem, 1.6vw, 1rem)',
                            lineHeight: 1.05,
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          {seat.studentName}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {seat.membershipExpiry ? `${formatDateForDisplay(seat.membershipExpiry)} • ` : ''}ID {seat.studentId}
                      </Typography>
                    </>
                  ) : (
                    // If seat has an occupant sex restriction, show it on empty seats
                    seat.occupantSexRestriction ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {seat.occupantSexRestriction === 'female' ? (
                          <WomanIcon sx={{ color: 'secondary.main', fontSize: 16 }} />
                        ) : (
                          <ManIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {seat.occupantSexRestriction === 'female' ? 'Empty (Female only)' : 'Empty (Male only)'}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">Empty</Typography>
                    )
                  )}
                </Box>

                {/* Right: actions */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, minWidth: 0, zIndex: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {/* Show Change / Unassign only when a student is assigned to this seat */}
                    {seat.studentName ? (
                      <>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleChangeSeat(seat); }} aria-label="Change seat">
                          <SwapHorizIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openUnassignConfirm(seat); }} aria-label="Unassign seat">
                          <LinkOffIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : null}
                    {/* If seat is empty, show quick assign button before the action menu */}
                    {!seat.studentName ? (
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedItemForAction({ seatNumber: seat.seatNumber, seat_number: seat.seatNumber }); setAssignSeatData({ seatNumber: seat.seatNumber, studentId: '' }); setAssignSeatOpen(true); }} aria-label="Assign seat">
                        <PersonAddIcon fontSize="small" />
                      </IconButton>
                    ) : null}
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
                  </Box>
                </Box>
              </Paper>
            );
          })}
        </Stack>
      );
    }

    // Desktop: original table layout
    return (
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size={isMobile ? "small" : "medium"} sx={{ minWidth: isMobile ? 600 : 'auto' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ 
                minWidth: 24,
                width: 24,
                maxWidth: 32
              }}>
                <strong>Seat#</strong>
              </TableCell>
              <TableCell sx={{ 
                position: isMobile ? 'sticky' : 'static',
                left: isMobile ? 40 : 'auto',
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
            {seats.map((seat) => (
              <TableRow key={seat.seatNumber}>
                <TableCell>
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
                    {/* Status as colored text (no chip) */}
                    <Typography variant="caption" sx={{ mt: 0.5, fontWeight: 700, color: seat.expired ? 'error.main' : (seat.expiring ? 'warning.main' : (seat.occupied ? 'success.main' : 'text.secondary')) }}>
                      {seat.expired ? 'Expired' : (seat.expiring ? 'Expiring' : (seat.occupied ? 'Occupied' : 'Available'))}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ 
                  position: isMobile ? 'sticky' : 'static',
                  left: isMobile ? 40 : 'auto',
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
                            maxWidth: 'calc(100% - 32px)',
                            // Shrink font when needed and allow wrapping so the full name is visible.
                            fontSize: 'clamp(0.75rem, 1.4vw, 0.95rem)',
                            lineHeight: 1.05,
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            const student = students.find(s => s.id === seat.studentId);
                            if (student) {
                              setSelectedItemForAction(student);
                              setViewStudentData({ ...student });
                              fetch(`/api/payments/student/${student.id}`, {
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                                  'Content-Type': 'application/json'
                                }
                              }).then(response => {
                                if (response.ok) return response.json();
                                return [];
                              }).then(payments => {
                                const totalPaid = payments.reduce((sum, payment) => { const amount = parseFloat(payment.amount); return sum + (isNaN(amount) ? 0 : amount); }, 0);
                                setViewStudentTotalPaid(totalPaid);
                              }).catch(() => setViewStudentTotalPaid(0));
                              setViewStudentOpen(true);
                            }
                          }}
                        >
                          {seat.studentName}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 3 }}>
                        ID: {seat.studentId || 'N/A'}
                      </Typography>
                      {seat.expiring && seat.membershipExpiry && (
                        <Typography variant="caption" color="warning.main" sx={{ ml: 3 }}>
                          Expiring: {formatDateForDisplay(seat.membershipExpiry)}
                        </Typography>
                      )}
                      {seat.expired && (seat.membershipExpiry || seat.membership_till) && (
                        <Typography variant="caption" color="error.main" sx={{ ml: 3 }}>
                          Expired: {formatDateForDisplay(seat.membershipExpiry || seat.membership_till)}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    // Show occupant sex restriction when no student is assigned
                    seat.occupantSexRestriction ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {seat.occupantSexRestriction === 'female' ? (
                          <WomanIcon sx={{ color: 'secondary.main', fontSize: 16 }} />
                        ) : (
                          <ManIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                        )}
                        <Typography variant="body2" color="text.secondary">{seat.occupantSexRestriction === 'female' ? 'Female only' : 'Male only'}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">Empty</Typography>
                    )
                  )}
                </TableCell>
                <TableCell sx={{ 
                  position: 'sticky',
                  right: 0,
                  bgcolor: 'background.paper',
                  zIndex: isMobile ? 5 : 'auto',
                  borderLeft: '1px solid rgba(224, 224, 224, 1)'
                }}>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                    {seat.studentName ? (
                      <>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleChangeSeat(seat); }} aria-label="Change seat">
                          <SwapHorizIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openUnassignConfirm(seat); }} aria-label="Unassign seat">
                          <LinkOffIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : null}
                    {/* Quick assign button for empty seats */}
                    {!seat.studentName ? (
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedItemForAction({ seatNumber: seat.seatNumber, seat_number: seat.seatNumber }); setAssignSeatData({ seatNumber: seat.seatNumber, studentId: '' }); setAssignSeatOpen(true); }} aria-label="Assign seat">
                        <PersonAddIcon fontSize="small" />
                      </IconButton>
                    ) : null}
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
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render Students View (mobile: card list; desktop: table)
  const renderStudentsView = () => {
    const visibleStudents = (filteredData || []).filter(student => student && student.id);

    const activeStudents = visibleStudents.filter(s => (s.membership_status || s.status) !== 'inactive');
    const inactiveStudents = visibleStudents.filter(s => (s.membership_status || s.status) === 'inactive');

    // Mobile: cards with a simple sub-tab
    if (isMobile) {
      const listToShow = studentSubTab === 0 ? activeStudents : inactiveStudents;
      return (
        <Box>
          <Paper sx={{ mb: 2 }}>
            <Tabs value={studentSubTab} onChange={handleStudentSubTabChange} variant="fullWidth">
              <Tab label={`Active (${activeStudents.length})`} />
              <Tab label={`Inactive (${inactiveStudents.length})`} />
            </Tabs>
          </Paper>

          <Stack spacing={2}>
            {listToShow.map(student => {
              const seatChipColor = student.seatNumber || student.seat_number ? (student.expired ? 'error' : (student.expiring ? 'warning' : 'success')) : 'default';
              return (
                <Paper key={student.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 2, boxShadow: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                    <Avatar sx={{ bgcolor: 'grey.200', color: 'text.primary', width: 48, height: 48 }}>{student.name ? student.name.charAt(0).toUpperCase() : '?'}</Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {student.sex === 'female' ? <WomanIcon sx={{ color: 'secondary.main', fontSize: 18 }} /> : <ManIcon sx={{ color: 'primary.main', fontSize: 18 }} />}
                        <Typography variant="body1" sx={{ fontWeight: 700, cursor: 'pointer', color: 'primary.main', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={async (e) => { e.stopPropagation(); setSelectedItemForAction(student); await handleViewStudent(student); }}>
                          {student.name}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">{formatDateForDisplay(student.membership_till || student.membershipTill)} • ID {student.id}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    <Chip sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} icon={student.seatNumber || student.seat_number ? <EventSeatIcon sx={{ fontSize: 14 }} /> : undefined} label={student.seatNumber || student.seat_number || 'Unassigned'} color={seatChipColor} size="small" />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedItemForAction(student); handleActionClick(e, student); }}><MoreVertIcon /></IconButton>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      );
    }

    // Desktop: table with sub-tabs on top
    const studentsToShow = studentSubTab === 0 ? activeStudents : inactiveStudents;
    return (
      <Box>
        <Paper sx={{ mb: 2, display: { xs: 'none', md: 'block' } }}>
          <Tabs value={studentSubTab} onChange={handleStudentSubTabChange} variant="standard">
            <Tab label={`Active (${activeStudents.length})`} />
            <Tab label={`Inactive (${inactiveStudents.length})`} />
          </Tabs>
        </Paper>

        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell align="center"><strong>Seat</strong></TableCell>
                <TableCell><strong>Membership Till</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {studentsToShow.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {student.sex === 'female' ? <WomanIcon sx={{ color: 'secondary.main', fontSize: 18 }} /> : <ManIcon sx={{ color: 'primary.main', fontSize: 18 }} />}
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.primary' }}>{student.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip icon={student.seat_number ? <EventSeatIcon sx={{ fontSize: 14 }} /> : undefined} label={student.seat_number || 'Unassigned'} size="small" color={student.seat_number ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" color="text.secondary">{formatDateForDisplay(student.membership_till || student.membershipTill)}</Typography>
                      <Typography variant="caption" color="text.secondary">ID {student.id}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right', pr: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <IconButton size="small" onClick={(e) => handleActionClick(e, student)}><MoreVertIcon /></IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

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
    <Box sx={{ p: isMobile ? 1 : 3, boxSizing: 'border-box' }}>
  {/* Top sticky section: header + stats + tabs + filters */}
  <Box
    ref={headerRef}
    sx={{
      // No longer sticky — allow header, stats, tabs and filters to scroll normally
      position: 'static',
      boxSizing: 'border-box',
      backgroundColor: 'background.paper',
      pb: 1
    }}
  >
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentTab === 0 ? <EventSeatIcon sx={{ color: 'primary.main' }} /> : <PersonIcon sx={{ color: 'primary.main' }} />}
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">
            {currentTab === 0 ? 'Seats' : 'Students'}
          </Typography>
        </Box>
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
        onChange={handleTabChange}
        variant={isMobile ? "fullWidth" : "standard"}
      >
        <Tab icon={<EventSeatIcon />} label="Seats" />
        <Tab icon={<PersonIcon />} label="Students" />
      </Tabs>
    </Paper>

    {/* Filters */}
    {renderFilters()}
  </Box>

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
        {currentTab === 0 && selectedItemForAction && (selectedItemForAction.studentName || selectedItemForAction.name) ? (
          // Seat row contains a student — show full student actions + seat history
          <>
            <MenuItem key="viewStudent" onClick={handleViewStudent}>
              <ListItemIcon>
                <VisibilityIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>View Student Details</ListItemText>
            </MenuItem>
            <MenuItem key="addPayment" onClick={handleAddPayment}>
              <ListItemIcon>
                <PaymentIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Add Payment</ListItemText>
            </MenuItem>
            <MenuItem key="editStudent" onClick={handleEditStudent}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit Student</ListItemText>
            </MenuItem>
            <MenuItem key="paymentHistory" onClick={handlePaymentHistory}>
              <ListItemIcon>
                <HistoryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Payment History</ListItemText>
            </MenuItem>
            <MenuItem key="viewSeatHistory" onClick={handleSeatHistory}>
              <ListItemIcon>
                <HistoryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Seat Assignment History</ListItemText>
            </MenuItem>
            <MenuItem key="seatHistory" onClick={handleStudentSeatHistory}>
              <ListItemIcon>
                <EventSeatIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Student Seat History</ListItemText>
            </MenuItem>
            <Divider key="divider" />
            <MenuItem key="deactivate" onClick={handleDeactivateStudent} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Deactivate Student</ListItemText>
            </MenuItem>
          </>
        ) : currentTab === 0 && selectedItemForAction ? (
          // Seat row without student — only seat history
          <MenuItem key="history" onClick={handleSeatHistory}>
            <ListItemIcon>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Seat Assignment History</ListItemText>
          </MenuItem>
        ) : null}
        
        {currentTab === 1 && selectedItemForAction && (
          // If selected student is inactive, expose only Reactivate
          (selectedItemForAction.membership_status === 'inactive' || selectedItemForAction.status === 'inactive') ? (
            [
              <MenuItem key="viewStudent" onClick={handleViewStudent}>
                <ListItemIcon>
                  <VisibilityIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>View Student Details</ListItemText>
              </MenuItem>,
              <MenuItem key="paymentHistory" onClick={handlePaymentHistory}>
                <ListItemIcon>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Payment History</ListItemText>
              </MenuItem>,
              <MenuItem key="viewSeatHistory" onClick={handleSeatHistory}>
                <ListItemIcon>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Seat Assignment History</ListItemText>
              </MenuItem>,
              <MenuItem key="seatHistory" onClick={handleStudentSeatHistory}>
                <ListItemIcon>
                  <EventSeatIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Student Seat History</ListItemText>
              </MenuItem>,
              <Divider key="divider" />,
              <MenuItem key="reactivate" onClick={handleReactivateStudent} sx={{ color: 'success.main' }}>
                <ListItemIcon>
                  <CheckCircleIcon fontSize="small" color="success" />
                </ListItemIcon>
                <ListItemText>Reactivate Student</ListItemText>
              </MenuItem>
            ]
          ) : (
            [
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
              <MenuItem key="viewSeatHistory" onClick={handleSeatHistory}>
                <ListItemIcon>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Seat Assignment History</ListItemText>
              </MenuItem>,
              <MenuItem key="seatHistory" onClick={handleStudentSeatHistory}>
                <ListItemIcon>
                  <EventSeatIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Student Seat History</ListItemText>
              </MenuItem>,
              <Divider key="divider" />,
              <MenuItem key="deactivate" onClick={handleDeactivateStudent} sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Deactivate Student</ListItemText>
              </MenuItem>
            ]
          )
        )}

        {currentTab === 2 && selectedItemForAction && [ // Deactivated Students View Actions
          <MenuItem key="viewStudent" onClick={handleViewStudent}>
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Student Details</ListItemText>
          </MenuItem>,
          <MenuItem key="paymentHistory" onClick={handlePaymentHistory}>
            <ListItemIcon>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Payment History</ListItemText>
          </MenuItem>,
          <MenuItem key="seatHistory" onClick={handleStudentSeatHistory}>
            <ListItemIcon>
              <EventSeatIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Student Seat History</ListItemText>
          </MenuItem>,
          <Divider key="divider" />,
          <MenuItem key="reactivate" onClick={handleReactivateStudent} sx={{ color: 'success.main' }}>
            <ListItemIcon>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Reactivate Student</ListItemText>
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
              label="Student Name"
              value={newStudent.name}
              onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
              required
              error={addAttempted && !newStudent.name.trim()}
              helperText={addAttempted && !newStudent.name.trim() ? "Name is required" : ""}
            />
            <FormControl fullWidth required error={addAttempted && !newStudent.sex}>
              <InputLabel>Gender</InputLabel>
              <Select
                value={newStudent.sex}
                onChange={(e) => handleGenderChange(e.target.value)}
                label="Gender"
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
              {addAttempted && !newStudent.sex && (
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
              label="Membership Start Date"
              type="date"
              value={newStudent.membership_date}
              onChange={(e) => setNewStudent({ ...newStudent, membership_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
              error={addAttempted && (!newStudent.membership_date || !newStudent.membership_date.trim())}
              helperText={addAttempted && (!newStudent.membership_date || !newStudent.membership_date.trim()) ? 'Membership start date is required' : ''}
            />
            <TextField
              fullWidth
              label="Contact Number"
              value={newStudent.contact}
              onChange={(e) => setNewStudent({ ...newStudent, contact: e.target.value })}
              placeholder="10-digit mobile number"
              required
              error={addAttempted && !/^\d{10}$/.test((newStudent.contact || '').trim())}
              helperText={addAttempted ? (
                !(newStudent.contact || '').trim() ? 'Contact number is required' :
                (!/^\d{10}$/.test((newStudent.contact || '').trim()) ? 'Contact number must be exactly 10 digits' : '')
              ) : ''}
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
            />
            <TextField
              fullWidth
              label="Father's Name"
              value={newStudent.fatherName}
              onChange={(e) => setNewStudent({ ...newStudent, fatherName: e.target.value })}
              required
              error={addAttempted && (!newStudent.fatherName || !newStudent.fatherName.trim())}
              helperText={addAttempted && (!newStudent.fatherName || !newStudent.fatherName.trim()) ? "Father's name is required" : ''}
            />
            <TextField
              fullWidth
              label="Aadhaar Number"
              value={newStudent.aadhaar_number}
              onChange={(e) => setNewStudent({ ...newStudent, aadhaar_number: e.target.value })}
              required
              error={addAttempted && (!newStudent.aadhaar_number || !newStudent.aadhaar_number.trim())}
              helperText={addAttempted && (!newStudent.aadhaar_number || !newStudent.aadhaar_number.trim()) ? 'Aadhaar number is required' : ''}
            />
            <TextField
              fullWidth
              label="Address"
              value={newStudent.address}
              onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })}
              required
              error={addAttempted && (!newStudent.address || !newStudent.address.trim())}
              helperText={addAttempted && (!newStudent.address || !newStudent.address.trim()) ? 'Address is required' : ''}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddDialogOpen(false);
            setNewStudent({ name: '', seat_number: '', contact: '', sex: '', fatherName: '', membership_date: new Date().toISOString().split('T')[0], aadhaar_number: '', address: '' });
            setAvailableSeats([]);
            setAddAttempted(false);
          }}>
            Cancel
          </Button>
              <Button 
                variant="contained" 
                onClick={handleAddStudent}
                disabled={addStudentLoading}
              >
                {addStudentLoading ? 'Adding...' : 'Add Student'}
              </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Unassign Dialog */}
      <Dialog
        open={confirmUnassignOpen}
        onClose={() => setConfirmUnassignOpen(false)}
        aria-labelledby="confirm-unassign-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="confirm-unassign-title">Confirm unassign seat</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to unassign seat {unassignTargetSeat?.seat_number || unassignTargetSeat?.seatNumber || ''}?
          </Typography>
          {unassignTargetSeat && (unassignTargetSeat.student_id || unassignTargetSeat.studentId) && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              This will remove the seat assignment from student ID {unassignTargetSeat.student_id || unassignTargetSeat.studentId}.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUnassignOpen(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              setConfirmUnassignOpen(false);
              if (unassignTargetSeat) await handleUnassignSeat(unassignTargetSeat);
            }}
          >
            Unassign
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
                  return `Student Seat History - ${studentName}`;
                } else if (studentId) {
                  return `Student Seat History - Student ID: ${studentId}`;
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
                          ? (entry.student_name ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {/* Student Name - Clickable */}
                                <Typography 
                                  variant="body2" 
                                  component="span"
                                  sx={{ 
                                    fontWeight: 'medium',
                                    cursor: 'pointer',
                                    color: 'primary.main',
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                      textDecoration: 'underline',
                                      backgroundColor: 'primary.light',
                                      color: 'primary.contrastText'
                                    }
                                  }}
                                  onClick={async (event) => {
                                    await handleStudentClick(event, entry.student_id, entry.student_name);
                                  }}
                                >
                                  {entry.student_name}
                                </Typography>
                                
                                {/* Student ID - Clickable */}
                                {entry.student_id && (
                                  <Typography 
                                    variant="caption" 
                                    component="span"
                                    sx={{ 
                                      color: 'text.secondary',
                                      cursor: 'pointer',
                                      display: 'inline-block',
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      fontSize: '0.7rem',
                                      transition: 'all 0.2s ease',
                                      '&:hover': {
                                        textDecoration: 'underline',
                                        backgroundColor: 'grey.200',
                                        color: 'primary.main'
                                      }
                                    }}
                                    onClick={async (event) => {
                                      await handleStudentClick(event, entry.student_id, entry.student_name);
                                    }}
                                  >
                                    ID: {entry.student_id}
                                  </Typography>
                                )}
                              </Box>
                            ) : 'N/A')
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
              {/* Use the same Autocomplete rendering as Payments Add Payment dialog for exact match */}
              <Autocomplete
                options={students.filter(s => {
                  if (!s || !s.id) return false;
                  // Exclude inactive/deactivated students
                  const status = ((s.membership_status || s.status || '') + '').toString().toLowerCase();
                  if (status === 'inactive' || status === 'deactivated') return false;
                  // Only unassigned students
                  if (s.seat_number && s.seat_number !== 0) return false;
                  // Determine seat restriction
                  const seatNum = selectedItemForAction?.seatNumber ?? selectedItemForAction?.seat_number;
                  const seatObj = (seatData || []).find(sd => sd && (sd.seatNumber == seatNum || sd.seat_number == seatNum));
                  const restriction = ((seatObj?.occupantSexRestriction || seatObj?.occupant_sex || '') + '').toString().toLowerCase();
                  if (!restriction) return true; // no restriction -> eligible
                  const sex = ((s.sex || s.gender || '') + '').toString().toLowerCase();
                  return sex === restriction;
                })}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const seatPart = option.seat_number ? ` • 🪑${option.seat_number}` : '';
                  return `${option.name || ''}${seatPart} (${option.id || ''})`;
                }}
                value={students.find(s => s.id === assignSeatData.studentId) || null}
                onChange={(e, value) => setAssignSeatData(prev => ({ ...prev, studentId: value ? value.id : '' }))}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{option.name}</Typography>
                        {option.seat_number && (
                          <Typography variant="caption" color="text.secondary">🪑{option.seat_number}</Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">#{option.id}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {option.contact_number || 'No contact'} · {option.father_name || 'No father name'}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Select Student" placeholder="Search by name, ID or seat" />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                clearOnEscape
                fullWidth
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                {(() => {
                  const validStudents = students.filter(student => student && typeof student === 'object');
                  const seatNum = selectedItemForAction?.seatNumber ?? selectedItemForAction?.seat_number;
                  const seatObj = (seatData || []).find(sd => sd && (sd.seatNumber == seatNum || sd.seat_number == seatNum));
                  const restriction = ((seatObj?.occupantSexRestriction || seatObj?.occupant_sex || '') + '').toString().toLowerCase();
                  const eligible = validStudents.filter(student => {
                    // Exclude inactive/deactivated students
                    const status = ((student.membership_status || student.status || '') + '').toString().toLowerCase();
                    if (status === 'inactive' || status === 'deactivated') return false;
                    if (student.seat_number && student.seat_number !== 0) return false;
                    if (!restriction) return true;
                    const sex = ((student.sex || student.gender || '') + '').toString().toLowerCase();
                    return sex === restriction;
                  }).length;
                  return `${eligible} eligible students available`;
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
      }} maxWidth="sm" fullWidth scroll="paper" fullScreen={isMobile}>
        <DialogTitle>Add/Refund Payment - {selectedItemForAction?.name}</DialogTitle>
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
            <TextField
              fullWidth
              label="Notes (Optional)"
              multiline
              rows={2}
              value={paymentData.notes}
              onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
            />
            
            {/* Membership Extension Information (only for monthly_fee) */}
            {feeConfig && membershipExtensionDays > 0 && paymentData.type === 'monthly_fee' && (
              <Box sx={{ 
                p: 2, 
                bgcolor: 'info.light', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'info.main'
              }}>
                <Typography variant="body2" color="info.contrastText" sx={{ fontWeight: 'medium' }}>
                  📅 Membership Extension Available
                </Typography>
                <Typography variant="body2" color="info.contrastText">
                  Monthly Fee: ₹{feeConfig.monthly_fees} ({selectedItemForAction?.sex})
                </Typography>
                <Typography variant="body2" color="info.contrastText">
                  Extension Days: {membershipExtensionDays} days
                </Typography>
              </Box>
            )}

            {/* Membership Refund Information (only for refund) */}
            {feeConfig && membershipExtensionDays > 0 && paymentData.type === 'refund' && (
              <Box sx={{ 
                p: 2, 
                bgcolor: 'error.light', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'error.main'
              }}>
                <Typography variant="body2" color="error.contrastText" sx={{ fontWeight: 'medium' }}>
                  ⚠️ Membership Refund Information
                </Typography>
                <Typography variant="body2" color="error.contrastText">
                  Monthly Fee: ₹{feeConfig.monthly_fees} ({selectedItemForAction?.sex})
                </Typography>
                <Typography variant="body2" color="error.contrastText">
                  Reduction Days: {membershipExtensionDays} days
                </Typography>
                <Typography variant="body2" color="error.contrastText" sx={{ mt: 1 }}>
                  This refund will reduce the student's membership by {membershipExtensionDays} days if applied.
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddPaymentOpen(false);
            handleActionClose();
          }}>Cancel</Button>
          {user && user.role === 'admin' && (<Button 
            variant="contained" 
            onClick={handleConfirmAddPayment}
            disabled={!paymentData.amount || !paymentData.method || paymentLoading}
          >
            {paymentData.type === 'refund' ? 'Refund Payment' : (paymentLoading ? 'Adding...' : 'Add Payment')}
          </Button>)}

          {/* Extend / Reduce button - label depends on payment type */}
          {feeConfig && membershipExtensionDays > 0 && (
            <Button 
              variant="contained" 
              onClick={handleConfirmAddPaymentWithMembership}
              disabled={!paymentData.amount || !paymentData.method || paymentLoading}
              startIcon={<CalendarTodayIcon />}
            >
              {paymentData.type === 'refund'
                ? `Refund Payment & Reduce ${membershipExtensionDays} Days`
                : `Add Payment & Extend ${membershipExtensionDays} Days`}
            </Button>
          )}
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
                required
                error={editAttempted && !/^\d{10}$/.test((editStudent.contactNumber || '').trim())}
                helperText={editAttempted ? (
                  !(editStudent.contactNumber || '').trim() ? 'Contact number is required' :
                  (!/^\d{10}$/.test((editStudent.contactNumber || '').trim()) ? 'Contact number must be exactly 10 digits' : '')
                ) : ''}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
            />
            <TextField
              fullWidth
              label="Father's Name"
                value={editStudent.fatherName}
                onChange={(e) => setEditStudent({ ...editStudent, fatherName: e.target.value })}
                required
                error={editAttempted && (!editStudent.fatherName || !editStudent.fatherName.trim())}
                helperText={editAttempted && (!editStudent.fatherName || !editStudent.fatherName.trim()) ? "Father's name is required" : ''}
            />
            <TextField
              fullWidth
              label="Aadhaar Number"
                value={editStudent.aadhaarNumber}
                onChange={(e) => setEditStudent({ ...editStudent, aadhaarNumber: e.target.value })}
                required
                error={editAttempted && (!editStudent.aadhaarNumber || !editStudent.aadhaarNumber.trim())}
                helperText={editAttempted && (!editStudent.aadhaarNumber || !editStudent.aadhaarNumber.trim()) ? 'Aadhaar number is required' : ''}
            />
            <TextField
              fullWidth
              label="Address"
              value={editStudent.address}
                onChange={(e) => setEditStudent({ ...editStudent, address: e.target.value })}
                required
                error={editAttempted && (!editStudent.address || !editStudent.address.trim())}
                helperText={editAttempted && (!editStudent.address || !editStudent.address.trim()) ? 'Address is required' : ''}
                multiline
                rows={2}
            />
            <FormControl fullWidth required error={editAttempted && !editStudent.sex}>
              <InputLabel>Gender</InputLabel>
              <Select
                value={editStudent.sex}
                onChange={(e) => handleEditGenderChange(e.target.value)}
                label="Gender"
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
              {editAttempted && !editStudent.sex && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  Gender is required
                </Typography>
              )}
            </FormControl>
            <TextField
              fullWidth
              label="Membership Start Date"
              type="date"
              value={editStudent.membershipDate}
              onChange={(e) => setEditStudent({ ...editStudent, membershipDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
              error={editAttempted && (!editStudent.membershipDate || !editStudent.membershipDate.trim())}
              helperText={editAttempted && (!editStudent.membershipDate || !editStudent.membershipDate.trim()) ? 'Membership start date is required' : ''}
            />
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
            {user && user.role === 'admin' && (
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
            )}
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
            disabled={editStudentLoading}
            startIcon={editStudentLoading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {editStudentLoading ? 'Updating...' : 'Update Student'}
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
                  <Typography variant="subtitle2" color="text.secondary">Aadhaar Number</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{viewStudentData.aadhaar_number || viewStudentData.aadhaarNumber || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Father's Name</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{viewStudentData.father_name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{viewStudentData.address || 'N/A'}</Typography>
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
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        color: 'success.main',
                        cursor: viewStudentData?.id ? 'pointer' : 'default',
                        textDecoration: viewStudentData?.id ? 'underline' : 'none'
                      }}
                      onClick={() => {
                        if (!viewStudentData?.id) return;
                        // Set selectedItemForAction for consistency
                        setSelectedItemForAction({ ...viewStudentData });
                        // Pass the student directly to avoid relying on state being updated
                        handlePaymentHistory(viewStudentData);
                        // Keep the view dialog open; payment history opens on top
                      }}
                    >
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
          {viewStudentData?.membership_status !== 'inactive' && (
            <Button 
              variant="contained" 
              onClick={handleEditFromView}
              startIcon={<EditIcon />}
            >
              Edit Student
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => {
        setDeleteConfirmOpen(false);
        handleActionClose(); // Close action menu when dialog is cancelled
      }}>
        <DialogTitle>Confirm Deactivation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate student "{selectedItemForAction?.name || 'Unknown'}"? 
            This will remove their seat assignment and move them to the deactivated students list.
            Their data will be preserved and they can be reactivated later.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Student ID: {selectedItemForAction?.id || 'N/A'}, Name: {selectedItemForAction?.name || 'N/A'}
          </Typography>

          {/* Refund Information (calculated) */}
          {deactivateRefundDays > 0 && (
            <Box sx={{ mt: 2, p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2">Refund Summary</Typography>
              <Typography variant="body2" color="text.secondary">Remaining Membership Days: {deactivateRefundDays} day(s)</Typography>
              <Typography variant="body2" color="text.secondary">Monthly Fee: ₹{deactivateFeeConfig?.monthly_fees ?? 'N/A'}</Typography>
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>Estimated Refund: ₹{deactivateRefundAmount}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Proceeding will create a refund entry and set membership end date to today.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteConfirmOpen(false);
            handleActionClose(); // Close action menu when cancelled
          }} disabled={processingDeactivate}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={confirmDeactivateStudent}
            disabled={processingDeactivate}
          >
            {processingDeactivate ? 'Processing...' : (deactivateRefundAmount > 0 ? `Deactivate & Refund ₹${deactivateRefundAmount}` : 'Deactivate Student')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reactivate Confirmation Dialog */}
      <Dialog open={reactivateConfirmOpen} onClose={() => {
        setReactivateConfirmOpen(false);
        handleActionClose(); // Close action menu when dialog is cancelled
      }}>
        <DialogTitle>Confirm Reactivation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to reactivate student "{selectedItemForAction?.name || 'Unknown'}"? 
            This will move them back to the active students list.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Student ID: {selectedItemForAction?.id || 'N/A'}, Name: {selectedItemForAction?.name || 'N/A'}
          </Typography>
          
          <FormControl fullWidth sx={{ mt: 3 }}>
            <InputLabel>Select Seat (Optional)</InputLabel>
            <Select
              value={reactivateSelectedSeat}
              onChange={(e) => setReactivateSelectedSeat(e.target.value)}
              label="Select Seat (Optional)"
            >
              <MenuItem value="">
                <em>No seat assignment</em>
              </MenuItem>
              {reactivateAvailableSeats.map((seat) => (
                <MenuItem key={seat.seat_number} value={seat.seat_number}>
                  Seat {seat.seat_number}
                </MenuItem>
              ))}
            </Select>
            {reactivateAvailableSeats.length === 0 && (
              <Typography variant="caption" color="warning.main" sx={{ mt: 1 }}>
                No available seats for {selectedItemForAction?.gender || 'this'} gender
              </Typography>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setReactivateConfirmOpen(false);
            handleActionClose(); // Close action menu when cancelled
          }}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success"
            onClick={confirmReactivateStudent}
          >
            Reactivate Student
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Seat Dialog */}
      <Dialog open={assignSeatDialogOpen} onClose={() => {
        setAssignSeatDialogOpen(false);
        setStudentForSeatAssignment(null);
        setAssignSelectedSeat('');
      }}>
        <DialogTitle>Assign Seat</DialogTitle>
        <DialogContent>
          <Typography>
            Assign a seat to student "{studentForSeatAssignment?.name || 'Unknown'}"
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Student ID: {studentForSeatAssignment?.id || 'N/A'}, Gender: {studentForSeatAssignment?.sex || 'N/A'}
          </Typography>
          
          <FormControl fullWidth sx={{ mt: 3 }} required>
            <InputLabel>Select Seat</InputLabel>
            <Select
              value={assignSelectedSeat}
              onChange={(e) => setAssignSelectedSeat(e.target.value)}
              label="Select Seat"
            >
              {assignAvailableSeats.map((seat) => (
                <MenuItem key={seat.seat_number} value={seat.seat_number}>
                  Seat {seat.seat_number}
                </MenuItem>
              ))}
            </Select>
            {assignAvailableSeats.length === 0 && (
              <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                No available seats for {studentForSeatAssignment?.sex || 'this'} gender
              </Typography>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAssignSeatDialogOpen(false);
            setStudentForSeatAssignment(null);
            setAssignSelectedSeat('');
          }}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={confirmAssignSeatToStudent}
            disabled={!assignSelectedSeat}
          >
            Assign Seat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      {/* Aadhaar conflict dialog - shown when backend reports existing Aadhaar on create */}
      <Dialog open={aadhaarConflictOpen} onClose={() => { setAadhaarConflictOpen(false); setAadhaarConflictStudent(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Existing Aadhaar Found</DialogTitle>
        <DialogContent>
          {!aadhaarConflictStudent ? (
            <Typography>No matching student found.</Typography>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Aadhaar already registered</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{aadhaarConflictStudent.name || 'Unknown'}</Typography>
              <Typography variant="caption" color="text.secondary">Status: {aadhaarConflictStudent.membership_status || 'N/A'}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>ID: {aadhaarConflictStudent.id}</Typography>
              <Typography variant="body2">Contact: {aadhaarConflictStudent.contact_number || 'N/A'}</Typography>
            </Box>
          )}
          <Typography sx={{ mt: 2 }}>Do you want to edit this student {aadhaarConflictStudent && aadhaarConflictStudent.membership_status === 'inactive' ? 'and mark them active' : ''}?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAadhaarConflictOpen(false); setAadhaarConflictStudent(null); }}>No</Button>
          <Button variant="contained" onClick={async () => {
            // If student inactive, call activate endpoint first
            try {
              if (!aadhaarConflictStudent) return;
              const studentId = aadhaarConflictStudent.id;
              if (aadhaarConflictStudent.membership_status === 'inactive') {
                const activateResp = await fetch(`/api/students/${studentId}/activate`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
                if (!activateResp.ok) {
                  setSnackbarMessage('Failed to activate existing student');
                  setSnackbarSeverity('error');
                  setSnackbarOpen(true);
                  setAadhaarConflictOpen(false);
                  return;
                }
                // replace conflict student with activated details
                const actData = await activateResp.json();
                setAadhaarConflictStudent(actData);
              }

              // Populate edit form and open edit dialog
              const editData = {
                id: aadhaarConflictStudent.id,
                name: aadhaarConflictStudent.name || '',
                contactNumber: aadhaarConflictStudent.contact_number || '',
                sex: aadhaarConflictStudent.sex || '',
                seatNumber: aadhaarConflictStudent.seat_number || '',
                fatherName: aadhaarConflictStudent.father_name || '',
                membershipDate: aadhaarConflictStudent.membership_date ? aadhaarConflictStudent.membership_date.split('T')[0] : '',
                membershipTill: aadhaarConflictStudent.membership_till ? aadhaarConflictStudent.membership_till.split('T')[0] : '',
                aadhaarNumber: aadhaarConflictStudent.aadhaar_number || aadhaarConflictStudent.aadhaarNumber || '',
                address: aadhaarConflictStudent.address || ''
              };
              setSelectedItemForAction({ ...aadhaarConflictStudent });
              setEditStudent(editData);
              // Close add dialog (user intended to edit existing student)
              setAddDialogOpen(false);
              setAadhaarConflictOpen(false);
              setEditStudentOpen(true);
            } catch (err) {
              setSnackbarMessage('Unexpected error');
              setSnackbarSeverity('error');
              setSnackbarOpen(true);
              setAadhaarConflictOpen(false);
            }
          }}>Yes</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
      
      <Footer />
    </Box>
  );
}

export default Students;
