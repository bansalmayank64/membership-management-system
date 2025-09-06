const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const auth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token is required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user's tokens have been blacklisted (logout functionality)
    try {
      const blacklistCheck = await pool.query(`
        SELECT blacklisted_at FROM token_blacklist 
        WHERE user_id = $1 AND blacklisted_at > to_timestamp($2)
      `, [decoded.userId, decoded.iat]);
      
      if (blacklistCheck.rows.length > 0) {
        return res.status(401).json({ error: 'Token has been invalidated. Please login again.' });
      }
    } catch (blacklistError) {
      // If token_blacklist table doesn't exist yet, continue normally
      // This handles the case before the table is created
      if (!blacklistError.message.includes('relation "token_blacklist" does not exist')) {
        console.error('Blacklist check error:', blacklistError);
      }
    }
    
    // Fetch latest user data to ensure permissions are current
    const userQuery = 'SELECT id, username, role, permissions FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    req.user = {
      ...decoded,
      role: userResult.rows[0].role,
      permissions: userResult.rows[0].permissions
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = auth;
