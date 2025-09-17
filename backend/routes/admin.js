
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { formatDateForFilenameInTZ } = require('../utils/dateUtils');

const router = express.Router();
// Activity routes
const activityRoutes = require('./activity');

// Helper to format worksheet columns
function autoFitColumns(worksheet, data) {
  const objectMaxLength = [];
  data.forEach(row => {
    Object.values(row).forEach((val, idx) => {
      const len = val ? val.toString().length : 0;
      objectMaxLength[idx] = Math.max(objectMaxLength[idx] || 10, len + 2);
    });
  });
  worksheet['!cols'] = objectMaxLength.map(w => ({ wch: w }));
}

// Middleware to check admin permissions
const requireAdmin = (req, res, next) => {
  const requestId = `admin-auth-${Date.now()}`;
  logger.info(`Checking admin permissions`, { requestId, user: req.user?.username });
  if (req.user && (req.user.role === 'admin' || req.user.permissions?.canManageUsers)) {
    logger.info(`Admin access granted`, { requestId, user: req.user?.username });
    next();
  } else {
    logger.warn('Admin access denied', { requestId, user: req.user?.username || 'anonymous' });
    res.status(403).json({ error: 'Admin access required', requestId: requestId, timestamp: new Date().toISOString() });
  }
};

router.get('/full-report', auth, async (req, res) => {
  try {
  const requestId = `admin-full-report-${Date.now()}`;
  logger.info('Starting full-report', { requestId, user: req.user?.username });

  // Get all table names from the database metadata
  const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const sheets = {};
    
    // Export all tables dynamically
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      try {
    logger.info('Exporting table', { requestId, table: tableName });
        
        // Check if table has an 'id' column for ordering
        const columnsResult = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public' AND column_name = 'id'
        `, [tableName]);
        
        let orderClause = '';
        if (columnsResult.rows.length > 0) {
          orderClause = ' ORDER BY id';
        }
        
        const tableData = await pool.query(`SELECT * FROM ${tableName}${orderClause}`);
        
        if (tableData.rows.length > 0) {
          // Capitalize first letter for sheet name and make it readable
          const sheetName = tableName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          sheets[sheetName] = tableData.rows;
          logger.info('Exported table rows', { requestId, table: tableName, rows: tableData.rows.length });
        }
      } catch (tableError) {
        logger.warn('Failed to export table', { requestId, table: tableName, error: tableError.message });
        // Continue with other tables even if one fails
      }
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    for (const [sheetName, data] of Object.entries(sheets)) {
      const ws = XLSX.utils.json_to_sheet(data);
      autoFitColumns(ws, data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Write workbook to buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="full-data-report-${formatDateForFilenameInTZ()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    logger.error('Full report error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ...existing code...
// Backup/Restore/Import/Export/Clean routes are implemented in a separate module for clarity
// We'll register them below after configuring upload and required dependencies.

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx or .json files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Register extracted admin import/export/backup/restore/clean routes
const registerAdminImports = require('./admin_imports');
registerAdminImports(router, { pool, upload, auth, requireAdmin, XLSX, xlsx, logger });

// ...existing code...





// Import/export/backup/restore/clean routes moved to `admin_imports.js` and registered above

// Get all users
router.get('/users', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, role, permissions, created_at
      FROM users
      WHERE status = 'active'
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching users', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user
router.put('/users/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, password, role, permissions } = req.body;

  try {
    let query = `
      UPDATE users 
      SET username = $1, role = $2, permissions = $3, updated_at = CURRENT_TIMESTAMP
    `;
    let params = [username, role, JSON.stringify(permissions)];

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
  // store hashed password in the password_hash column
  query += `, password_hash = $${params.length + 1}`;
      params.push(hashedPassword);
    }

    query += ` WHERE id = $${params.length + 1} RETURNING id, username, role, permissions`;
    params.push(id);

    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
  logger.error('Error updating user', { error: error.message, stack: error.stack, userId: id });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Prevent deletion of admin user
    const userCheck = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userCheck.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin user' });
    }

    // Set students.modified_by = NULL for all students referencing this user
    // await pool.query('UPDATE students SET modified_by = NULL WHERE modified_by = $1', [id]);

    const result = await pool.query('UPDATE users SET status = $2, updated_at = CURRENT_TIMESTAMP, password_hash = $3 WHERE id = $1 RETURNING id', [id, 'inactive', 'ajshakshkahskdcdscdsc']);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User marked as inactive' });
  } catch (error) {
  logger.error('Error deleting user', { error: error.message, stack: error.stack, userId: id });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Logout specific user (invalidate all their tokens)
router.post('/users/:id/logout', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const username = userCheck.rows[0].username;

    // Add user to blacklist with current timestamp
    // All tokens issued before this timestamp will be considered invalid
    const blacklistResult = await pool.query(`
      INSERT INTO token_blacklist (user_id, username, blacklisted_by, reason)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        blacklisted_at = CURRENT_TIMESTAMP,
        blacklisted_by = $3,
        reason = $4
      RETURNING blacklisted_at
    `, [id, username, req.user.userId || req.user.id, 'Admin logout']);

    const blacklistedAt = blacklistResult.rows[0].blacklisted_at;

    // Log the logout action
    await pool.query(`
      INSERT INTO activity_logs (
        actor_user_id, actor_username, action_type, action_description, 
        subject_type, subject_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      req.user.userId || req.user.id,
      req.user.username,
      'user_logout',
      `Admin logged out user: ${username}`,
      'user',
      id,
      JSON.stringify({ target_username: username })
    ]);

    res.json({ 
      message: `User ${username} has been logged out successfully`,
      username: username,
      loggedOutAt: blacklistedAt
    });

  } catch (error) {
    logger.error('Error logging out user', { error: error.message, stack: error.stack, userId: id });
    res.status(500).json({ error: 'Failed to logout user' });
  }
});

