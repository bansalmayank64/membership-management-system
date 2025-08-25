import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import AuthDialog from './AuthDialog';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      setShowAuthDialog(true);
    } else if (isAuthenticated) {
      setShowAuthDialog(false);
    }
  }, [loading, isAuthenticated]);

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

  if (!isAuthenticated) {
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
          <Typography variant="h6" color="text.secondary">
            Please log in to access this page
          </Typography>
        </Box>
        <AuthDialog 
          open={showAuthDialog} 
          onClose={() => setShowAuthDialog(false)} 
        />
      </>
    );
  }

  return children;
};

export default ProtectedRoute;
