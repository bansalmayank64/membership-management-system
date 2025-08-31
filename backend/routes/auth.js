const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  const rl = require('../utils/logger').createRequestLogger('POST', '/api/auth/login', req);
  const startTime = Date.now();
  
  try {
    rl.requestStart(req);
    const { username, password } = req.body;
    rl.info('Login attempt', { username });
    rl.validationStart('Validating input parameters');
    if (!username || !password) {
      rl.validationError('credentials', ['Username or password missing']);
      return res.status(400).json({ error: 'Username and password are required', timestamp: new Date().toISOString() });
    }
    rl.businessLogic('Searching for user in database');
    const query = 'SELECT * FROM users WHERE username = $1';
    const queryStart = rl.queryStart('find user', query, [username]);
    const result = await pool.query(query, [username]);
    rl.querySuccess('find user', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('User not found', { username });
      return res.status(401).json({ error: 'Invalid credentials', timestamp: new Date().toISOString() });
    }

    const user = result.rows[0];
    rl.info('Found user', { id: user.id, username: user.username, role: user.role });
    
    rl.businessLogic('Verifying password');
    const passwordStart = Date.now();
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    rl.info('Password verification completed', { durationMs: Date.now() - passwordStart, valid: isPasswordValid });

    if (!isPasswordValid) {
      rl.warn('Invalid password', { username });
      return res.status(401).json({ error: 'Invalid credentials', timestamp: new Date().toISOString() });
    }
    
  rl.businessLogic('Generating JWT token');
  const tokenStart = Date.now();
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        role: user.role,
        permissions: user.permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const tokenTime = Date.now() - tokenStart;
    const totalTime = Date.now() - startTime;
    
  rl.info('JWT token generated', { durationMs: tokenTime });
  rl.success({ user: { id: user.id, username: user.username } });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    rl.error(error, { username: req.body?.username });
    res.status(500).json({ error: 'Login failed', timestamp: new Date().toISOString() });
  }
});

