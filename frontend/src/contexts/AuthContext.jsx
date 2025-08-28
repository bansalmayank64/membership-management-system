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

  useEffect(() => {
    // Set up the token expiration handler
    setTokenExpirationHandler(() => {
      console.warn('🔐 Token expired, logging out user...');
      logout(true); // Show message when token expires during API calls
    });

    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }, [token]);

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
        
        // Check if it's a token expiration error
        if (errorData.error?.includes('expired') || 
            errorData.error?.includes('Invalid or expired token') ||
            errorData.error?.includes('TokenExpiredError') ||
            response.status === 401) {
          console.warn('🔐 Token expired during verification, logging out...');
        }
        
        // Token is invalid - logout
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

  const logout = (showMessage = false) => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    
    if (showMessage) {
      // You can use a toast notification here if you have one set up
      console.warn('🔐 Session expired. Please login again.');
      
      // Optional: Show an alert (can be replaced with better notification)
      if (window.confirm('Your session has expired. Click OK to continue to login.')) {
        // User acknowledged the message
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
