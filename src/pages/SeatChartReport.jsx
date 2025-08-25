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
      setError('Failed to load seat chart data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const getStatistics = () => {
    const total = seatData.length;
    const occupied = seatData.filter(seat => seat.occupied && !seat.removed).length;
    const vacant = seatData.filter(seat => !seat.occupied && !seat.removed).length;
    const expiring = seatData.filter(seat => seat.expiring && !seat.removed).length;
    const removed = seatData.filter(seat => seat.removed).length;
    const occupancyRate = total > 0 ? ((occupied / (total - removed)) * 100).toFixed(1) : 0;

    return { total, occupied, vacant, expiring, removed, occupancyRate };
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
      setNotification({
        open: true,
        message: 'Failed to update seat status',
        severity: 'error'
      });
    }

    handleAdminMenuClose();
  };

  const addNewSeat = () => {
    const newSeatNumber = Math.max(...seatData.map(s => s.seatNumber)) + 1;
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
          Seat Chart Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            onClick={fetchSeatChart} 
            color="primary"
            sx={{ 
              bgcolor: theme.palette.primary.main + '10',
              '&:hover': { bgcolor: theme.palette.primary.main + '20' }
            }}
          >
            <RefreshIcon />
          </IconButton>
          <Button
            variant={autoRefresh ? "contained" : "outlined"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="small"
            startIcon={<AccessTimeIcon />}
          >
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </Button>
          <Button
            variant={adminMode ? "contained" : "outlined"}
            onClick={() => setAdminMode(!adminMode)}
            size="small"
            startIcon={<AdminPanelSettingsIcon />}
            color={adminMode ? "secondary" : "primary"}
          >
            Admin {adminMode ? 'ON' : 'OFF'}
          </Button>
        </Box>
      </Box>

      {/* Quick Insights */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Typography variant="h6" gutterBottom>
          📊 Quick Insights
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Total Capacity
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">
                {statistics.total - statistics.removed}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Revenue Potential
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                ₹{(statistics.occupied * 2500).toLocaleString()}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Needs Attention
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                {statistics.expiring}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Available Seats
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="info.main">
                {statistics.vacant}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="h4" fontWeight="bold">{statistics.occupied}</Typography>
              <Typography variant="body2">Occupied</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'grey.100' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="h4" fontWeight="bold">{statistics.vacant}</Typography>
              <Typography variant="body2">Vacant</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'warning.main', color: 'white' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="h4" fontWeight="bold">{statistics.expiring}</Typography>
              <Typography variant="body2">Expiring</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'success.main', color: 'white' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="h4" fontWeight="bold">{statistics.occupancyRate}%</Typography>
              <Typography variant="body2">Occupancy</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts Section */}
      {statistics.expiring > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'warning.light', borderLeft: '4px solid', borderColor: 'warning.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon color="warning" />
            <Typography variant="subtitle1" fontWeight="bold">
              Action Required: {statistics.expiring} membership{statistics.expiring > 1 ? 's' : ''} expiring soon
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
            Contact these students to renew their memberships to avoid seat vacancy.
          </Typography>
        </Paper>
      )}

      {/* Admin Mode Notice */}
      {adminMode && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light', borderLeft: '4px solid', borderColor: 'info.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettingsIcon color="info" />
            <Typography variant="subtitle1" fontWeight="bold">
              Admin Mode Active
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
            Click on any seat to manage it. You can add new seats, remove existing ones, or put them under maintenance.
          </Typography>
        </Paper>
      )}

      <Paper sx={{ p: isMobile ? 2 : 3 }}>
        {/* Search and Legend */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search by seat number or student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              icon={<MaleIcon />} 
              label="Male Occupied" 
              sx={{ 
                background: seatColors.occupied.male.gradient,
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }} 
            />
            <Chip 
              icon={<FemaleIcon />} 
              label="Female Occupied" 
              sx={{ 
                background: seatColors.occupied.female.gradient,
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }} 
            />
            <Chip 
              icon={<EventSeatIcon />} 
              label="Vacant" 
              sx={{ 
                background: seatColors.vacant.gradient,
                '& .MuiChip-icon': { color: 'text.secondary' }
              }} 
            />
            <Chip 
              icon={<AccessTimeIcon />} 
              label="Expiring Soon" 
              sx={{ 
                background: seatColors.expiring.male.gradient,
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }} 
            />
            <Chip 
              icon={<RemoveCircleOutlineIcon />} 
              label="Maintenance" 
              sx={{ 
                background: seatColors.removed.gradient,
                '& .MuiChip-icon': { color: 'text.secondary' }
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
            gap: 2,
            p: 2
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
                      {adminMode && <Typography variant="caption">Admin: Click to manage</Typography>}
                      {!adminMode && seat.occupied && <Typography variant="caption">Click for details</Typography>}
                    </Box>
                  }
                  arrow
                >
                  <Card
                    onClick={(e) => {
                      if (adminMode) {
                        handleSeatAdminClick(seat, e);
                      } else {
                        handleSeatClick(seat);
                      }
                    }}
                    sx={{
                      minHeight: 100,
                      cursor: adminMode 
                        ? 'pointer' 
                        : seat.occupied 
                          ? 'pointer' 
                          : 'default',
                      transition: 'all 0.3s ease',
                      border: isHighlighted 
                        ? '3px solid #4caf50' 
                        : seat.occupied && seat.gender
                          ? `2px solid ${seat.gender === 'female' ? '#e91e63' : '#1976d2'}`
                          : '1px solid transparent',
                      borderRadius: seat.occupied && seat.gender === 'female' ? '20px' : '12px',
                      background: getSeatBackground(seat),
                      '&:hover': seat.occupied ? {
                        transform: 'translateY(-4px)',
                        boxShadow: 6
                      } : {},
                      boxShadow: seat.occupied ? 3 : 1,
                      animation: isHighlighted ? 'pulse 1s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.7)' },
                        '70%': { boxShadow: '0 0 0 10px rgba(76, 175, 80, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)' }
                      }
                    }}
                  >
                    <CardContent sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      p: 1.5,
                      '&:last-child': { pb: 1.5 }
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
                          {getSeatIcon(seat)}
                        </Badge>
                      ) : (
                        getSeatIcon(seat)
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 1,
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          color: seat.occupied ? 'white' : 'text.secondary',
                          textShadow: seat.occupied ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
                        }}
                      >
                        #{seat.seatNumber}
                      </Typography>
                      {seat.occupied && seat.studentName && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.9)',
                            textAlign: 'center',
                            lineHeight: 1.2,
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textShadow: '0 1px 1px rgba(0,0,0,0.5)'
                          }}
                        >
                          {seat.studentName.split(' ')[0]}
                        </Typography>
                      )}
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
            <DialogActions>
              <Button onClick={handleCloseDialog}>Close</Button>
              <Button variant="contained" color="primary">
                View Profile
              </Button>
              <Button variant="outlined" color="warning">
                Extend Membership
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
