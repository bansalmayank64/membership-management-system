// API Base URL - Update this to your backend URL when deployed
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper function to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

// Fetch seat chart data from PostgreSQL backend
export async function getSeatChartData() {
  try {
    const response = await fetch(`${API_BASE_URL}/seats`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const seats = await response.json();
    return seats;
  } catch (error) {
    console.error('Error fetching seat chart data:', error);
    
    // If authentication is required, throw the error
    if (error.message === 'Authentication required') {
      throw error;
    }
    
    // Fallback to mock data if backend is not available
    return getMockSeatData();
  }
}

// Mock data fallback function
function getMockSeatData() {
  const seats = [];
  const totalSeats = 48;
  
  const studentNames = [
    { name: 'Amit Kumar', gender: 'male' },
    { name: 'Priya Sharma', gender: 'female' },
    { name: 'Rahul Singh', gender: 'male' },
    { name: 'Sara Khan', gender: 'female' },
    { name: 'Vikas Gupta', gender: 'male' },
    { name: 'Neha Patel', gender: 'female' },
    { name: 'Ravi Yadav', gender: 'male' },
    { name: 'Pooja Jain', gender: 'female' },
    { name: 'Suresh Kumar', gender: 'male' },
    { name: 'Kavya Nair', gender: 'female' },
    { name: 'Arjun Mehta', gender: 'male' },
    { name: 'Divya Agarwal', gender: 'female' },
    { name: 'Kiran Verma', gender: 'male' },
    { name: 'Sneha Reddy', gender: 'female' },
    { name: 'Vijay Shah', gender: 'male' },
    { name: 'Meera Joshi', gender: 'female' },
    { name: 'Deepak Tiwari', gender: 'male' },
    { name: 'Ritika Malhotra', gender: 'female' },
    { name: 'Ankit Saxena', gender: 'male' },
    { name: 'Preeti Mishra', gender: 'female' },
    { name: 'Rohit Pandey', gender: 'male' },
    { name: 'Shweta Kapoor', gender: 'female' },
    { name: 'Manoj Sinha', gender: 'male' },
    { name: 'Anjali Thakur', gender: 'female' },
    { name: 'Sanjay Dubey', gender: 'male' }
  ];

  for (let seatNum = 1; seatNum <= totalSeats; seatNum++) {
    const isOccupied = Math.random() > 0.3;
    const isExpiring = isOccupied && Math.random() > 0.8;
    const isRemoved = Math.random() > 0.95;
    const selectedStudent = isOccupied && !isRemoved ? studentNames[Math.floor(Math.random() * studentNames.length)] : null;
    
    seats.push({
      seatNumber: seatNum,
      occupied: isOccupied && !isRemoved,
      studentName: selectedStudent ? selectedStudent.name : null,
      gender: selectedStudent ? selectedStudent.gender : null,
      expiring: isExpiring && !isRemoved,
      removed: isRemoved,
      studentId: isOccupied && !isRemoved ? `STU${seatNum.toString().padStart(3, '0')}` : null,
      membershipExpiry: isOccupied && !isRemoved ? new Date(Date.now() + (isExpiring ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
      contactNumber: isOccupied && !isRemoved ? `+91 ${Math.floor(Math.random() * 900000000) + 100000000}` : null,
      lastPayment: isOccupied && !isRemoved ? new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null
    });
  }

  return seats;
}

// Seat management functions
export async function addSeat(seatData) {
  try {
    const response = await fetch(`${API_BASE_URL}/seats`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(seatData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error marking seat as vacant:', error);
    throw error;
  }
}