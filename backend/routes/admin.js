
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

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
  console.log(`🔐👨‍💼 [${new Date().toISOString()}] Checking admin permissions [${requestId}]`);
  console.log(`👤 User: ${req.user?.username} (ID: ${req.user?.userId}, Role: ${req.user?.role})`);
  if (req.user && (req.user.role === 'admin' || req.user.permissions?.canManageUsers)) {
    console.log(`✅ Admin access granted for: ${req.user.username}`);
    next();
  } else {
    console.log(`❌ Admin access denied for: ${req.user?.username || 'anonymous'}`);
    res.status(403).json({ 
      error: 'Admin access required',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
};

// Download full data report (XLSX, all tables, presentable)
router.get('/full-report', auth, requireAdmin, async (req, res) => {
  try {
    // Fetch all data
    const users = await db.any('SELECT id, username, role, status, created_at FROM users ORDER BY id');
    const students = await db.any('SELECT * FROM students ORDER BY id');
    const payments = await db.any('SELECT * FROM payments ORDER BY id');
    const seats = await db.any('SELECT * FROM seats ORDER BY seat_number');
    const expenses = await db.any('SELECT * FROM expenses ORDER BY id');
    // History: seat assignment, payment, and status changes (if tracked)
    let seatHistory = [];
    try {
      seatHistory = await db.any('SELECT * FROM seat_history ORDER BY id');
    } catch (e) { /* ignore if not present */ }

    // Format data for sheets
    const sheets = {};
    if (users.length) {
      sheets['Users'] = users;
    }
    if (students.length) {
      sheets['Students'] = students;
    }
    if (payments.length) {
      sheets['Payments'] = payments;
    }
    if (seats.length) {
      sheets['Seats'] = seats;
    }
    if (expenses.length) {
      sheets['Expenses'] = expenses;
    }
    if (seatHistory.length) {
      sheets['Seat History'] = seatHistory;
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
    console.error('Full report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ...existing code...
// Backup all data as JSON
router.get('/backup', auth, requireAdmin, async (req, res) => {
  try {
    const tables = ['users', 'students', 'seats', 'payments', 'expenses', 'student_fees_config'];
    const backup = {};
    for (const table of tables) {
      const result = await pool.query(`SELECT * FROM ${table}`);
      backup[table] = result.rows;
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="study-room-backup.json"');
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Backup failed: ' + error.message });
  }
});

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
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Restore all data from JSON
router.post('/restore', auth, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const client = await pool.connect();
  try {
    const backup = JSON.parse(req.file.buffer.toString());
    await client.query('BEGIN');
    // Clean tables (except users if you want to keep admin)
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM students');
    await client.query('DELETE FROM seats');
    await client.query('DELETE FROM student_fees_config');
    // Optionally: await client.query('DELETE FROM users WHERE username != \'admin\'');
    // Restore seats
    for (const row of backup.seats || []) {
      await client.query(`INSERT INTO seats (seat_number, occupant_sex, created_at, updated_at, modified_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (seat_number) DO NOTHING`, [row.seat_number, row.occupant_sex, row.created_at, row.updated_at, row.modified_by]);
    }
    // Restore students
    for (const row of backup.students || []) {
      await client.query(`INSERT INTO students (id, name, father_name, contact_number, sex, seat_number, membership_date, membership_till, membership_status, created_at, updated_at, modified_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`, [row.id, row.name, row.father_name, row.contact_number, row.sex, row.seat_number, row.membership_date, row.membership_till, row.membership_status, row.created_at, row.updated_at, row.modified_by]);
    }
    // Restore users (skip if you want to keep admin only)
    for (const row of backup.users || []) {
      if (row.username !== 'admin') {
        await client.query(`INSERT INTO users (id, username, password_hash, role, permissions, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`, [row.id, row.username, row.password_hash, row.role, row.permissions, row.status, row.created_at, row.updated_at]);
      }
    }
    // Restore payments
    for (const row of backup.payments || []) {
      await client.query(`INSERT INTO payments (id, student_id, amount, payment_date, payment_mode, payment_type, description, remarks, created_at, updated_at, modified_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`, [row.id, row.student_id, row.amount, row.payment_date, row.payment_mode, row.payment_type, row.description, row.remarks, row.created_at, row.updated_at, row.modified_by]);
    }
    // Restore expenses
    for (const row of backup.expenses || []) {
      await client.query(`INSERT INTO expenses (id, category, description, amount, expense_date, created_at, updated_at, modified_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`, [row.id, row.category, row.description, row.amount, row.expense_date, row.created_at, row.updated_at, row.modified_by]);
    }
    // Restore student_fees_config
    for (const row of backup.student_fees_config || []) {
      await client.query(`INSERT INTO student_fees_config (id, gender, monthly_fees, created_at, updated_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [row.id, row.gender, row.monthly_fees, row.created_at, row.updated_at]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Restore completed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Restore failed: ' + error.message });
  } finally {
    client.release();
  }
});

// ...existing code...





// Import Excel data
router.post('/import-excel', auth, requireAdmin, upload.single('file'), async (req, res) => {
  const requestId = `admin-import-${Date.now()}`;
  const startTime = Date.now();
  const client = await pool.connect();
  
  try {
    console.log(`📊📥 [${new Date().toISOString()}] Starting POST /api/admin/import-excel [${requestId}]`);
    console.log(`👤 Requested by: ${req.user.username} (ID: ${req.user.userId})`);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`🔍 Step 1: Validating uploaded file...`);
    if (!req.file) {
      console.log(`❌ No file uploaded`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/admin/import-excel completed with 400 in ${totalTime}ms [${requestId}]`);
      
      return res.status(400).json({ 
        error: 'No file uploaded',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📋 File details: name=${req.file.originalname}, size=${req.file.size} bytes, mimetype=${req.file.mimetype}`);

    console.log(`📝 Step 2: Parsing Excel file...`);
    const parseStart = Date.now();
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const parseTime = Date.now() - parseStart;
    
    console.log(`✅ Excel file parsed in ${parseTime}ms`);
    console.log(`📊 Available sheets: ${workbook.SheetNames.join(', ')}`);
    
    console.log(`🔍 Step 3: Validating required sheets...`);
    const requiredSheets = ['Library Members', 'Renewals'];
    const missingSheets = requiredSheets.filter(sheet => !workbook.SheetNames.includes(sheet));
    
    if (missingSheets.length > 0) {
      console.log(`❌ Missing required sheets: ${missingSheets.join(', ')}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/admin/import-excel completed with 400 in ${totalTime}ms [${requestId}]`);
      
      return res.status(400).json({ 
        error: `Missing required sheets: ${missingSheets.join(', ')}`,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔧 Step 4: Starting database transaction...`);
    await client.query('BEGIN');

    let importedCount = 0;
    let memberErrors = 0;
    let renewalErrors = 0;

    console.log(`👥 Step 5: Processing Library Members sheet...`);
    const membersStart = Date.now();
    const membersSheet = workbook.Sheets['Library Members'];
    const membersData = xlsx.utils.sheet_to_json(membersSheet);
    
    console.log(`📊 Found ${membersData.length} member records to process`);
    console.log(`📋 Sample member data:`, membersData.slice(0, 2));
    
    for (let i = 0; i < membersData.length; i++) {
      const member = membersData[i];
      try {
        console.log(`👤 Processing member ${i + 1}/${membersData.length}: ${member.Name_Student || member.name}`);
        
        // Insert student with enhanced data validation and proper constraint handling
        const studentResult = await client.query(`
          INSERT INTO students (
            id, name, father_name, contact_number, sex, 
            seat_number, membership_date, membership_till, membership_status,
            modified_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            father_name = EXCLUDED.father_name,
            contact_number = EXCLUDED.contact_number,
            sex = CASE 
              WHEN EXCLUDED.sex IN ('male', 'female') THEN EXCLUDED.sex 
              ELSE students.sex 
            END,
            seat_number = EXCLUDED.seat_number,
            membership_date = EXCLUDED.membership_date,
            membership_till = EXCLUDED.membership_till,
            membership_status = CASE 
              WHEN EXCLUDED.membership_status IN ('active', 'expired', 'suspended') THEN EXCLUDED.membership_status 
              ELSE students.membership_status 
            END,
            modified_by = EXCLUDED.modified_by,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          member.ID || member.id,
          (member.Name_Student || member.name || '').substring(0, 100), // Respect VARCHAR(100) constraint
          (member.Father_Name || member.father_name || '').substring(0, 100), // Respect VARCHAR(100) constraint
          (member['Contact Number'] || member.contact_number || '').substring(0, 20), // Respect VARCHAR(20) constraint
          (member.Sex || member.sex || '').toLowerCase() === 'male' ? 'male' : 'female', // Ensure valid enum
          (member['Seat Number'] || member.seat_number || '').substring(0, 20), // Respect VARCHAR(20) constraint
          member.Membership_Date || member.membership_date,
          member.Membership_Till || member.membership_till,
          ['active', 'expired', 'suspended'].includes(member.Membership_Status || member.membership_status) 
            ? (member.Membership_Status || member.membership_status) 
            : 'active', // Default to 'active' if invalid
          req.user.userId || req.user.id
        ]);

        // Assign seat if specified with enhanced validation
        if ((member['Seat Number'] || member.seat_number) && studentResult.rows[0]) {
          const seatNumber = (member['Seat Number'] || member.seat_number).substring(0, 20);
          console.log(`🪑 Assigning seat ${seatNumber} to student ${studentResult.rows[0].id}`);
          
          // Check if seat exists and update seat assignment properly
          const seatUpdateResult = await client.query(`
            UPDATE students 
            SET seat_number = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            AND EXISTS (
              SELECT 1 FROM seats 
              WHERE seat_number = $1 
                AND status IN ('available', 'occupied')
                AND (occupant_sex IS NULL OR occupant_sex = $3)
            )
            RETURNING seat_number
          `, [seatNumber, studentResult.rows[0].id, (member.Sex || member.sex || '').toLowerCase()]);
          
          if (seatUpdateResult.rows.length > 0) {
            console.log(`✅ Seat ${seatNumber} assigned successfully`);
          } else {
            console.log(`⚠️ Seat ${seatNumber} assignment failed - seat may not exist or gender mismatch`);
          }
        }

        importedCount++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`📈 Progress: ${i + 1}/${membersData.length} members processed`);
        }
      } catch (error) {
        memberErrors++;
        console.error(`❌ Error importing member ${i + 1}:`, {
          member: member,
          error: error.message,
          code: error.code
        });
        // Continue with next record
      }
    }
    
    const membersTime = Date.now() - membersStart;
    console.log(`✅ Library Members processing completed in ${membersTime}ms: ${importedCount} imported, ${memberErrors} errors`);

    console.log(`💰 Step 6: Processing Renewals sheet...`);
    const renewalsStart = Date.now();
    const renewalsSheet = workbook.Sheets['Renewals'];
    const renewalsData = xlsx.utils.sheet_to_json(renewalsSheet);
    
    console.log(`📊 Found ${renewalsData.length} renewal records to process`);
    console.log(`📋 Sample renewal data:`, renewalsData.slice(0, 2));
    
    for (let i = 0; i < renewalsData.length; i++) {
      const renewal = renewalsData[i];
      try {
        console.log(`💳 Processing renewal ${i + 1}/${renewalsData.length}: Student ID ${renewal.ID || renewal.id}`);
        
        // Insert payment with enhanced validation
        await client.query(`
          INSERT INTO payments (
            student_id, amount, payment_date, payment_mode, description, modified_by,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          renewal.ID || renewal.id || renewal.student_id,
          Math.max(0, parseFloat(renewal.Amount_paid || renewal.amount || 0)), // Ensure positive amount
          renewal.Payment_date || renewal.payment_date || new Date(),
          ['cash', 'online'].includes((renewal.Payment_mode || renewal.payment_mode || 'cash').toLowerCase()) 
            ? (renewal.Payment_mode || renewal.payment_mode || 'cash').toLowerCase() 
            : 'cash', // Ensure valid payment mode
          `Renewal payment - Seat ${(renewal.Seat_Number || renewal.seat_number || 'N/A').substring(0, 100)}`, // Limit description length
          req.user.userId || req.user.id
        ]);

        importedCount++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`📈 Progress: ${i + 1}/${renewalsData.length} renewals processed`);
        }
      } catch (error) {
        renewalErrors++;
        console.error(`❌ Error importing renewal ${i + 1}:`, {
          renewal: renewal,
          error: error.message,
          code: error.code
        });
        // Continue with next record
      }
    }
    
    const renewalsTime = Date.now() - renewalsStart;
    console.log(`✅ Renewals processing completed in ${renewalsTime}ms: ${renewalErrors} errors`);

    console.log(`🔧 Step 7: Committing transaction...`);
    const commitStart = Date.now();
    await client.query('COMMIT');
    const commitTime = Date.now() - commitStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Transaction committed in ${commitTime}ms`);
    console.log(`📊 Import summary: ${importedCount} total records imported, ${memberErrors + renewalErrors} total errors`);
    console.log(`🎯 [${new Date().toISOString()}] POST /api/admin/import-excel completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json({ 
      message: 'Import completed successfully',
      imported: importedCount,
      members: membersData.length,
      renewals: renewalsData.length,
      errors: {
        members: memberErrors,
        renewals: renewalErrors,
        total: memberErrors + renewalErrors
      },
      requestId: requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] POST /api/admin/import-excel FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      fileName: req.file?.originalname
    });
    
    console.log(`🔄 Rolling back transaction...`);
    await client.query('ROLLBACK');
    
    res.status(500).json({ 
      error: 'Import failed: ' + error.message,
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Export Excel data
router.get('/export-excel', auth, requireAdmin, async (req, res) => {
  try {
    // Get all data
    const studentsResult = await pool.query(`
      SELECT 
        s.id,
        s.name as "Name_Student",
        s.father_name as "Father_Name",
        s.contact_number as "Contact Number",
        s.sex,
        s.membership_date as "Membership_Date",
        s.membership_till as "Membership_Till",
        s.membership_status as "Membership_Status",
        COALESCE(payment_summary.total_paid, 0) as "Total_Paid",
        payment_summary.last_payment_date as "Last_Payment_date",
        se.seat_number as "Seat Number"
      FROM students s
      LEFT JOIN seats se ON s.seat_number = se.seat_number
      LEFT JOIN (
        SELECT 
          student_id,
          SUM(amount) as total_paid,
          MAX(payment_date) as last_payment_date
        FROM payments 
        GROUP BY student_id
      ) payment_summary ON s.id = payment_summary.student_id
      ORDER BY s.id
    `);

    const paymentsResult = await pool.query(`
      SELECT 
        p.student_id as "ID",
        st.seat_number as "Seat_Number",
        p.amount as "Amount_paid",
        p.payment_date as "Payment_date",
        p.payment_mode as "Payment_mode"
      FROM payments p
      LEFT JOIN students st ON p.student_id = st.id
      ORDER BY p.payment_date DESC
    `);

    // Create workbook
    const workbook = xlsx.utils.book_new();
    
    // Add Library Members sheet
    const membersSheet = xlsx.utils.json_to_sheet(studentsResult.rows);
    xlsx.utils.book_append_sheet(workbook, membersSheet, 'Library Members');
    
    // Add Renewals sheet
    const renewalsSheet = xlsx.utils.json_to_sheet(paymentsResult.rows);
    xlsx.utils.book_append_sheet(workbook, renewalsSheet, 'Renewals');

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="library-data-export.xlsx"');
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed: ' + error.message });
  }
});

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
    console.error('Error fetching users:', error);
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
    console.error('Error updating user:', error);
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
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Clean database (except users)
router.post('/clean-database', auth, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Clear all data tables but keep users and seats structure
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM students');
    await client.query('DELETE FROM seats');
    
    // Note: We don't modify seats.occupant_sex as it represents gender restrictions, not current occupants

    // Reset auto-increment sequences
    await client.query('ALTER SEQUENCE students_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE payments_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE expenses_id_seq RESTART WITH 1');

    await client.query('COMMIT');
    
    res.json({ message: 'Database cleaned successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cleaning database:', error);
    res.status(500).json({ error: 'Failed to clean database' });
  } finally {
    client.release();
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
    console.error('Error fetching stats:', error);
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
    console.error('Error adding seat:', error);
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
    console.error('Error updating seat:', error);
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
    console.error('Error deleting seat:', error);
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
    console.error('Error fetching seats:', error);
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
    console.error('Error fetching fees config:', error);
    res.status(500).json({ error: 'Failed to fetch fees configuration' });
  }
});

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
    console.error('Error updating fees config:', error);
    res.status(500).json({ error: 'Failed to update fees configuration' });
  }
});

module.exports = router;
