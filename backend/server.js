const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { pool } = require('./config/database');
const logger = require('./utils/logger');
const { requestLoggingMiddleware, errorLoggingMiddleware } = require('./middleware/logging');
const metabaseService = require('./services/metabaseService');
const constants = require('./config/constants');

// Import routes
const seatRoutes = require('./routes/seats');
const studentRoutes = require('./routes/students');
const paymentRoutes = require('./routes/payments');
const expenseRoutes = require('./routes/expenses');
const financeRoutes = require('./routes/finance');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const reportsRoutes = require('./routes/reports');
const auth = require('./middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || constants.DEFAULT_PORT;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || constants.DEFAULT_CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());

// Attach request logging middleware early
app.use(requestLoggingMiddleware);

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
app.use('/api/finance', auth, financeRoutes);
app.use('/api/reports', auth, reportsRoutes);

// Public endpoint for frontend to fetch expense categories (protected)
app.get('/api/expense-categories', auth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name, description FROM expense_categories ORDER BY name`);
    res.json({ categories: result.rows });
  } catch (err) {
    logger.error('Error fetching expense categories', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to fetch expense categories' });
  }
});

// Error handling middleware
// Use enhanced error logging middleware
app.use(errorLoggingMiddleware);


// Fallback: serve frontend for any non-API route
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
  const logger = require('./utils/logger');
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize Metabase service
  try {
    const metabaseInitialized = await metabaseService.initialize();
    if (metabaseInitialized) {
      logger.info('Metabase service initialized successfully');
    } else {
      logger.warn('Metabase service initialization failed - reports and charts may be limited');
    }
  } catch (error) {
    logger.warn('Failed to initialize Metabase service', { error: error.message });
  }
});

module.exports = app;
