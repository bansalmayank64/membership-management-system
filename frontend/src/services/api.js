// API Base URL - Update this to your backend URL when deployed
const API_BASE_URL = '/api';

// Global token expiration handler
let onTokenExpired = null;

// Set the token expiration callback
export function setTokenExpirationHandler(callback) {
  onTokenExpired = callback;
}

// Helper function to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

// Global response handler for authentication errors
async function handleResponse(response) {
  // Check for authentication errors
  if (response.status === 401 || response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    
    // Check if it's a token expiration error
    if (errorData.error?.includes('expired') || 
        errorData.error?.includes('Invalid or expired token') ||
        errorData.error?.includes('TokenExpiredError') ||
        response.status === 401) {
      
      console.warn('🔐 Token expired or invalid, triggering logout...');
      
      // Trigger logout through the callback if set
      if (onTokenExpired) {
        onTokenExpired();
      }
      
      throw new Error('TOKEN_EXPIRED');
    }
    
    throw new Error(errorData.error || 'Authentication failed');
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  
  return response;
}

// Fetch seat chart data from PostgreSQL backend
export async function getSeatChartData() {
  try {
    const response = await fetch(`${API_BASE_URL}/seats`, {
      headers: getAuthHeaders()
    });
    
    // Use the global response handler
    await handleResponse(response);
    
    const seats = await response.json();
    return seats;
  } catch (error) {
    console.error('Error fetching seat chart data:', error);
    
    // If token expired, re-throw the error to be handled by the auth context
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    
    // If authentication is required, throw the error
    if (error.message === 'Authentication required') {
      throw error;
    }
    
    // Throw the error instead of falling back to mock data
    throw error;
  }
}

// Seat management functions
export async function addSeat(seatData) {
  try {
    const response = await fetch(`${API_BASE_URL}/seats`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(seatData),
    });

    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error adding seat:', error);
    throw error;
  }
}

export async function updateSeat(seatNumber, updateData) {
  try {
    const response = await fetch(`${API_BASE_URL}/seats/${seatNumber}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error updating seat:', error);
    throw error;
  }
}

export async function removeSeat(seatNumber, modifiedBy) {
  try {
    const response = await fetch(`${API_BASE_URL}/seats/${seatNumber}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ modified_by: modifiedBy }),
    });

    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error removing seat:', error);
    throw error;
  }
}

// Student management functions
export async function getStudents() {
  try {
    const response = await fetch(`${API_BASE_URL}/students`, {
      headers: getAuthHeaders()
    });
    
    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
}

export async function addStudent(studentData) {
  try {
    const response = await fetch(`${API_BASE_URL}/students`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(studentData),
    });

    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error adding student:', error);
    throw error;
  }
}

// Payment management functions
export async function getPayments() {
  try {
    const response = await fetch(`${API_BASE_URL}/payments`, {
      headers: getAuthHeaders()
    });
    
    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }
}

export async function addPayment(paymentData) {
  try {
    const response = await fetch(`${API_BASE_URL}/payments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(paymentData),
    });

    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error adding payment:', error);
    throw error;
  }
}

// Expense management functions
export async function getExpenses() {
  try {
    const response = await fetch(`${API_BASE_URL}/expenses`, {
      headers: getAuthHeaders()
    });
    
    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }
}

export async function addExpense(expenseData) {
  try {
    const response = await fetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(expenseData),
    });

    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
}

// Mark expired seat as vacant
export async function markSeatAsVacant(seatNumber) {
  try {
    const response = await fetch(`${API_BASE_URL}/seats/${seatNumber}/mark-vacant`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        modified_by: 1 // TODO: Get actual user ID from auth context
      }),
    });

    await handleResponse(response);
    return await response.json();
  } catch (error) {
    console.error('Error marking seat as vacant:', error);
    throw error;
  }
}

// Provide a default export for modules that import the legacy default `api`
const apiDefault = {
  setTokenExpirationHandler,
  getSeatChartData,
  addSeat,
  updateSeat,
  removeSeat,
  getStudents,
  addStudent,
  getPayments,
  addPayment,
  getExpenses,
  addExpense,
  markSeatAsVacant
};

export default apiDefault;