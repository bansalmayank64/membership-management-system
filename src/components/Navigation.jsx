import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tabs,
  Tab,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Avatar
} from '@mui/material';
import {
  Menu as MenuIcon,
  People as PeopleIcon,
  Payment as PaymentIcon,
  Warning as WarningIcon,
  Receipt as ReceiptIcon,
  LibraryBooks as LibraryIcon,
  ContactPhone as ContactIcon,
  Storage as StorageIcon,
  EventSeat as EventSeatIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

function Navigation() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const navigationItems = [
    { label: t('nav.students'), path: '/', icon: <PeopleIcon /> },
    { label: t('nav.payments'), path: '/payments', icon: <PaymentIcon /> },
    { label: t('nav.expenses'), path: '/expenses', icon: <ReceiptIcon /> },
    { label: 'Seat Chart', path: '/seat-chart', icon: <EventSeatIcon /> },
    { label: t('nav.contactUs'), path: '/contact', icon: <ContactIcon /> },
  ];

  const currentTab = navigationItems.findIndex(item => item.path === location.pathname);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box sx={{ width: 250, pt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, mb: 3 }}>
        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
          <LibraryIcon />
        </Avatar>
        <Typography variant="h6" component="div">
          Study Room
        </Typography>
      </Box>
      <List>
        {navigationItems.map((item) => (
          <ListItem
            key={item.label}
            component={Link}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            sx={{
              color: 'inherit',
              textDecoration: 'none',
              borderRadius: 2,
              mx: 1,
              mb: 0.5,
              '&:hover': {
                backgroundColor: 'action.hover',
              },
              ...(location.pathname === item.path && {
                backgroundColor: 'primary.main',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              }),
            }}
          >
            <ListItemIcon sx={{ 
              color: location.pathname === item.path ? 'white' : 'inherit',
              minWidth: 40 
            }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Avatar sx={{ bgcolor: 'white', color: 'primary.main', mr: 2 }}>
              <LibraryIcon />
            </Avatar>
            <Typography 
              variant={isMobile ? "h6" : "h6"} 
              component="div" 
              sx={{ 
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }}
            >
              Goga Ji Library
            </Typography>
          </Box>

          <LanguageSwitcher />

          {!isMobile && (
            <Tabs
              value={currentTab !== -1 ? currentTab : false}
              sx={{
                ml: 3,
                '& .MuiTab-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-selected': {
                    color: 'white',
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: 'white',
                },
              }}
            >
              {navigationItems.map((item) => (
                <Tab
                  key={item.label}
                  label={item.label}
                  component={Link}
                  to={item.path}
                  icon={item.icon}
                  iconPosition="start"
                  sx={{ 
                    textTransform: 'none',
                    minHeight: 48,
                    '& .MuiTab-iconWrapper': {
                      mr: 1,
                    },
                  }}
                />
              ))}
            </Tabs>
          )}
        </Toolbar>
      </AppBar>

      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 250,
            },
          }}
        >
          {drawer}
        </Drawer>
      )}
    </>
  );
}

export default Navigation;
