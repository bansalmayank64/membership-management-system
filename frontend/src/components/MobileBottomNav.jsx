import React from 'react';
import { Box, BottomNavigation, BottomNavigationAction, Paper, Button } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import EventSeatIcon from '@mui/icons-material/EventSeat';

// A compact mobile bottom navigation + primary CTA matching the provided design reference.
export default function MobileBottomNav({ onAddStudent, value, onChange, onOpenSeats }) {
  return (
    <Paper
      id="mobile-bottom-nav"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 12,
        px: 2,
        // ensure nav is above page content
        zIndex: (theme) => theme.zIndex.modal + 10,
        // slight rounded corners to match reference
        borderRadius: '12px'
      }}
      elevation={6}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <BottomNavigation
          showLabels
          value={value}
          onChange={(e, v) => onChange && onChange(v)}
          sx={{ flex: 1, bgcolor: 'transparent' }}
        >
          <BottomNavigationAction label="Dashboard" icon={<DashboardIcon />} />
          <BottomNavigationAction label="Students" icon={<PersonIcon />} />
          <BottomNavigationAction
            label="Seats"
            icon={<EventSeatIcon />}
            onClick={() => { if (onOpenSeats) onOpenSeats(); }}
          />
        </BottomNavigation>
      </Box>
    </Paper>
  );
}
