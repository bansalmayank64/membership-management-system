import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import AuthDialog from './AuthDialog';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user, token } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        // Check if user was previously authenticated (session expired)
        const wasAuthenticated = localStorage.getItem('authToken') !== null || user !== null;
        setSessionExpired(wasAuthenticated);
        setShowAuthDialog(true);
      } else {
        setShowAuthDialog(false);
        setSessionExpired(false);
      }
    }
  }, [loading, isAuthenticated, user]);

  // Additional token validation
  useEffect(() => {
    if (token && isAuthenticated) {
      try {
        // Basic JWT validation - check if token is malformed
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Check if token is expired
        if (payload.exp && payload.exp < currentTime) {
          console.warn('🔐 Token expired (client-side check)');
          setSessionExpired(true);
        }
      } catch (error) {
        console.warn('🔐 Invalid token format');
        setSessionExpired(true);
      }
    }
  }, [token, isAuthenticated]);

  if (loading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        minHeight="50vh"
        gap={2}
      >
        <CircularProgress />
        <Typography variant="body1">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated || sessionExpired) {
    return (
      <>
        <Box 
          display="flex" 
          flexDirection="column"
          justifyContent="center" 
          alignItems="center" 
          minHeight="50vh"
          gap={2}
          sx={{ p: 3 }}
        >
          {sessionExpired ? (
            <Alert severity="warning" sx={{ mb: 2, maxWidth: 400 }}>
              <Typography variant="h6" gutterBottom>
                Session Expired
              </Typography>
              <Typography variant="body2">
                Your session has expired for security reasons. Please login again to continue.
              </Typography>
            </Alert>
          ) : (
            <Typography variant="h6" color="text.secondary">
              Please log in to access this page
            </Typography>
          )}
          
          <Button 
            variant="contained" 
            onClick={() => setShowAuthDialog(true)}
            sx={{ mt: 1 }}
          >
            Login
          </Button>
        </Box>
        <AuthDialog 
          open={showAuthDialog} 
          onClose={() => {
            setShowAuthDialog(false);
            setSessionExpired(false);
          }} 
        />
      </>
    );
  }

  return children;
};

export default ProtectedRoute;