// Get user session status
router.get('/users/:id/session-status', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user exists
    const userCheck = await pool.query(`
      SELECT id, username, status, created_at, updated_at 
      FROM users WHERE id = $1
    `, [id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userCheck.rows[0];

    // Check blacklist status
    let sessionStatus = 'active';
    let blacklistInfo = null;

    try {
      const blacklistCheck = await pool.query(`
        SELECT 
          tb.blacklisted_at,
          tb.reason,
          u.username as blacklisted_by_username
        FROM token_blacklist tb
        LEFT JOIN users u ON tb.blacklisted_by = u.id
        WHERE tb.user_id = $1
      `, [id]);

      if (blacklistCheck.rows.length > 0) {
        sessionStatus = 'logged_out';
        blacklistInfo = blacklistCheck.rows[0];
      }
    } catch (blacklistError) {
      // If token_blacklist table doesn't exist, session is active
      if (!blacklistError.message.includes('relation "token_blacklist" does not exist')) {
        throw blacklistError;
      }
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      session_status: sessionStatus,
      blacklist_info: blacklistInfo
    });

  } catch (error) {
    logger.error('Error getting user session status', { error: error.message, stack: error.stack, userId: id });
    res.status(500).json({ error: 'Failed to get user session status' });
  }
});

// Restore user access (remove from blacklist)
router.post('/users/:id/restore-access', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const username = userCheck.rows[0].username;

    // Remove user from blacklist
    const removeResult = await pool.query(`
      DELETE FROM token_blacklist WHERE user_id = $1 RETURNING *
    `, [id]);

    if (removeResult.rows.length === 0) {
      return res.status(400).json({ error: 'User was not logged out or blacklist entry not found' });
    }

    // Log the restore action
    await pool.query(`
      INSERT INTO activity_logs (
        actor_user_id, actor_username, action_type, action_description, 
        subject_type, subject_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      req.user.userId || req.user.id,
      req.user.username,
      'user_access_restored',
      `Admin restored access for user: ${username}`,
      'user',
      id,
      JSON.stringify({ target_username: username })
    ]);

    res.json({ 
      message: `Access restored for user ${username}. They can now login with new tokens.`,
      username: username,
      restoredAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error restoring user access', { error: error.message, stack: error.stack, userId: id });
    res.status(500).json({ error: 'Failed to restore user access' });
  }
});

// Get all blacklisted users
router.get('/blacklisted-users', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        tb.id,
        tb.user_id,
        tb.username,
        tb.blacklisted_at,
        tb.reason,
        u1.username as blacklisted_by_username,
        u2.status as user_status
      FROM token_blacklist tb
      LEFT JOIN users u1 ON tb.blacklisted_by = u1.id
      LEFT JOIN users u2 ON tb.user_id = u2.id
      ORDER BY tb.blacklisted_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    // If table doesn't exist, return empty array
    if (error.message.includes('relation "token_blacklist" does not exist')) {
      return res.json([]);
    }
    logger.error('Error fetching blacklisted users', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch blacklisted users' });
  }
});

// Clean up old blacklist entries (optional maintenance endpoint)
router.delete('/blacklist/cleanup', auth, requireAdmin, async (req, res) => {
  const { days = 30 } = req.query; // Default cleanup entries older than 30 days

  try {
    const result = await pool.query(`
      DELETE FROM token_blacklist 
      WHERE blacklisted_at < NOW() - INTERVAL '${parseInt(days)} days'
      RETURNING *
    `);

    // Log the cleanup action
    await pool.query(`
      INSERT INTO activity_logs (
        actor_user_id, actor_username, action_type, action_description, metadata
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      req.user.userId || req.user.id,
      req.user.username,
      'blacklist_cleanup',
      `Cleaned up blacklist entries older than ${days} days`,
      JSON.stringify({ days_threshold: parseInt(days), entries_removed: result.rowCount })
    ]);

    res.json({
      message: `Cleaned up ${result.rowCount} blacklist entries older than ${days} days`,
      entriesRemoved: result.rowCount,
      daysThreshold: parseInt(days)
    });

  } catch (error) {
    if (error.message.includes('relation "token_blacklist" does not exist')) {
      return res.json({ message: 'No blacklist table found - nothing to clean up', entriesRemoved: 0 });
    }
    logger.error('Error cleaning up blacklist', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to cleanup blacklist entries' });
  }
});


