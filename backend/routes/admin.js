
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

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

router.get('/full-report', auth, requireAdmin, async (req, res) => {
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
    res.setHeader('Content-Disposition', `attachment; filename="full-data-report-${new Date().toISOString().split('T')[0]}.xlsx"`);
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
router.get('/users', auth, requireAdmin, async (req, res) => {
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
      query += `, password = $${params.length + 1}`;
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


// Get system statistics
router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM students'),
      pool.query('SELECT COUNT(*) as total FROM seats WHERE EXISTS (SELECT 1 FROM students WHERE students.seat_number = seats.seat_number)'),
      pool.query('SELECT COUNT(*) as total FROM payments'),
      pool.query('SELECT COUNT(*) as total FROM expenses'),
      pool.query("SELECT COUNT(*) as total FROM users WHERE status = 'active'"),
      pool.query('SELECT SUM(amount) as total FROM payments'),
      pool.query('SELECT SUM(amount) as total FROM expenses')
    ]);

    res.json({
      students: parseInt(stats[0].rows[0].total),
      occupiedSeats: parseInt(stats[1].rows[0].total),
      payments: parseInt(stats[2].rows[0].total),
      expenses: parseInt(stats[3].rows[0].total),
      users: parseInt(stats[4].rows[0].total),
      totalRevenue: parseFloat(stats[5].rows[0].total || 0),
      totalExpenses: parseFloat(stats[6].rows[0].total || 0)
    });
  } catch (error) {
    logger.error('Error fetching stats', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch statistics' });
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
router.get('/seats', auth, requireAdmin, async (req, res) => {
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
router.get('/fees-config', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM student_fees_config 
      ORDER BY gender
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching fees config', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch fees configuration' });
  }
});

// Mount activity routes under /api/admin/activity
router.use('/activity', auth, requireAdmin, activityRoutes);

// Update fees configuration
router.put('/fees-config/:gender', auth, requireAdmin, async (req, res) => {
  const { gender } = req.params;
  const { monthly_fees } = req.body;

  try {
    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({ error: 'Invalid gender. Must be male or female' });
    }

    if (!monthly_fees || monthly_fees <= 0) {
      return res.status(400).json({ error: 'Monthly fees must be a positive number' });
    }

    const result = await pool.query(`
      UPDATE student_fees_config 
      SET monthly_fees = $1, updated_at = CURRENT_TIMESTAMP
      WHERE gender = $2
      RETURNING *
    `, [monthly_fees, gender]);

    if (result.rows.length === 0) {
      // If no record exists, create one
      const insertResult = await pool.query(`
        INSERT INTO student_fees_config (gender, monthly_fees)
        VALUES ($1, $2)
        RETURNING *
      `, [gender, monthly_fees]);
      
      return res.json(insertResult.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating fees config', { error: error.message, stack: error.stack, gender });
    res.status(500).json({ error: 'Failed to update fees configuration' });
  }
});

module.exports = router;
