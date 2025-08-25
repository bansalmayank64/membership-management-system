const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { pool } = require('./config/database');

// Import routes
const seatRoutes = require('./routes/seats');
const studentRoutes = require('./routes/students');
const paymentRoutes = require('./routes/payments');
const expenseRoutes = require('./routes/expenses');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const auth = require('./middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Serve static frontend files
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Study Room Management API is running' });
});

// Test database connection endpoint
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ 
      status: 'Database connected successfully', 
      timestamp: result.rows[0].current_time 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Database connection failed', 
      error: error.message 
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', auth, adminRoutes);
app.use('/api/seats', auth, seatRoutes);
app.use('/api/students', auth, studentRoutes);
app.use('/api/payments', auth, paymentRoutes);
app.use('/api/expenses', auth, expenseRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
  });
});


// Fallback: serve frontend for any non-API route
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
