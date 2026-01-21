import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import {
  Close as CloseIcon,
  Payment as PaymentIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  EventSeat as EventSeatIcon,
  History as HistoryIcon,
  AttachMoney as AttachMoneyIcon,
  Receipt as ReceiptIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { formatDateForDisplay } from '../utils/dateUtils';

// Helper function to get icon based on activity type
const getActivityIcon = (actionType, subjectType) => {
  if (actionType === 'payment' || actionType === 'PAYMENT') {
    return <PaymentIcon />;
  }
  if (actionType === 'refund' || actionType === 'REFUND') {
    return <ReceiptIcon />;
  }
  if (actionType === 'INSERT' || actionType === 'ADD') {
    return <AddIcon />;
  }
  if (actionType === 'UPDATE' || actionType === 'EDIT') {
    return <EditIcon />;
  }
  if (actionType === 'DELETE') {
    return <DeleteIcon />;
  }
  if (actionType === 'ASSIGN' || actionType === 'assigned') {
    return <EventSeatIcon />;
  }
  if (actionType === 'unassigned') {
    return <CancelIcon />;
  }
  if (actionType === 'deactivated') {
    return <CancelIcon />;
  }
  if (subjectType === 'seat') {
    return <EventSeatIcon />;
  }
  if (subjectType === 'student') {
    return <PersonAddIcon />;
  }
  if (subjectType === 'payment') {
    return <AttachMoneyIcon />;
  }
  return <HistoryIcon />;
};

// Helper function to get color based on activity type
const getActivityColor = (actionType) => {
  if (!actionType) return '#9e9e9e'; // grey
  
  const action = String(actionType).toLowerCase();
  
  if (action === 'payment') return '#4caf50'; // success green
  if (action === 'refund') return '#ff9800'; // warning orange
  if (action === 'insert' || action === 'add') return '#4caf50'; // success green
  if (action === 'update' || action === 'edit') return '#2196f3'; // info blue
  if (action === 'delete' || action === 'deactivated') return '#f44336'; // error red
  if (action === 'assign' || action === 'assigned') return '#1976d2'; // primary blue
  if (action === 'unassign' || action === 'unassigned') return '#ff9800'; // warning orange
  
  return '#9e9e9e'; // grey
};

// Helper function to format activity description
const formatActivityDescription = (activity) => {
  const { action_type, subject_type, details, changes } = activity;
  
  if (action_type === 'payment' || action_type === 'PAYMENT') {
    return `Payment of ₹${details?.amount || 0} received${details?.remarks ? ` (${details.remarks})` : ''}`;
  }
  
  if (action_type === 'refund' || action_type === 'REFUND') {
    return `Refund of ₹${Math.abs(details?.amount || 0)} processed${details?.remarks ? ` (${details.remarks})` : ''}`;
  }
  
  if (action_type === 'INSERT') {
    if (subject_type === 'student') {
      return `Student record created`;
    }
    return `${subject_type} record created`;
  }
  
  if (action_type === 'UPDATE') {
    if (subject_type === 'student' && changes && changes.length > 0) {
      // Show specific field changes
      const changeDescriptions = changes.map(c => `${c.field}: "${c.oldValue}" → "${c.newValue}"`);
      return changeDescriptions.join(', ');
    }
    if (subject_type === 'student') {
      return `Student details updated`;
    }
    return `${subject_type} updated`;
  }
  
  if (action_type === 'deactivated') {
    return `Student deactivated`;
  }
  
  if (action_type === 'ASSIGN' || action_type === 'assigned') {
    return `Assigned to seat ${details?.seat_number || 'N/A'}`;
  }
  
  if (action_type === 'unassigned') {
    return `Unassigned from seat ${details?.seat_number || 'N/A'}`;
  }
  
  if (action_type === 'DELETE') {
    return `${subject_type} deleted`;
  }
  
  return `${action_type} - ${subject_type}`;
};

// Helper to render activity details
const renderActivityDetails = (details, actionType) => {
  if (!details || Object.keys(details).length === 0) return null;
  
  return (
    <Box sx={{ mt: 1, pl: 2 }}>
      {details.amount !== undefined && (
        <Typography variant="caption" display="block" color="text.secondary">
          Amount: ₹{details.amount}
        </Typography>
      )}
      {details.payment_date && (
        <Typography variant="caption" display="block" color="text.secondary">
          Payment Date: {formatDateForDisplay(details.payment_date)}
        </Typography>
      )}
      {details.seat_number && (
        <Typography variant="caption" display="block" color="text.secondary">
          Seat: {details.seat_number}
        </Typography>
      )}
      {details.name && actionType !== 'payment' && actionType !== 'PAYMENT' && (
        <Typography variant="caption" display="block" color="text.secondary">
          Name: {details.name}
        </Typography>
      )}
      {details.contact && (
        <Typography variant="caption" display="block" color="text.secondary">
          Contact: {details.contact}
        </Typography>
      )}
      {details.membership_status && (
        <Chip 
          label={details.membership_status} 
          size="small" 
          sx={{ 
            mt: 0.5,
            bgcolor: details.membership_status === 'active' ? '#4caf50' : '#9e9e9e',
            color: '#fff'
          }}
        />
      )}
    </Box>
  );
};

export default function StudentActivitiesDialog({ open, onClose, student }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activities, setActivities] = useState([]);
  const [tabValue, setTabValue] = useState(0); // 0: All, 1: Payments, 2: Changes

  useEffect(() => {
    if (open && student?.id) {
      fetchActivities();
    }
  }, [open, student?.id]);

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both payment history and student activities (changes + seat assignments)
      const [paymentsResponse, activitiesResponse] = await Promise.all([
        fetch(`/api/students/${student.id}/payments`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }),
        fetch(`/api/students/${student.id}/activities`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        })
      ]);

      if (!paymentsResponse.ok || !activitiesResponse.ok) {
        throw new Error('Failed to fetch activity data');
      }

      const payments = await paymentsResponse.json();
      const history = await activitiesResponse.json();

      console.log('📊 Activities API Response:', { payments, history });

      // Ensure we have arrays
      const paymentsArray = Array.isArray(payments) ? payments : [];
      const historyArray = Array.isArray(history) ? history : [];

      console.log('📊 Array lengths:', { payments: paymentsArray.length, history: historyArray.length });

      // Transform payments to activity format
      const paymentActivities = paymentsArray
        .filter(p => p && (p.created_at || p.payment_date)) // Filter out invalid records
        .map(p => ({
          ts: p.created_at || p.payment_date,
          action_type: p.payment_type || (p.amount >= 0 ? 'payment' : 'refund'),
          modified_by: p.modified_by,
          modified_by_name: p.modified_by_name || 'System',
          subject_type: 'payment',
          details: {
            amount: p.amount,
            payment_date: p.payment_date,
            remarks: p.remarks
          }
        }));

      // Transform history to activity format
      // Build changes array for UPDATE actions by comparing current vs previous values
      const historyActivities = historyArray
        .filter(h => h && h.action_timestamp) // Filter out records without timestamp
        .map(h => {
          // Build changes array for UPDATE actions
          const changes = [];
          if (h.action === 'UPDATE' && h.record_type === 'student_change') {
            // Compare each field with its previous value
            if (h.name !== h.prev_name && h.prev_name !== null) {
              changes.push({ field: 'Name', oldValue: h.prev_name, newValue: h.name });
            }
            if (h.father_name !== h.prev_father_name && h.prev_father_name !== null) {
              changes.push({ field: 'Father Name', oldValue: h.prev_father_name, newValue: h.father_name });
            }
            if (h.contact_number !== h.prev_contact_number && h.prev_contact_number !== null) {
              changes.push({ field: 'Contact', oldValue: h.prev_contact_number, newValue: h.contact_number });
            }
            if (h.aadhaar_number !== h.prev_aadhaar_number && h.prev_aadhaar_number !== null) {
              changes.push({ field: 'Aadhaar', oldValue: h.prev_aadhaar_number || '(empty)', newValue: h.aadhaar_number || '(empty)' });
            }
            if (h.address !== h.prev_address && h.prev_address !== null) {
              changes.push({ field: 'Address', oldValue: h.prev_address, newValue: h.address });
            }
            if (h.sex !== h.prev_sex && h.prev_sex !== null) {
              changes.push({ field: 'Gender', oldValue: h.prev_sex, newValue: h.sex });
            }
            if (h.seat_number !== h.prev_seat_number && h.prev_seat_number !== undefined) {
              changes.push({ field: 'Seat', oldValue: h.prev_seat_number || '(none)', newValue: h.seat_number || '(none)' });
            }
            if (h.membership_status !== h.prev_membership_status && h.prev_membership_status !== null) {
              changes.push({ field: 'Status', oldValue: h.prev_membership_status, newValue: h.membership_status });
            }
            // Format dates for comparison
            const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : null;
            if (formatDate(h.membership_date) !== formatDate(h.prev_membership_date) && h.prev_membership_date !== null) {
              changes.push({ field: 'Start Date', oldValue: formatDate(h.prev_membership_date), newValue: formatDate(h.membership_date) });
            }
            if (formatDate(h.membership_till) !== formatDate(h.prev_membership_till) && h.prev_membership_till !== undefined) {
              changes.push({ field: 'End Date', oldValue: formatDate(h.prev_membership_till) || '(none)', newValue: formatDate(h.membership_till) || '(none)' });
            }
          }
          
          return {
            ts: h.action_timestamp,
            action_type: h.action || 'UPDATE',
            modified_by: h.modified_by,
            modified_by_name: h.modified_by_name || 'System',
            subject_type: h.record_type === 'seat_assignment' ? 'seat' : 'student',
            changes: changes, // Array of {field, oldValue, newValue}
            details: {
              name: h.name,
              seat_number: h.seat_number,
              contact: h.contact_number,
              membership_status: h.membership_status,
              record_type: h.record_type
            }
          };
        });

      // Add index to history activities to preserve backend ordering
      const indexedHistory = historyActivities.map((h, idx) => ({ ...h, _backendOrder: idx }));
      
      // Combine payments with history, then sort by timestamp
      // For same timestamps, preserve backend order (which has INSERT before ASSIGN)
      const allActivities = [...paymentActivities.map((p, idx) => ({ ...p, _backendOrder: idx + 10000 })), ...indexedHistory]
        .filter(a => a.ts)
        .sort((a, b) => {
          const timeA = new Date(a.ts).getTime();
          const timeB = new Date(b.ts).getTime();
          
          if (timeB !== timeA) {
            return timeB - timeA; // Most recent first
          }
          
          // Same timestamp: preserve backend order for history items
          return a._backendOrder - b._backendOrder;
        });

      setActivities(allActivities);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Filter activities based on selected tab
  const filteredActivities = activities.filter(activity => {
    if (tabValue === 0) return true; // All
    if (tabValue === 1) return activity.subject_type === 'payment'; // Payments only
    if (tabValue === 2) return activity.subject_type !== 'payment'; // Changes only
    return true;
  });

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          height: { xs: '90vh', md: '80vh' },
          maxHeight: { xs: '90vh', md: '80vh' }
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" component="span">
              Activity History
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {student?.name || 'Student'} - ID: {student?.id}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="activity tabs">
          <Tab 
            label={`All (${activities.length})`} 
            icon={<HistoryIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={`Payments (${activities.filter(a => a.subject_type === 'payment').length})`}
            icon={<PaymentIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={`Changes (${activities.filter(a => a.subject_type !== 'payment').length})`}
            icon={<EditIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : filteredActivities.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <InfoIcon sx={{ fontSize: 64, color: 'action.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No activities found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tabValue === 1 ? 'No payment records available' : 
               tabValue === 2 ? 'No change records available' : 
               'No activity records available'}
            </Typography>
          </Box>
        ) : (
          <Timeline position="right">
            {filteredActivities.map((activity, index) => (
              <TimelineItem key={index}>
                <TimelineOppositeContent 
                  sx={{ 
                    flex: 0.3, 
                    px: { xs: 1, md: 2 },
                    display: { xs: 'none', sm: 'block' }
                  }} 
                  color="text.secondary"
                >
                  <Typography variant="caption" display="block">
                    {new Date(activity.ts).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {new Date(activity.ts).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography>
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot sx={{ bgcolor: getActivityColor(activity?.action_type) }}>
                    {getActivityIcon(activity?.action_type, activity?.subject_type)}
                  </TimelineDot>
                  {index < filteredActivities.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ py: 1.5, px: 2 }}>
                  <Paper 
                    elevation={2} 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'background.paper',
                      '&:hover': {
                        boxShadow: 4
                      }
                    }}
                  >
                    {/* Mobile: Show date/time here */}
                    <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(activity.ts).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Typography>
                    </Box>
                    
                    <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600 }}>
                      {formatActivityDescription(activity)}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                      <Chip 
                        label={activity.action_type}
                        size="small"
                        sx={{ 
                          fontSize: '0.7rem',
                          bgcolor: getActivityColor(activity?.action_type),
                          color: '#fff'
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        by {activity.modified_by_name || 'System'}
                      </Typography>
                    </Box>
                    
                    {renderActivityDetails(activity.details, activity.action_type)}
                  </Paper>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
