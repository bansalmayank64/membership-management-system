const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  const requestId = `auth-login-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🔐 [${new Date().toISOString()}] Starting POST /api/auth/login [${requestId}]`);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    const { username, password } = req.body;
    console.log(`📊 Login attempt for username: "${username}"`);
    
    console.log(`🔍 Step 1: Validating input parameters...`);
    if (!username || !password) {
      console.log(`❌ Validation failed: Username or password missing`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/auth/login completed with 400 in ${totalTime}ms [${requestId}]`);
      
      return res.status(400).json({ 
        error: 'Username and password are required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Searching for user in database...`);
    const query = 'SELECT * FROM users WHERE username = $1';
    const queryStart = Date.now();
    const result = await pool.query(query, [username]);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ User query executed in ${queryTime}ms, found ${result.rows.length} users`);
    
    if (result.rows.length === 0) {
      console.log(`❌ User not found: ${username}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/auth/login completed with 401 in ${totalTime}ms [${requestId}]`);
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const user = result.rows[0];
    console.log(`👤 Found user: ID=${user.id}, Role=${user.role}, Username=${user.username}`);
    
    console.log(`🔧 Step 3: Verifying password...`);
    const passwordStart = Date.now();
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    const passwordTime = Date.now() - passwordStart;
    
    console.log(`✅ Password verification completed in ${passwordTime}ms, result: ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      console.log(`❌ Invalid password for user: ${username}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/auth/login completed with 401 in ${totalTime}ms [${requestId}]`);
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🎫 Step 4: Generating JWT token...`);
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
    
    console.log(`✅ JWT token generated in ${tokenTime}ms`);
    console.log(`🎉 Login successful for user: ${username} (ID: ${user.id})`);
    console.log(`🎯 [${new Date().toISOString()}] POST /api/auth/login completed successfully in ${totalTime}ms [${requestId}]`);
    
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
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] POST /api/auth/login FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      username: req.body.username
    });
    
    res.status(500).json({ 
      error: 'Login failed',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auth/register - User registration (admin only)
router.post('/register', async (req, res) => {
  const requestId = `auth-register-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🔐➕ [${new Date().toISOString()}] Starting POST /api/auth/register [${requestId}]`);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    const { username, password, role = 'user', permissions = {} } = req.body;
    console.log(`📊 Registration attempt: username="${username}", role="${role}"`);
    
    console.log(`🔍 Step 1: Validating input parameters with security constraints...`);
    if (!username || !password) {
      console.log(`❌ Validation failed: Username or password missing`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/auth/register completed with 400 in ${totalTime}ms [${requestId}]`);
      
      return res.status(400).json({ 
        error: 'Username and password are required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
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
      console.log(`❌ Validation failed:`, validationErrors);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/auth/register completed with 400 in ${totalTime}ms [${requestId}]`);
      
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🔍 Step 2: Checking if user already exists...`);
    const existingUserQuery = 'SELECT id FROM users WHERE username = $1';
    const queryStart = Date.now();
    const existingUser = await pool.query(existingUserQuery, [username]);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ User existence check completed in ${queryTime}ms, found ${existingUser.rows.length} users`);
    
    if (existingUser.rows.length > 0) {
      console.log(`❌ Username already exists: ${username}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/auth/register completed with 409 in ${totalTime}ms [${requestId}]`);
      
      return res.status(409).json({ 
        error: 'Username already exists',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🔐 Step 3: Hashing password...`);
    const saltRounds = 12;
    const hashStart = Date.now();
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const hashTime = Date.now() - hashStart;
    
    console.log(`✅ Password hashed in ${hashTime}ms with ${saltRounds} salt rounds`);
    
    console.log(`📝 Step 4: Creating user in database...`);
    const createUserQuery = `
      INSERT INTO users (username, password_hash, role, permissions, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, username, role, permissions, created_at
    `;
    
    const insertStart = Date.now();
    const result = await pool.query(createUserQuery, [username, passwordHash, role, JSON.stringify(permissions)]);
    const insertTime = Date.now() - insertStart;
    const newUser = result.rows[0];
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ User created successfully in ${insertTime}ms`);
    console.log(`👤 New user details: ID=${newUser.id}, Username=${newUser.username}, Role=${newUser.role}`);
    console.log(`🎯 [${new Date().toISOString()}] POST /api/auth/register completed successfully in ${totalTime}ms [${requestId}]`);
    
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
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] POST /api/auth/register FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint,
      username: req.body.username,
      role: req.body.role
    });
    
    res.status(500).json({ 
      error: 'Registration failed',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const requestId = `auth-verify-${Date.now()}`;
  const startTime = Date.now();
  
  console.log(`🔐🔍 [${new Date().toISOString()}] Starting token authentication [${requestId}]`);
  console.log(`📝 Path: ${req.path}, Method: ${req.method}, IP: ${req.ip}`);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  console.log(`🎫 Step 1: Checking for authorization token...`);
  if (!token) {
    console.log(`❌ No token provided in authorization header`);
    const totalTime = Date.now() - startTime;
    console.log(`🎯 [${new Date().toISOString()}] Token authentication completed with 401 in ${totalTime}ms [${requestId}]`);
    
    return res.status(401).json({ 
      error: 'Access token is required',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
  
  console.log(`🔧 Step 2: Verifying JWT token...`);
  const verifyStart = Date.now();
  
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    const verifyTime = Date.now() - verifyStart;
    
    if (err) {
      console.log(`❌ JWT verification failed in ${verifyTime}ms:`, err.message);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] Token authentication completed with 403 in ${totalTime}ms [${requestId}]`);
      
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`✅ JWT verified successfully in ${verifyTime}ms for user ID: ${decoded.userId}`);
    
    console.log(`📝 Step 3: Fetching latest user data...`);
    try {
      const userQuery = 'SELECT id, username, role, permissions FROM users WHERE id = $1';
      const userStart = Date.now();
      const userResult = await pool.query(userQuery, [decoded.userId]);
      const userTime = Date.now() - userStart;
      
      console.log(`✅ User data fetched in ${userTime}ms, found ${userResult.rows.length} users`);
      
      if (userResult.rows.length === 0) {
        console.log(`❌ User not found in database: ID=${decoded.userId}`);
        const totalTime = Date.now() - startTime;
        console.log(`🎯 [${new Date().toISOString()}] Token authentication completed with 403 in ${totalTime}ms [${requestId}]`);
        
        return res.status(403).json({ 
          error: 'User not found',
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      const user = userResult.rows[0];
      req.user = {
        ...decoded,
        role: user.role,
        permissions: user.permissions
      };
      
      const totalTime = Date.now() - startTime;
      console.log(`👤 Authentication successful for: ${user.username} (ID: ${user.id}, Role: ${user.role})`);
      console.log(`🎯 [${new Date().toISOString()}] Token authentication completed successfully in ${totalTime}ms [${requestId}]`);
      
      next();
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [${new Date().toISOString()}] Token authentication FAILED after ${totalTime}ms [${requestId}]`);
      console.error(`💥 Database error:`, {
        message: error.message,
        stack: error.stack,
        code: error.code,
        userId: decoded.userId
      });
      
      return res.status(500).json({ 
        error: 'Authentication failed',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
  });
};

// GET /api/auth/verify - Verify token validity
router.get('/verify', authenticateToken, (req, res) => {
  const requestId = `auth-verify-endpoint-${Date.now()}`;
  const startTime = Date.now();
  
  console.log(`🔐✅ [${new Date().toISOString()}] Starting GET /api/auth/verify [${requestId}]`);
  console.log(`👤 Verified user: ${req.user.username} (ID: ${req.user.userId}, Role: ${req.user.role})`);
  
  const totalTime = Date.now() - startTime;
  console.log(`🎯 [${new Date().toISOString()}] GET /api/auth/verify completed successfully in ${totalTime}ms [${requestId}]`);
  
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
    console.log(`🔐👥 [${new Date().toISOString()}] Starting GET /api/auth/users [${requestId}]`);
    console.log(`👤 Requested by: ${req.user.username} (ID: ${req.user.userId}, Role: ${req.user.role})`);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`📝 Step 1: Preparing users query...`);
    const query = "SELECT id, username, role, permissions, created_at FROM users WHERE status = 'active' ORDER BY created_at DESC";

    console.log(`🔧 Step 2: Executing users query...`);
    const queryStart = Date.now();
    const result = await pool.query(query);
    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Users query executed successfully in ${queryTime}ms`);
    console.log(`📊 Found ${result.rows.length} users`);
    console.log(`👥 User summary:`, result.rows.map(u => ({ id: u.id, username: u.username, role: u.role })));
    console.log(`🎯 [${new Date().toISOString()}] GET /api/auth/users completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/auth/users FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      requestedBy: req.user.username
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch users',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
