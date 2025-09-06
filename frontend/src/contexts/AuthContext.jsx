import React, { createContext, useContext, useState, useEffect } from 'react';
import { setTokenExpirationHandler } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);
  const [tokenCheckInterval, setTokenCheckInterval] = useState(null);

  useEffect(() => {
    // Set up the token expiration handler
    setTokenExpirationHandler((errorType) => {
      if (errorType === 'TOKEN_INVALIDATED') {
        console.warn('🔐 Token invalidated by admin, logging out user...');
        logout(true, 'Your session has been terminated by an administrator. Please login again.');
      } else {
        console.warn('🔐 Token expired, logging out user...');
        logout(true, 'Your session has expired. Please login again.');
      }
    });

    if (token) {
      verifyToken();
      // Start periodic token validation when user is logged in
      startTokenValidation();
    } else {
      setLoading(false);
      // Stop token validation when no token
      stopTokenValidation();
    }

    // Cleanup interval on unmount
    return () => stopTokenValidation();
  }, [token]);

  // Periodic token validation to catch blacklisted tokens quickly
  const startTokenValidation = () => {
    // Clear any existing interval
    stopTokenValidation();
    
    // Check token status every 5 seconds when user is active
    const interval = setInterval(async () => {
      if (token && user) {
        try {
          const response = await fetch(`/api/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Check for blacklisted token or any auth error
            if (response.status === 401 || 
                errorData.error?.includes('invalidated') || 
                errorData.error?.includes('blacklisted') ||
                errorData.error?.includes('Token has been invalidated')) {
              console.warn('🔐 Token has been invalidated by admin, logging out immediately...');
              logout(true, 'Your session has been terminated by an administrator.');
              return;
            }
            
            // Other auth errors
            if (errorData.error?.includes('expired') || 
                errorData.error?.includes('Invalid or expired token')) {
              console.warn('🔐 Token expired during background check, logging out...');
              logout(true, 'Your session has expired.');
              return;
            }
          }
        } catch (error) {
          // Network errors during background check - don't logout, just log
          console.debug('Background token check failed:', error.message);
        }
      }
    }, 5000); // Check every 5 seconds
    
    setTokenCheckInterval(interval);
    
    // Also add event listeners for user activity to trigger immediate checks
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    let lastActivityCheck = 0;
    
    const handleUserActivity = async () => {
      const now = Date.now();
      // Throttle activity checks to once per 2 seconds
      if (now - lastActivityCheck < 2000) return;
      lastActivityCheck = now;
      
      if (token && user) {
        try {
          const response = await fetch(`/api/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 401 || 
                errorData.error?.includes('invalidated') || 
                errorData.error?.includes('blacklisted') ||
                errorData.error?.includes('Token has been invalidated')) {
              console.warn('🔐 Token invalidated detected during user activity, logging out...');
              logout(true, 'Your session has been terminated by an administrator.');
              return;
            }
          }
        } catch (error) {
          console.debug('Activity-triggered token check failed:', error.message);
        }
      }
    };
    
    // Add activity listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });
    
    // Store cleanup function for activity listeners
    window.authCleanupActivityListeners = () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  };

  const stopTokenValidation = () => {
    if (tokenCheckInterval) {
      clearInterval(tokenCheckInterval);
      setTokenCheckInterval(null);
    }
    
    // Clean up activity listeners
    if (window.authCleanupActivityListeners) {
      window.authCleanupActivityListeners();
      window.authCleanupActivityListeners = null;
    }
  };

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('🔐 Token verification failed:', errorData);
        
        // Check for blacklisted/invalidated token
        if (errorData.error?.includes('invalidated') || 
            errorData.error?.includes('blacklisted') ||
            errorData.error?.includes('Token has been invalidated')) {
          console.warn('🔐 Token has been invalidated by admin during verification');
          logout(true, 'Your session has been terminated by an administrator. Please login again.');
          return;
        }
        
        // Check if it's a token expiration error
        if (errorData.error?.includes('expired') || 
            errorData.error?.includes('Invalid or expired token') ||
            errorData.error?.includes('TokenExpiredError') ||
            response.status === 401) {
          console.warn('🔐 Token expired during verification, logging out...');
          logout(true, 'Your session has expired. Please login again.');
          return;
        }
        
        // Other errors - logout anyway
        logout();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
  const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const logout = (showMessage = false, customMessage = null) => {
    // Stop token validation immediately
    stopTokenValidation();
    
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    
    if (showMessage) {
      const message = customMessage || 'Your session has expired. Please login again.';
      console.warn('🔐 ' + message);
      
      // Show a more user-friendly notification
      if (customMessage?.includes('administrator')) {
        // Admin logout - more prominent notification
        alert('⚠️ ' + message);
      } else {
        // Regular expiration - gentler notification
        if (window.confirm('🔐 ' + message + ' Click OK to continue to login.')) {
          // User acknowledged the message
        }
      }
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