// Get system statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM students'),
      pool.query('SELECT COUNT(*) as total FROM seats WHERE EXISTS (SELECT 1 FROM students WHERE students.seat_number = seats.seat_number)'),
      pool.query('SELECT COUNT(*) as total FROM payments'),
      pool.query('SELECT COUNT(*) as total FROM expenses'),
      pool.query("SELECT COUNT(*) as total FROM users WHERE status = 'active'"),
      pool.query('SELECT SUM(amount) as total FROM payments'),
      pool.query('SELECT SUM(amount) as total FROM expenses'),
      // Add expired students count - students whose membership_till date has passed
      pool.query("SELECT COUNT(*) as total FROM students WHERE membership_till < CURRENT_DATE"),
      // Add expiring soon students count - students whose membership expires in next 7 days
      pool.query("SELECT COUNT(*) as total FROM students WHERE membership_till >= CURRENT_DATE AND membership_till <= CURRENT_DATE + INTERVAL '7 days'"),
      // Add unassigned students count - students without seat assignment
      pool.query("SELECT COUNT(*) as total FROM students WHERE seat_number IS NULL")
    ]);

    res.json({
      students: parseInt(stats[0].rows[0].total),
      occupiedSeats: parseInt(stats[1].rows[0].total),
      payments: parseInt(stats[2].rows[0].total),
      expenses: parseInt(stats[3].rows[0].total),
      users: parseInt(stats[4].rows[0].total),
      totalRevenue: parseFloat(stats[5].rows[0].total || 0),
      totalExpenses: parseFloat(stats[6].rows[0].total || 0),
      expiredStudents: parseInt(stats[7].rows[0].total),
      expiringSoon: parseInt(stats[8].rows[0].total),
      unassignedStudents: parseInt(stats[9].rows[0].total)
    });
  } catch (error) {
    logger.error('Error fetching stats', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Expense categories management (admin only)
router.get('/expense-categories', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, created_at, updated_at
      FROM expense_categories
      ORDER BY name
    `);
    res.json({ categories: result.rows });
  } catch (error) {
    logger.error('Error fetching expense categories', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch expense categories' });
  }
});

router.post('/expense-categories', auth, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  try {
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });

    // Prevent duplicates
    const exists = await pool.query('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Category already exists' });

    const result = await pool.query(`
      INSERT INTO expense_categories (name, description, created_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [name.trim(), description || null]);
    // Log category creation
    try {
      await pool.query(`
        INSERT INTO activity_logs (actor_user_id, actor_username, action_type, action_description, subject_type, subject_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user.userId || req.user.id,
        req.user.username,
        'expense_category_create',
        `Created expense category ${result.rows[0].id}`,
        'expense_category',
        result.rows[0].id,
        JSON.stringify(result.rows[0])
      ]);
    } catch (logErr) {
      logger.error('Failed to write activity log for category create', { error: logErr.message });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating expense category', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to create expense category' });
  }
});

router.put('/expense-categories/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });

    // Prevent renaming to an existing name
    const exists = await pool.query('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER($1) AND id <> $2', [name.trim(), id]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Another category with this name already exists' });

    const result = await pool.query(`
      UPDATE expense_categories
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [name.trim(), description || null, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    // Log category update
    try {
      await pool.query(`
        INSERT INTO activity_logs (actor_user_id, actor_username, action_type, action_description, subject_type, subject_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user.userId || req.user.id,
        req.user.username,
        'expense_category_update',
        `Updated expense category ${result.rows[0].id}`,
        'expense_category',
        result.rows[0].id,
        JSON.stringify(result.rows[0])
      ]);
    } catch (logErr) {
      logger.error('Failed to write activity log for category update', { error: logErr.message });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating expense category', { error: error.message, stack: error.stack, id });
    res.status(500).json({ error: 'Failed to update expense category' });
  }
});

router.delete('/expense-categories/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Prevent deletion if used in expenses
    const usage = await pool.query('SELECT COUNT(*)::int as cnt FROM expenses WHERE expense_category_id = $1', [id]);
    if (usage.rows[0].cnt > 0) {
      return res.status(400).json({ error: 'Cannot delete category - it is referenced by existing expenses' });
    }

    const result = await pool.query('DELETE FROM expense_categories WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    // Log category deletion
    try {
      await pool.query(`
        INSERT INTO activity_logs (actor_user_id, actor_username, action_type, action_description, subject_type, subject_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user.userId || req.user.id,
        req.user.username,
        'expense_category_delete',
        `Deleted expense category ${result.rows[0].id}`,
        'expense_category',
        result.rows[0].id,
        JSON.stringify(result.rows[0])
      ]);
    } catch (logErr) {
      logger.error('Failed to write activity log for category delete', { error: logErr.message });
    }

    res.json({ message: 'Category deleted', deleted: result.rows[0] });
  } catch (error) {
    logger.error('Error deleting expense category', { error: error.message, stack: error.stack, id });
    res.status(500).json({ error: 'Failed to delete expense category' });
  }
});

// Add new seat
router.post('/seats', auth, requireAdmin, async (req, res) => {
  const { seatNumber, occupantSex } = req.body;

  try {
    if (!seatNumber || seatNumber.trim() === '') {
      return res.status(400).json({ error: 'Seat number is required' });
    }

    const result = await pool.query(`
      INSERT INTO seats (seat_number, occupant_sex, modified_by, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [seatNumber.trim(), occupantSex || null, req.user.userId || req.user.id || 1]);

    res.json(result.rows[0]);
    } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Seat number already exists' });
    }
    logger.error('Error adding seat', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to add seat' });
  }
});

// Update seat
router.put('/seats/:seatNumber', auth, requireAdmin, async (req, res) => {
  const { seatNumber } = req.params;
  const { occupantSex, status } = req.body;

  try {
    // First check if seat exists and if it's occupied
    const seatCheck = await pool.query(`
      SELECT 
        s.seat_number,
        s.occupant_sex,
        st.id as student_id,
        st.name as student_name,
        st.sex as student_gender
      FROM seats s
      LEFT JOIN students st ON s.seat_number = st.seat_number
      WHERE s.seat_number = $1
    `, [seatNumber]);

    if (seatCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    const seat = seatCheck.rows[0];
    
    // If seat is occupied and we're trying to change gender restriction
    if (seat.student_id && occupantSex && seat.student_gender && occupantSex !== seat.student_gender) {
      return res.status(400).json({ 
        error: `Cannot change gender restriction to "${occupantSex}" - seat is occupied by a ${seat.student_gender} student (${seat.student_name})` 
      });
    }

    const result = await pool.query(`
      UPDATE seats 
      SET occupant_sex = $1, modified_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE seat_number = $3
      RETURNING *
    `, [occupantSex || null, req.user.userId || req.user.id || 1, seatNumber]);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating seat', { error: error.message, stack: error.stack, seatNumber });
    res.status(500).json({ error: 'Failed to update seat' });
  }
});

// Delete seat
router.delete('/seats/:seatNumber', auth, requireAdmin, async (req, res) => {
  const { seatNumber } = req.params;

  try {
    // Check if seat exists and if it's occupied
    const seatCheck = await pool.query(
      'SELECT seat_number, (SELECT id FROM students WHERE seat_number = $1) as student_id FROM seats WHERE seat_number = $1',
      [seatNumber]
    );

    if (seatCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    if (seatCheck.rows[0].student_id) {
      return res.status(400).json({ 
        error: 'Cannot delete occupied seat. Please move the student first.' 
      });
    }

    const result = await pool.query(
      'DELETE FROM seats WHERE seat_number = $1 RETURNING seat_number',
      [seatNumber]
    );

    res.json({ message: 'Seat deleted successfully', seatNumber: result.rows[0].seat_number });
  } catch (error) {
    logger.error('Error deleting seat', { error: error.message, stack: error.stack, seatNumber });
    res.status(500).json({ error: 'Failed to delete seat' });
  }
});

// Get all seats with student info
router.get('/seats', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.seat_number,
        CASE 
          WHEN st.seat_number IS NOT NULL THEN 'occupied'
          ELSE 'available'
        END as status,
        s.occupant_sex,
        st.id as student_id,
        st.name as student_name,
        st.father_name,
        st.contact_number,
        st.membership_status,
        s.created_at,
        s.updated_at
      FROM seats s
      LEFT JOIN students st ON s.seat_number = st.seat_number
      ORDER BY 
        CASE 
          WHEN s.seat_number ~ '^[0-9]+$' THEN CAST(s.seat_number AS INTEGER)
          ELSE 999999 
        END ASC,
        s.seat_number ASC
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching seats', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

// Get fees configuration
router.get('/fees-config', auth, async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT * FROM student_fees_config 
  ORDER BY membership_type
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching fees config', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch fees configuration' });
  }
});

// Mount activity routes under /api/admin/activity
router.use('/activity', auth, requireAdmin, activityRoutes);

// Add new membership type
router.post('/fees-config', auth, requireAdmin, async (req, res) => {
  const { membership_type, male_monthly_fees, female_monthly_fees } = req.body;

  try {
    if (!membership_type || !membership_type.trim()) {
      return res.status(400).json({ error: 'Membership type is required' });
    }

    if ((male_monthly_fees === undefined || male_monthly_fees <= 0) || (female_monthly_fees === undefined || female_monthly_fees <= 0)) {
      return res.status(400).json({ error: 'Both male_monthly_fees and female_monthly_fees must be positive numbers' });
    }

    // Check if membership type already exists
    const existingResult = await pool.query(
      'SELECT id FROM student_fees_config WHERE membership_type = $1', 
      [membership_type.trim()]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Membership type already exists' });
    }

    // Insert new membership type
    const insertResult = await pool.query(`
      INSERT INTO student_fees_config (membership_type, male_monthly_fees, female_monthly_fees)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [membership_type.trim(), male_monthly_fees, female_monthly_fees]);
    
    res.json(insertResult.rows[0]);
  } catch (error) {
    logger.error('Error adding new membership type', { error: error.message, stack: error.stack, membership_type });
    res.status(500).json({ error: 'Failed to add new membership type' });
  }
});

// Update fees configuration by membership type
router.put('/fees-config/:membershipType', auth, requireAdmin, async (req, res) => {
  const { membershipType } = req.params;
  const { male_monthly_fees, female_monthly_fees } = req.body;

  try {
    if (!membershipType || !membershipType.trim()) {
      return res.status(400).json({ error: 'Invalid membershipType' });
    }

    if ((male_monthly_fees === undefined || male_monthly_fees <= 0) || (female_monthly_fees === undefined || female_monthly_fees <= 0)) {
      return res.status(400).json({ error: 'Both male_monthly_fees and female_monthly_fees must be positive numbers' });
    }

    const result = await pool.query(`
      UPDATE student_fees_config 
      SET male_monthly_fees = $1, female_monthly_fees = $2, updated_at = CURRENT_TIMESTAMP
      WHERE membership_type = $3
      RETURNING *
    `, [male_monthly_fees, female_monthly_fees, membershipType]);

    if (result.rows.length === 0) {
      // If no record exists, create one
      const insertResult = await pool.query(`
        INSERT INTO student_fees_config (membership_type, male_monthly_fees, female_monthly_fees)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [membershipType, male_monthly_fees, female_monthly_fees]);
      
      return res.json(insertResult.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating fees config', { error: error.message, stack: error.stack, membershipType });
    res.status(500).json({ error: 'Failed to update fees configuration' });
  }
});

// Delete membership type (protected route - cannot delete full_time)
router.delete('/fees-config/:membershipType', auth, requireAdmin, async (req, res) => {
  const { membershipType } = req.params;

  try {
    if (!membershipType || !membershipType.trim()) {
      return res.status(400).json({ error: 'Invalid membershipType' });
    }

    // Protect full_time membership type from deletion
    if (membershipType === 'full_time') {
      return res.status(403).json({ 
        error: 'Cannot delete the default full_time membership type',
        protected: true
      });
    }

    // Check if any students are using this membership type
    const studentsUsingType = await pool.query(
      'SELECT COUNT(*) as count FROM students WHERE membership_type = $1', 
      [membershipType]
    );

    const studentCount = parseInt(studentsUsingType.rows[0].count);
    
    if (studentCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete membership type. ${studentCount} student(s) are currently using this membership type.`,
        studentsCount: studentCount
      });
    }

    // Delete the membership type
    const result = await pool.query(
      'DELETE FROM student_fees_config WHERE membership_type = $1 RETURNING *', 
      [membershipType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Membership type not found' });
    }

    res.json({ 
      message: 'Membership type deleted successfully',
      deleted: result.rows[0]
    });

  } catch (error) {
    logger.error('Error deleting membership type', { error: error.message, stack: error.stack, membershipType });
    res.status(500).json({ error: 'Failed to delete membership type' });
  }
});

// Update membership type name (protected route - cannot rename full_time)
router.put('/fees-config/:membershipType/rename', auth, requireAdmin, async (req, res) => {
  const { membershipType } = req.params;
  const { new_membership_type } = req.body;

  try {
    if (!membershipType || !membershipType.trim()) {
      return res.status(400).json({ error: 'Invalid current membershipType' });
    }

    if (!new_membership_type || !new_membership_type.trim()) {
      return res.status(400).json({ error: 'New membership type name is required' });
    }

    // Protect full_time membership type from renaming
    if (membershipType === 'full_time') {
      return res.status(403).json({ 
        error: 'Cannot rename the default full_time membership type',
        protected: true
      });
    }

    const newName = new_membership_type.trim();

    // Check if new name already exists
    const existingCheck = await pool.query(
      'SELECT id FROM student_fees_config WHERE membership_type = $1', 
      [newName]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A membership type with this name already exists' });
    }

    // Start transaction to update both config and student records
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update the fees config table
      const configResult = await client.query(`
        UPDATE student_fees_config 
        SET membership_type = $1, updated_at = CURRENT_TIMESTAMP
        WHERE membership_type = $2
        RETURNING *
      `, [newName, membershipType]);

      if (configResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Membership type not found' });
      }

      // Update all students using this membership type
      const studentsResult = await client.query(
        'UPDATE students SET membership_type = $1 WHERE membership_type = $2',
        [newName, membershipType]
      );

      await client.query('COMMIT');

      res.json({
        message: 'Membership type renamed successfully',
        updated: configResult.rows[0],
        studentsUpdated: studentsResult.rowCount
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error renaming membership type', { error: error.message, stack: error.stack, membershipType });
    res.status(500).json({ error: 'Failed to rename membership type' });
  }
});

module.exports = router;