// POST /api/auth/register - User registration (admin only)
router.post('/register', async (req, res) => {
  const rl = require('../utils/logger').createRequestLogger('POST', '/api/auth/register', req);
  const startTime = Date.now();
  
  try {
    rl.requestStart(req);
    const { username, password, role = 'user', permissions = {} } = req.body;
    rl.info('Registration attempt', { username, role });
    rl.validationStart('Validating input parameters');
    if (!username || !password) {
      rl.validationError('credentials', ['Username or password missing']);
      return res.status(400).json({ error: 'Username and password are required', timestamp: new Date().toISOString() });
    }
    
    // Enhanced validation with database constraints
    const validationErrors = [];

    // Username validation - VARCHAR(50) UNIQUE NOT NULL
    if (typeof username !== 'string' || username.trim().length === 0) {
      validationErrors.push('Username must be a non-empty string');
    } else if (username.trim().length < 3) {
      validationErrors.push('Username must be at least 3 characters long');
    } else if (username.trim().length > 50) {
      validationErrors.push('Username must not exceed 50 characters (database constraint)');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      validationErrors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // Password validation
    if (typeof password !== 'string') {
      validationErrors.push('Password must be a string');
    } else if (password.length < 6) {
      validationErrors.push('Password must be at least 6 characters long');
    } else if (password.length > 255) {
      validationErrors.push('Password is too long (maximum 255 characters)');
    }

    // Role validation - CHECK (role IN ('user', 'admin'))
    if (role && !['user', 'admin'].includes(role)) {
      validationErrors.push('Role must be either "user" or "admin" (database constraint)');
    }

    // Permissions validation - JSONB
    if (permissions && (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))) {
      validationErrors.push('Permissions must be a valid JSON object');
    }

    if (validationErrors.length > 0) {
      rl.validationError('register', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, timestamp: new Date().toISOString() });
    }

    rl.businessLogic('Checking if user already exists');
    const existingUserQuery = 'SELECT id FROM users WHERE username = $1';
    const queryStart = rl.queryStart('check user exists', existingUserQuery, [username]);
    const existingUser = await pool.query(existingUserQuery, [username]);
    rl.querySuccess('check user exists', queryStart, existingUser, true);

    if (existingUser.rows.length > 0) {
      rl.warn('Username already exists', { username });
      return res.status(409).json({ error: 'Username already exists', timestamp: new Date().toISOString() });
    }
    
  rl.businessLogic('Hashing password and creating user');
  const saltRounds = 12;
  const hashStart = Date.now();
  const passwordHash = await bcrypt.hash(password, saltRounds);
  rl.info('Password hashed', { durationMs: Date.now() - hashStart, saltRounds });
  rl.businessLogic('Creating user in database');
    const createUserQuery = `
      INSERT INTO users (username, password_hash, role, permissions, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, username, role, permissions, created_at
    `;
    
  const insertStart = rl.queryStart('insert user', createUserQuery, [username, '[REDACTED]', role, '[REDACTED]']);
  const result = await pool.query(createUserQuery, [username, passwordHash, role, JSON.stringify(permissions)]);
  rl.querySuccess('insert user', insertStart, result, true);
  const newUser = result.rows[0];
  rl.success({ user: { id: newUser.id, username: newUser.username, role: newUser.role } });
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        permissions: newUser.permissions,
        created_at: newUser.created_at
      }
    });
  } catch (error) {
    rl.error(error, { username: req.body?.username, role: req.body?.role });
    res.status(500).json({ error: 'Registration failed', timestamp: new Date().toISOString() });
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const startTime = Date.now();
  const rl = require('../utils/logger').createRequestLogger('AUTH', 'authenticateToken', req);
  rl.requestStart(req);
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  rl.businessLogic('Checking for authorization token');
  if (!token) {
    rl.validationError('token', ['No token provided']);
    return res.status(401).json({ error: 'Access token is required', timestamp: new Date().toISOString() });
  }
  rl.businessLogic('Verifying JWT token');
  const verifyStart = Date.now();
  
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    const verifyTime = Date.now() - verifyStart;
    
    if (err) {
      rl.warn('JWT verification failed', { message: err.message });
      return res.status(403).json({ error: 'Invalid or expired token', timestamp: new Date().toISOString() });
    }
    rl.info('JWT verified', { durationMs: verifyTime, userId: decoded.userId });
    rl.businessLogic('Fetching latest user data');
    try {
      const userQuery = 'SELECT id, username, role, permissions FROM users WHERE id = $1';
      const userStart = rl.queryStart('fetch user', userQuery, [decoded.userId]);
      const userResult = await pool.query(userQuery, [decoded.userId]);
      rl.querySuccess('fetch user', userStart, userResult, true);

      if (userResult.rows.length === 0) {
        rl.warn('User not found for token', { userId: decoded.userId });
        return res.status(403).json({ error: 'User not found', timestamp: new Date().toISOString() });
      }

      const user = userResult.rows[0];
      req.user = { ...decoded, role: user.role, permissions: user.permissions };
      rl.success({ user: { id: user.id, username: user.username, role: user.role } });
      next();
    } catch (error) {
      rl.error(error, { userId: decoded.userId });
      return res.status(500).json({ error: 'Authentication failed', timestamp: new Date().toISOString() });
    }
  });
};

// GET /api/auth/verify - Verify token validity
router.get('/verify', authenticateToken, (req, res) => {
  const requestId = `auth-verify-endpoint-${Date.now()}`;
  const startTime = Date.now();
  rl = require('../utils/logger').createRequestLogger('GET', '/api/auth/verify', req);
  rl.requestStart(req);
  rl.info('Verified user', { id: req.user.userId, username: req.user.username, role: req.user.role });
  
  res.json({
    valid: true,
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role,
      permissions: req.user.permissions
    }
  });
});

// GET /api/auth/users - Get all users (protected route)
router.get('/users', authenticateToken, async (req, res) => {
  const requestId = `auth-users-${Date.now()}`;
  const startTime = Date.now();
  
  try {
  const rl = require('../utils/logger').createRequestLogger('GET', '/api/auth/users', req);
  rl.requestStart(req);
  rl.info('Get users requested', { requestedBy: req.user.username, userId: req.user.userId });
  rl.businessLogic('Preparing users query');
    const query = "SELECT id, username, role, permissions, created_at FROM users WHERE status = 'active' ORDER BY created_at DESC";
  const queryStart = rl.queryStart('users list', query);
  const result = await pool.query(query);
  rl.querySuccess('users list', queryStart, result, true);
  rl.success({ count: result.rows.length });
  res.json(result.rows);
  } catch (error) {
  rl.error(error, { requestedBy: req.user.username });
  res.status(500).json({ error: 'Failed to fetch users', timestamp: new Date().toISOString() });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
