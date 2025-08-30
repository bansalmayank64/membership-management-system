
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

router.get('/full-report', auth, requireAdmin, async (req, res) => {
  try {
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
        console.log(`Exporting table: ${tableName}`);
        
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
          console.log(`Exported ${tableData.rows.length} rows from ${tableName}`);
        }
      } catch (tableError) {
        console.warn(`Failed to export table ${tableName}:`, tableError.message);
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
    console.error('Full report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ...existing code...
// Backup all data as JSON
router.get('/backup', auth, requireAdmin, async (req, res) => {
  try {
    // Get all table names from the database metadata
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const backup = {};
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      try {
        const result = await pool.query(`SELECT * FROM ${tableName}`);
        backup[tableName] = result.rows;
        console.log(`Backed up ${result.rows.length} rows from ${tableName}`);
      } catch (tableError) {
        console.warn(`Failed to backup table ${tableName}:`, tableError.message);
        backup[tableName] = []; // Include empty array for failed tables
      }
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
    
    // Check if payments table has remarks column
    const paymentsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payments' AND table_schema = 'public'
    `);
    const hasRemarksColumn = paymentsColumns.rows.some(row => row.column_name === 'remarks');
    
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
      if (hasRemarksColumn) {
        await client.query(`INSERT INTO payments (id, student_id, amount, payment_date, payment_mode, payment_type, description, remarks, created_at, updated_at, modified_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`, [row.id, row.student_id, row.amount, row.payment_date, row.payment_mode, row.payment_type, row.description, row.remarks, row.created_at, row.updated_at, row.modified_by]);
      } else {
        await client.query(`INSERT INTO payments (id, student_id, amount, payment_date, payment_mode, payment_type, description, created_at, updated_at, modified_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`, [row.id, row.student_id, row.amount, row.payment_date, row.payment_mode, row.payment_type, row.description, row.created_at, row.updated_at, row.modified_by]);
      }
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
  
  // Helper function to find column value with flexible column name matching
  const getColumnValue = (row, possibleNames) => {
    for (const name of possibleNames) {
      if (row.hasOwnProperty(name)) {
        return row[name];
      }
    }
    return null;
  };

  // Helper function to parse Excel dates
  const parseExcelDate = (value) => {
    if (value === null || value === undefined) return null;

    // We'll treat all incoming Excel dates as being in IST (UTC+5:30).
    // Convert the parsed date/time (whatever the source) from IST to UTC before returning.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours in ms

    // If it's already a Date object
    if (value instanceof Date) {
      const t = value.getTime();
      return new Date(t - IST_OFFSET_MS);
    }

    // If it's a string that looks like a date
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return new Date(parsed.getTime() - IST_OFFSET_MS);
      }
    }

    // If it's a number (Excel serial date)
    if (typeof value === 'number' && value > 1) {
      // Excel date serial number (days since January 1, 1900)
      // Note: Excel incorrectly treats 1900 as a leap year, so we need to adjust
      const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // use UTC epoch for consistency
      const dateUtc = new Date(excelEpoch.getTime() + (value * 24 * 60 * 60 * 1000));
      // The computed dateUtc represents the date in local terms of the Excel serial; treat it as IST origin and convert to UTC
      return new Date(dateUtc.getTime() - IST_OFFSET_MS);
    }

    return null;
  };

  // Helper to normalize gender/sex values (flexible input: M/F/Male/Female in any case)
  const parseGender = (val) => {
    if (val === null || val === undefined) return null;
    const s = String(val).trim().toLowerCase();
    if (!s) return null;
    // Accept values that start with m -> male, f -> female
    if (s === 'm' || s === 'male' || s.startsWith('m')) return 'male';
    if (s === 'f' || s === 'female' || s.startsWith('f')) return 'female';
    return null;
  };

  // Column mapping definitions for flexible import
  const memberColumnMappings = {
    id: ['ID', 'id', 'Id', 'Student_ID', 'Student ID', 'student_id', 'StudentID'],
    name: ['Name_Student', 'name', 'Name', 'Student_Name', 'Student Name', 'student_name', 'StudentName'],
    father_name: ['Father_Name', 'father_name', 'Father Name', 'FatherName', 'Father', 'Guardian'],
    contact_number: ['Contact Number', 'contact_number', 'Contact_Number', 'Phone', 'Mobile', 'ContactNumber'],
    sex: ['Sex', 'sex', 'Gender', 'gender', 'G'],
    seat_number: ['Seat Number', 'seat_number', 'Seat_Number', 'SeatNumber', 'Seat', 'Seat#'],
    membership_date: ['Membership_Date', 'membership_date', 'Membership Date', 'MembershipDate', 'Start_Date', 'Start Date'],
    total_paid: ['Total_Paid', 'total_paid', 'Total Paid', 'TotalPaid', 'Amount_Paid', 'Amount Paid'],
    membership_till: ['Membership_Till', 'membership_till', 'Membership Till', 'MembershipTill', 'End_Date', 'End Date', 'Expiry_Date', 'Expiry Date'],
    membership_status: ['Membership_Status', 'membership_status', 'Membership Status', 'Status', 'Active_Status'],
    last_payment_date: ['Last_Payment_date', 'last_payment_date', 'Last Payment Date', 'LastPaymentDate', 'Recent_Payment']
  };

  const renewalColumnMappings = {
    id: ['ID', 'id', 'Id', 'Student_ID', 'Student ID', 'student_id', 'StudentID'],
    seat_number: ['Seat_Number', 'seat_number', 'Seat Number', 'SeatNumber', 'Seat', 'Seat#'],
    amount_paid: ['Amount_paid', 'amount_paid', 'Amount Paid', 'AmountPaid', 'Amount', 'Payment_Amount', 'Payment Amount'],
    payment_date: ['Payment_date', 'payment_date', 'Payment Date', 'PaymentDate', 'Date', 'Transaction_Date'],
    payment_mode: ['Payment_mode', 'payment_mode', 'Payment Mode', 'PaymentMode', 'Mode', 'Method', 'Payment_Method']
  };
  
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
    
    // Flexible sheet name matching
    const findSheet = (workbook, possibleNames) => {
      for (const name of possibleNames) {
        if (workbook.SheetNames.some(sheet => 
          sheet.toLowerCase().includes(name.toLowerCase()) || 
          name.toLowerCase().includes(sheet.toLowerCase())
        )) {
          return workbook.SheetNames.find(sheet => 
            sheet.toLowerCase().includes(name.toLowerCase()) || 
            name.toLowerCase().includes(sheet.toLowerCase())
          );
        }
      }
      return null;
    };
    
    const membersSheetNames = ['Library Members', 'Members', 'Students', 'Library_Members', 'Student_Data'];
    const renewalsSheetNames = ['Renewals', 'Payments', 'Renewal', 'Payment', 'Renewal_Data'];
    
    const membersSheetName = findSheet(workbook, membersSheetNames);
    const renewalsSheetName = findSheet(workbook, renewalsSheetNames);
    
    const missingSheets = [];
    if (!membersSheetName) missingSheets.push('Library Members (or similar)');
    if (!renewalsSheetName) missingSheets.push('Renewals (or similar)');
    
    if (missingSheets.length > 0) {
      console.log(`❌ Missing required sheets: ${missingSheets.join(', ')}`);
      console.log(`📊 Available sheets: ${workbook.SheetNames.join(', ')}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] POST /api/admin/import-excel completed with 400 in ${totalTime}ms [${requestId}]`);
      
      return res.status(400).json({ 
        error: `Missing required sheets: ${missingSheets.join(', ')}. Available sheets: ${workbook.SheetNames.join(', ')}`,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ Found matching sheets: Members="${membersSheetName}", Renewals="${renewalsSheetName}"`);

    console.log(`🔧 Step 4: Starting atomic transaction - either all data imports or nothing does...`);
    
    try {
      await client.query('BEGIN');
      console.log(`🚀 Transaction started - ensuring data integrity with all-or-nothing approach`);

      let importedCount = 0;
      let memberImported = 0;
      let memberSkipped = 0;
      let renewalImported = 0;
      let renewalSkipped = 0;

      console.log(`👥 Step 5: Processing Members sheet...`);
      const membersStart = Date.now();
      const membersSheet = workbook.Sheets[membersSheetName];
      const membersData = xlsx.utils.sheet_to_json(membersSheet);
      
      console.log(`📊 Found ${membersData.length} member records to process`);
      console.log(`📋 Sample member data:`, membersData.slice(0, 2));
      
      for (let i = 0; i < membersData.length; i++) {
        const member = membersData[i];
        
        const memberName = getColumnValue(member, memberColumnMappings.name) || 'Unknown';
        console.log(`👤 Processing member ${i + 1}/${membersData.length}: ${memberName}`);
        
  // Extract values using flexible column mapping
  const memberId = getColumnValue(member, memberColumnMappings.id);
  const memberSexRaw = getColumnValue(member, memberColumnMappings.sex);
  const memberSex = parseGender(memberSexRaw); // normalized to 'male'|'female' or null
  const seatNumber = getColumnValue(member, memberColumnMappings.seat_number);
        const membershipStatus = getColumnValue(member, memberColumnMappings.membership_status);
        
        // Validate required fields - skip invalid records instead of aborting
        if (!memberId || !memberName || memberName === 'Unknown') {
          console.log(`⚠️ Skipping member ${i + 1}: missing required ID or Name`);
          memberSkipped++;
          continue;
        }
        
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
          memberId,
          (memberName || '').toString().substring(0, 100).toUpperCase(), // Store in uppercase
          (getColumnValue(member, memberColumnMappings.father_name) || '').toString().substring(0, 100).toUpperCase(), // Store in uppercase
          (getColumnValue(member, memberColumnMappings.contact_number) || '').toString().substring(0, 20), // Respect VARCHAR(20) constraint
          memberSex || null, // Use normalized gender if present, otherwise NULL (no restriction)
          (seatNumber || '').toString().substring(0, 20), // Convert to string first, then respect VARCHAR(20) constraint
          parseExcelDate(getColumnValue(member, memberColumnMappings.membership_date)),
          parseExcelDate(getColumnValue(member, memberColumnMappings.membership_till)),
          ['active', 'expired', 'suspended'].includes(membershipStatus) 
            ? membershipStatus 
            : 'active', // Default to 'active' if invalid
          req.user.userId || req.user.id
        ]);

        // Assign seat if specified with enhanced validation and auto-creation
        if (seatNumber && studentResult.rows[0]) {
          const cleanSeatNumber = String(seatNumber).substring(0, 20);
          // Properly map gender values to database constraints
          const studentGender = memberSex || null; // 'male'|'female' or null
          console.log(`🪑 Assigning seat ${cleanSeatNumber} to student ${studentResult.rows[0].id} (${studentGender})`);
          
          // First, check if seat exists
          const seatExistsResult = await client.query(`
            SELECT seat_number, occupant_sex FROM seats WHERE seat_number = $1
          `, [cleanSeatNumber]);
          
            if (seatExistsResult.rows.length === 0) {
            // Seat doesn't exist, create it with appropriate gender restriction (or NULL if unknown)
            console.log(`🆕 Creating new seat ${cleanSeatNumber} with occupant_sex=${studentGender}`);
            await client.query(`
              INSERT INTO seats (seat_number, occupant_sex, created_at, updated_at, modified_by)
              VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3)
            `, [cleanSeatNumber, studentGender || null, req.user.userId || req.user.id]);
            
            console.log(`✅ Seat ${cleanSeatNumber} created successfully`);
          } else {
            // Seat exists, check gender compatibility
            const existingSeat = seatExistsResult.rows[0];
            if (existingSeat.occupant_sex && existingSeat.occupant_sex !== studentGender) {
              console.log(`⚠️ Seat ${cleanSeatNumber} has gender restriction (${existingSeat.occupant_sex}) but student is ${studentGender} - skipping assignment`);
              // Continue without assigning seat
            }
          }
          
          // Now assign the seat to the student
          const seatUpdateResult = await client.query(`
            UPDATE students 
            SET seat_number = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            AND EXISTS (
              SELECT 1 FROM seats 
              WHERE seat_number = $1 
                AND (occupant_sex IS NULL OR occupant_sex = $3)
            )
            RETURNING seat_number
          `, [cleanSeatNumber, studentResult.rows[0].id, studentGender]);
          
          if (seatUpdateResult.rows.length > 0) {
            console.log(`✅ Seat ${cleanSeatNumber} assigned successfully to student ${studentResult.rows[0].id}`);
          } else {
            console.log(`⚠️ Seat ${cleanSeatNumber} assignment failed - gender mismatch or seat occupied`);
          }
        }

        importedCount++;
        memberImported++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`📈 Progress: ${i + 1}/${membersData.length} members processed`);
        }
      }
      
      const membersTime = Date.now() - membersStart;
      console.log(`✅ Library Members processing completed in ${membersTime}ms: ${memberImported} imported`);

    // Check how many students are actually in the database now
    const studentCountResult = await client.query('SELECT COUNT(*) as count FROM students');
    console.log(`📊 Total students in database after member import: ${studentCountResult.rows[0].count}`);
    
    // Show sample of student IDs that were imported
    const sampleStudentsResult = await client.query('SELECT id FROM students ORDER BY id LIMIT 10');
    console.log(`📋 Sample student IDs in database:`, sampleStudentsResult.rows.map(r => r.id));

      console.log(`💰 Step 6: Processing Renewals sheet...`);
      const renewalsStart = Date.now();
      const renewalsSheet = workbook.Sheets[renewalsSheetName];
      const renewalsData = xlsx.utils.sheet_to_json(renewalsSheet);
      
      console.log(`📊 Found ${renewalsData.length} renewal records to process`);
      console.log(`📋 Sample renewal data:`, renewalsData.slice(0, 2));
      
      for (let i = 0; i < renewalsData.length; i++) {
        const renewal = renewalsData[i];
        
        const studentId = getColumnValue(renewal, renewalColumnMappings.id);
        const amount = getColumnValue(renewal, renewalColumnMappings.amount_paid);
        const paymentDate = getColumnValue(renewal, renewalColumnMappings.payment_date);
        const paymentMode = getColumnValue(renewal, renewalColumnMappings.payment_mode);
        const seatNumber = getColumnValue(renewal, renewalColumnMappings.seat_number);
        
        console.log(`💳 Processing renewal ${i + 1}/${renewalsData.length}: Student ID ${studentId}`);
        
        // Validate required fields - skip invalid records instead of aborting
        if (!studentId || !amount) {
          console.log(`⚠️ Skipping renewal ${i + 1}: missing required Student ID or Amount`);
          renewalSkipped++;
          continue;
        }
        
        // Check if student exists before inserting payment - any missing student aborts import
        const studentCheckResult = await client.query(`
          SELECT id FROM students WHERE id = $1
        `, [studentId]);
        
        if (studentCheckResult.rows.length === 0) {
          console.log(`⚠️ Skipping renewal ${i + 1}: Student ID ${studentId} not found`);
          renewalSkipped++;
          continue;
        }
        
        // Insert payment with enhanced validation
        await client.query(`
          INSERT INTO payments (
            student_id, amount, payment_date, payment_mode, description, modified_by,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          studentId,
          Math.max(0, parseFloat(amount || 0)), // Ensure positive amount
          parseExcelDate(paymentDate) || new Date(),
          ['cash', 'online'].includes((paymentMode || 'cash').toLowerCase()) 
            ? (paymentMode || 'cash').toLowerCase() 
            : 'cash', // Ensure valid payment mode
          `Renewal payment - Seat ${String(seatNumber || 'N/A').substring(0, 100)}`, // Convert to string first, then limit description length
          req.user.userId || req.user.id
        ]);

        importedCount++;
        renewalImported++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`📈 Progress: ${i + 1}/${renewalsData.length} renewals processed`);
        }
      }
      
      const renewalsTime = Date.now() - renewalsStart;
      console.log(`✅ Renewals processing completed in ${renewalsTime}ms: ${renewalImported} imported`);

      // Commit the transaction - all data imported successfully
      await client.query('COMMIT');
      console.log(`🎉 Transaction committed successfully! All ${importedCount} records imported atomically.`);

      const totalTime = Date.now() - startTime;
      const totalSkipped = memberSkipped + renewalSkipped;
      console.log(`📊 Import summary: ${importedCount} records imported, ${totalSkipped} skipped (${memberImported} members, ${renewalImported} renewals)`);
      console.log(`🎯 [${new Date().toISOString()}] POST /api/admin/import-excel completed successfully in ${totalTime}ms [${requestId}]`);
      
      const message = totalSkipped > 0 
        ? `Import completed! ${importedCount} records imported, ${totalSkipped} records skipped due to missing data.`
        : `Import completed successfully! All ${importedCount} records imported.`;
      
      res.json({ 
        message: message,
        imported: importedCount,
        skipped: totalSkipped,
        members: {
          total: membersData.length,
          imported: memberImported,
          skipped: memberSkipped,
          errors: 0
        },
        renewals: {
          total: renewalsData.length,
          imported: renewalImported,
          skipped: renewalSkipped,
          errors: 0
        },
        success: true,
        allOrNothing: true,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Rollback the transaction - no data should be imported
      await client.query('ROLLBACK');
      console.log(`🔄 Transaction rolled back due to error: ${error.message}`);
      
      const totalTime = Date.now() - startTime;
      console.error(`❌ [${new Date().toISOString()}] POST /api/admin/import-excel FAILED after ${totalTime}ms [${requestId}]`);
      console.error(`💥 Error details:`, {
        message: error.message,
        stack: error.stack,
        code: error.code,
        fileName: req.file?.originalname
      });
      
      res.status(400).json({ 
        message: `Import failed: ${error.message}. No data was imported to maintain data integrity.`,
        success: false,
        allOrNothing: true,
        error: error.message,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ Unexpected error in import-excel: ${error.message}`);
    if (client) {
      client.release();
    }
    res.status(500).json({ 
      message: 'An unexpected error occurred during import',
      error: error.message,
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
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

// Clean database (delete all data from all tables except users, and restart all sequences, then run setup-database.js)
const { spawn } = require('child_process');
router.post('/clean-database', auth, requireAdmin, async (req, res) => {
  const requestId = `clean-db-${Date.now()}`;
  console.log(`\n🧹 [${new Date().toISOString()}] Starting clean-database [${requestId}]`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all table names in public schema except users
    console.log('🔎 Fetching all table names (except users)...');
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != 'users'
    `);
    const tableNames = tablesResult.rows.map(row => row.table_name);
    console.log(`📋 Tables to clean: ${tableNames.join(', ')}`);

    // Disable only user-defined triggers (not system triggers) for referential integrity
    for (const table of tableNames) {
      const triggersResult = await client.query(`
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'public."${table}"'::regclass 
          AND NOT tgisinternal 
          AND tgname NOT LIKE 'RI_ConstraintTrigger%'
      `);
      for (const trig of triggersResult.rows) {
        console.log(`🚫 Disabling trigger '${trig.tgname}' on table '${table}'`);
        await client.query(`ALTER TABLE "${table}" DISABLE TRIGGER "${trig.tgname}"`);
      }
    }

    // Delete all data from each table in dependency order to avoid FK errors
    // 1. payments, 2. expenses, 3. students, 4. others
    const ordered = [];
    if (tableNames.includes('payments')) ordered.push('payments');
    if (tableNames.includes('expenses')) ordered.push('expenses');
    if (tableNames.includes('students')) ordered.push('students');
    // Add all other tables not already in the list
    for (const t of tableNames) {
      if (!ordered.includes(t)) ordered.push(t);
    }
    for (const table of ordered) {
      console.log(`🗑️ Deleting all data from table '${table}'...`);
      await client.query(`DELETE FROM "${table}"`);
    }

    // Enable user-defined triggers back
    for (const table of tableNames) {
      const triggersResult = await client.query(`
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'public."${table}"'::regclass 
          AND NOT tgisinternal 
          AND tgname NOT LIKE 'RI_ConstraintTrigger%'
      `);
      for (const trig of triggersResult.rows) {
        console.log(`✅ Enabling trigger '${trig.tgname}' on table '${table}'`);
        await client.query(`ALTER TABLE "${table}" ENABLE TRIGGER "${trig.tgname}"`);
      }
    }

    // Restart all sequences in public schema
    console.log('🔄 Restarting all sequences...');
    const seqResult = await client.query(`
      SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
    `);
    for (const seq of seqResult.rows) {
      console.log(`🔢 Restarting sequence '${seq.sequence_name}' to 1`);
      await client.query(`ALTER SEQUENCE "${seq.sequence_name}" RESTART WITH 1`);
    }
    
    console.log('🔢 Restarting students_id_seq to 20250001');
    await client.query(`ALTER SEQUENCE students_id_seq RESTART WITH 20250001`);

    await client.query('COMMIT');
    console.log('✅ Database cleaned. Now running setup-database.js...');

    // Now call setup-database.js as a child process
    const setupProcess = spawn('node', ['setup-database.js'], {
      cwd: require('path').resolve(__dirname, '..'),
      shell: true
    });

    let output = '';
    let errorOutput = '';
    setupProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(`[setup-database.js] ${data}`);
    });
    setupProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(`[setup-database.js ERROR] ${data}`);
    });
    setupProcess.on('close', (code) => {
      if (code === 0) {
        console.log('🎉 setup-database.js executed successfully.');
        res.json({ message: 'Database cleaned and setup-database.js executed successfully', setupOutput: output });
      } else {
        console.error('❌ setup-database.js failed:', errorOutput);
        res.status(500).json({ error: 'Database cleaned but setup-database.js failed', setupError: errorOutput });
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cleaning database:', error);
    res.status(500).json({ error: 'Failed to clean database', details: error.message });
  } finally {
    client.release();
    console.log(`🧹 clean-database [${requestId}] finished`);
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
