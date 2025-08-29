import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, Alert, Typography, Container } from '@mui/material';
import ProtectedRoute from './ProtectedRoute';

const AdminRoute = ({ children }) => {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      {user?.role === 'admin' ? (
        children
      ) : (
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Access Denied
            </Typography>
            <Typography variant="body1">
              Admin privileges required to access this page. Please contact your system administrator if you believe this is an error.
            </Typography>
          </Alert>
        </Container>
      )}
    </ProtectedRoute>
  );
};

export default AdminRoute;
