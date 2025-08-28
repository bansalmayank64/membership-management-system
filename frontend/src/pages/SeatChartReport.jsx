import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tooltip,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Badge,
  Stack,
  Divider,
  Avatar,
  Grid,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Alert
} from '@mui/material';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import PersonIcon from '@mui/icons-material/Person';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PhoneIcon from '@mui/icons-material/Phone';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import BuildIcon from '@mui/icons-material/Build';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import { getSeatChartData } from '../services/api';

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

function SeatChartReport() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [seatData, setSeatData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminMenuAnchor, setAdminMenuAnchor] = useState(null);
  const [selectedSeatForAdmin, setSelectedSeatForAdmin] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // Global error handler for API calls
  const handleApiError = (error, fallbackMessage = 'An error occurred') => {
    if (error?.response?.data?.error === 'TOKEN_EXPIRED') {
      // Let the global interceptor handle token expiration
      return;
    }
    setError(error?.response?.data?.message || error?.message || fallbackMessage);
    setNotification({ 
      open: true, 
      message: error?.response?.data?.message || error?.message || fallbackMessage, 
      severity: 'error' 
    });
  };

  useEffect(() => {
    fetchSeatChart();
  }, []);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchSeatChart();
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchSeatChart = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSeatChartData();
      setSeatData(data);
    } catch (err) {
      handleApiError(err, 'Failed to load seat chart data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const getStatistics = () => {
    const total = seatData.length;
    const occupied = seatData.filter(seat => seat.occupied && !seat.removed).length;
    const available = seatData.filter(seat => seat.available && !seat.removed).length;
    
    // Calculate expiring count based on membership expiry within 7 days
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    
    const expiring = seatData.filter(seat => {
      if (!seat.occupied || seat.removed || !seat.membershipExpiry) {
        return false;
      }
      
      const expiryDate = new Date(seat.membershipExpiry);
      return expiryDate >= today && expiryDate <= sevenDaysFromNow;
    }).length;
    
    const removed = seatData.filter(seat => seat.removed).length;
    const occupancyRate = total > 0 ? ((occupied / (total - removed)) * 100).toFixed(1) : 0;

    return { total, occupied, available, expiring, removed, occupancyRate };
  };

  // Filter seats based on search term
  const getFilteredSeats = () => {
    if (!searchTerm) return seatData;
    
    return seatData.filter(seat => 
      seat.seatNumber.toString().includes(searchTerm.toLowerCase()) ||
      (seat.studentName && seat.studentName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const handleSeatClick = (seat) => {
    if (seat.occupied) {
      setSelectedSeat(seat);
    }
  };

  const handleCloseDialog = () => {
    setSelectedSeat(null);
  };

  const getSeatBackground = (seat) => {
    if (seat.removed) {
      return seatColors.removed.gradient;
    }
    if (seat.occupied) {
      if (seat.expiring) {
        return seat.gender === 'female' 
          ? seatColors.expiring.female.gradient 
          : seatColors.expiring.male.gradient;
      }
      return seat.gender === 'female' 
        ? seatColors.occupied.female.gradient 
        : seatColors.occupied.male.gradient;
    }
    return seatColors.vacant.gradient;
  };

  const getSeatIcon = (seat) => {
    if (seat.occupied) {
      return seat.gender === 'female' ? (
        <FemaleIcon sx={{ 
          color: 'white', 
          fontSize: 32,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))'
        }} />
      ) : (
        <MaleIcon sx={{ 
          color: 'white', 
          fontSize: 32,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))'
        }} />
      );
    }
    return (
      <EventSeatIcon sx={{ 
        color: seat.removed ? '#757575' : '#9e9e9e', 
        fontSize: 32,
        opacity: seat.removed ? 0.5 : 0.7
      }} />
    );
  };

  const handleSeatAdminClick = (seat, event) => {
    if (adminMode) {
      event.stopPropagation();
      setSelectedSeatForAdmin(seat);
      setAdminMenuAnchor(event.currentTarget);
    }
  };

  const handleAdminMenuClose = () => {
    setAdminMenuAnchor(null);
    setSelectedSeatForAdmin(null);
  };

  const handleSeatAction = async (action) => {
    if (!selectedSeatForAdmin) return;

    try {
      // Create a new array with updated seat data
      const updatedSeats = seatData.map(seat => {
        if (seat.seatNumber === selectedSeatForAdmin.seatNumber) {
          switch (action) {
            case 'remove':
              return {
                ...seat,
                removed: true,
                occupied: false,
                studentName: null,
                gender: null,
                expiring: false
              };
            case 'restore':
              return {
                ...seat,
                removed: false
              };
            case 'maintenance':
              return {
                ...seat,
                removed: true,
                occupied: false,
                studentName: null,
                gender: null,
                expiring: false
              };
            default:
              return seat;
          }
        }
        return seat;
      });

      setSeatData(updatedSeats);
      
      const messages = {
        remove: `Seat #${selectedSeatForAdmin.seatNumber} has been removed`,
        restore: `Seat #${selectedSeatForAdmin.seatNumber} has been restored`,
        maintenance: `Seat #${selectedSeatForAdmin.seatNumber} is now under maintenance`
      };

      setNotification({
        open: true,
        message: messages[action],
        severity: 'success'
      });

    } catch (error) {
      handleApiError(error, 'Failed to update seat status');
    }

    handleAdminMenuClose();
  };

  const addNewSeat = () => {
    // Generate next seat number - try to find the highest numeric seat first
    const numericSeats = seatData
      .map(s => s.seatNumber)
      .filter(num => /^\d+$/.test(num.toString()))
      .map(num => parseInt(num));
    
    let newSeatNumber;
    if (numericSeats.length > 0) {
      newSeatNumber = Math.max(...numericSeats) + 1;
    } else {
      // If no numeric seats exist, start from 1
      newSeatNumber = 1;
    }
    
    const newSeat = {
      seatNumber: newSeatNumber,
      occupied: false,
      studentName: null,
      gender: null,
      expiring: false,
      removed: false,
      studentId: null,
      membershipExpiry: null,
      contactNumber: null,
      lastPayment: null
    };

    setSeatData([...seatData, newSeat]);
    setNotification({
      open: true,
      message: `New seat #${newSeatNumber} has been added`,
      severity: 'success'
    });
  };

  const handleNotificationClose = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const statistics = getStatistics();

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">
          💺 Seat Chart
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            onClick={fetchSeatChart} 
            color="primary"
            size={isMobile ? "small" : "medium"}
            sx={{ 
              bgcolor: theme.palette.primary.main + '10',
              '&:hover': { bgcolor: theme.palette.primary.main + '20' }
            }}
          >
            <RefreshIcon />
          </IconButton>
          <Button
            variant={adminMode ? "contained" : "outlined"}
            onClick={() => setAdminMode(!adminMode)}
            size="small"
            startIcon={<AdminPanelSettingsIcon />}
            color={adminMode ? "secondary" : "primary"}
            sx={{ minWidth: 'auto', px: isMobile ? 1 : 2 }}
          >
            {isMobile ? 'Admin' : `Admin ${adminMode ? 'ON' : 'OFF'}`}
          </Button>
        </Box>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">{statistics.occupied}</Typography>
              <Typography variant="body2">Occupied</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'grey.100' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">{statistics.available}</Typography>
              <Typography variant="body2">Available</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'warning.main', color: 'white' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">{statistics.expiring}</Typography>
              <Typography variant="body2">Expiring</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'success.main', color: 'white' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">{statistics.occupancyRate}%</Typography>
              <Typography variant="body2">Full</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
      {statistics.expiring > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'warning.light', borderLeft: '4px solid', borderColor: 'warning.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon color="warning" />
            <Typography variant="subtitle1" fontWeight="bold">
              ⚠️ {statistics.expiring} membership{statistics.expiring > 1 ? 's' : ''} expiring soon
            </Typography>
          </Box>
        </Paper>
      )}

      {adminMode && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light', borderLeft: '4px solid', borderColor: 'info.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettingsIcon color="info" />
            <Typography variant="subtitle1" fontWeight="bold">
              🔧 Admin Mode: Click seats to manage
            </Typography>
          </Box>
        </Paper>
      )}

      <Paper sx={{ p: isMobile ? 2 : 3 }}>
        {/* Search */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search seat or student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ mb: 2 }}
          />
          
          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip 
              icon={<MaleIcon />} 
              label="Male" 
              size="small"
              sx={{ 
                background: seatColors.occupied.male.gradient,
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }} 
            />
            <Chip 
              icon={<FemaleIcon />} 
              label="Female" 
              size="small"
              sx={{ 
                background: seatColors.occupied.female.gradient,
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }} 
            />
            <Chip 
              icon={<EventSeatIcon />} 
              label="Empty" 
              size="small"
              sx={{ 
                background: seatColors.vacant.gradient,
                '& .MuiChip-icon': { color: 'text.secondary' }
              }} 
            />
            <Chip 
              icon={<AccessTimeIcon />} 
              label="Expiring" 
              size="small"
              sx={{ 
                background: seatColors.expiring.male.gradient,
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }} 
            />
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress size={60} />
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error" variant="h6">{error}</Typography>
            <Button onClick={fetchSeatChart} sx={{ mt: 2 }}>Try Again</Button>
          </Box>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '80px' : '100px'}, 1fr))`, 
            gap: isMobile ? 1 : 2,
            p: 1
          }}>
            {getFilteredSeats().map(seat => {
              const isHighlighted = searchTerm && (
                seat.seatNumber.toString().includes(searchTerm.toLowerCase()) ||
                (seat.studentName && seat.studentName.toLowerCase().includes(searchTerm.toLowerCase()))
              );

              return (
                <Tooltip 
                  key={`seat-${seat.seatNumber}`}
                  title={
                    <Box>
                      <Typography variant="subtitle2">
                        Seat {seat.seatNumber}
                      </Typography>
                      {seat.occupied && (
                        <Typography variant="body2">
                          Student: {seat.studentName} ({seat.gender === 'male' ? '♂' : '♀'})
                        </Typography>
                      )}
                      {seat.expiring && (
                        <Typography variant="body2" color="warning.main">
                          ⚠️ Expiring Soon
                        </Typography>
                      )}
                      {seat.removed && (
                        <Typography variant="body2" color="error">
                          🔧 Under Maintenance
                        </Typography>
                      )}
                    </Box>
                  }
                  arrow
                >
                  <Card
                    sx={{
                      minHeight: isMobile ? 70 : 90,
                      cursor: 'default',
                      transition: 'all 0.2s ease',
                      border: isHighlighted 
                        ? '2px solid #4caf50' 
                        : seat.occupied && seat.gender
                          ? `1px solid ${seat.gender === 'female' ? '#e91e63' : '#1976d2'}`
                          : '1px solid transparent',
                      borderRadius: seat.occupied && seat.gender === 'female' ? '16px' : '8px',
                      background: getSeatBackground(seat),
                      boxShadow: seat.occupied ? 2 : 1,
                    }}
                  >
                    <CardContent sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      p: isMobile ? 0.5 : 1,
                      '&:last-child': { pb: isMobile ? 0.5 : 1 }
                    }}>
                      {seat.occupied ? (
                        <Badge
                          color="secondary"
                          variant="dot"
                          invisible={!seat.expiring}
                          sx={{
                            '& .MuiBadge-badge': {
                              backgroundColor: '#ff9800',
                              animation: seat.expiring ? 'blink 1s infinite' : 'none',
                              '@keyframes blink': {
                                '50%': { opacity: 0 }
                              }
                            }
                          }}
                        >
                          {seat.gender === 'female' ? (
                            <FemaleIcon sx={{ 
                              color: 'white', 
                              fontSize: isMobile ? 20 : 28,
                              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))'
                            }} />
                          ) : (
                            <MaleIcon sx={{ 
                              color: 'white', 
                              fontSize: isMobile ? 20 : 28,
                              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))'
                            }} />
                          )}
                        </Badge>
                      ) : (
                        <EventSeatIcon sx={{ 
                          color: seat.removed ? '#757575' : '#9e9e9e', 
                          fontSize: isMobile ? 20 : 28,
                          opacity: seat.removed ? 0.5 : 0.7
                        }} />
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 0.5,
                          fontSize: isMobile ? '0.65rem' : '0.75rem',
                          fontWeight: 'bold',
                          color: seat.occupied ? 'white' : 'text.secondary',
                          textShadow: seat.occupied ? '0 1px 1px rgba(0,0,0,0.5)' : 'none'
                        }}
                      >
                        #{seat.seatNumber}
                      </Typography>
                    </CardContent>
                  </Card>
                </Tooltip>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* Student Details Dialog */}
      <Dialog 
        open={Boolean(selectedSeat)} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        {selectedSeat && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ 
                    bgcolor: selectedSeat.gender === 'female' ? 'secondary.main' : 'primary.main',
                    width: 56,
                    height: 56
                  }}>
                    {selectedSeat.gender === 'female' ? (
                      <FemaleIcon sx={{ fontSize: 32 }} />
                    ) : (
                      <MaleIcon sx={{ fontSize: 32 }} />
                    )}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{selectedSeat.studentName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Seat #{selectedSeat.seatNumber} • {selectedSeat.gender === 'male' ? 'Male' : 'Female'}
                    </Typography>
                  </Box>
                </Box>
                <IconButton onClick={handleCloseDialog}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                {selectedSeat.expiring && (
                  <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                    <CardContent sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon />
                        <Typography variant="body2" fontWeight="bold">
                          Membership Expiring Soon!
                        </Typography>
                      </Box>
                      <Typography variant="caption">
                        Expires on: {selectedSeat.membershipExpiry}
                      </Typography>
                    </CardContent>
                  </Card>
                )}
                
                <Divider />
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Student Information
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon fontSize="small" color="action" />
                      <Typography variant="body2">ID: {selectedSeat.studentId}</Typography>
                    </Box>
                    {selectedSeat.contactNumber && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon fontSize="small" color="action" />
                        <Typography variant="body2">{selectedSeat.contactNumber}</Typography>
                      </Box>
                    )}
                    {selectedSeat.membershipExpiry && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarMonthIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          Membership expires: {selectedSeat.membershipExpiry}
                        </Typography>
                      </Box>
                    )}
                    {selectedSeat.lastPayment && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarMonthIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          Last payment: {selectedSeat.lastPayment}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Seat Information
                  </Typography>
                  <Typography variant="body1">
                    Seat Number: #{selectedSeat.seatNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gender Section: {selectedSeat.gender === 'male' ? 'Male (♂)' : 'Female (♀)'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Status
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      icon={<TrendingUpIcon />} 
                      label="Active" 
                      color="success" 
                      size="small" 
                    />
                    {selectedSeat.expiring && (
                      <Chip 
                        icon={<TrendingDownIcon />} 
                        label="Expiring Soon" 
                        color="warning" 
                        size="small" 
                      />
                    )}
                  </Box>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseDialog} color="inherit">
                Close
              </Button>
              <Button variant="contained" color="primary" size="small">
                View Profile
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Admin Context Menu */}
      <Menu
        anchorEl={adminMenuAnchor}
        open={Boolean(adminMenuAnchor)}
        onClose={handleAdminMenuClose}
      >
        {selectedSeatForAdmin && !selectedSeatForAdmin.removed && (
          <MenuItem onClick={() => handleSeatAction('remove')}>
            <ListItemIcon>
              <DeleteIcon color="error" />
            </ListItemIcon>
            <ListItemText>Remove Seat</ListItemText>
          </MenuItem>
        )}
        {selectedSeatForAdmin && !selectedSeatForAdmin.removed && (
          <MenuItem onClick={() => handleSeatAction('maintenance')}>
            <ListItemIcon>
              <BuildIcon color="warning" />
            </ListItemIcon>
            <ListItemText>Put Under Maintenance</ListItemText>
          </MenuItem>
        )}
        {selectedSeatForAdmin && selectedSeatForAdmin.removed && (
          <MenuItem onClick={() => handleSeatAction('restore')}>
            <ListItemIcon>
              <RestoreIcon color="success" />
            </ListItemIcon>
            <ListItemText>Restore Seat</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Add Seat FAB - Only visible in admin mode */}
      {adminMode && (
        <Fab
          color="primary"
          aria-label="add seat"
          onClick={addNewSeat}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
        >
          <AddCircleIcon />
        </Fab>
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleNotificationClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleNotificationClose} 
          severity={notification.severity}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default SeatChartReport;
