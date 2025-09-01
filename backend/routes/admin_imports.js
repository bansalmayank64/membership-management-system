const { spawn } = require('child_process');

module.exports = function registerAdminImports(router, { pool, upload, auth, requireAdmin, XLSX, xlsx, logger }) {
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

  // Backup as JSON
  router.get('/backup', auth, requireAdmin, async (req, res) => {
    const requestId = `admin-backup-${Date.now()}`;
    const start = Date.now();
    try {
      logger.info('Starting backup', { requestId });
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
          logger.info(`Backed up table`, { table: tableName, rows: result.rows.length });
        } catch (tableError) {
          logger.warn(`Failed to backup table`, { table: tableName, error: tableError.message });
          backup[tableName] = [];
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="study-room-backup.json"');
      res.send(JSON.stringify(backup, null, 2));
      logger.info('Backup completed', { requestId, durationMs: Date.now() - start });
    } catch (error) {
      logger.error('Backup error', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Backup failed: ' + error.message });
    }
  });

  // Restore from JSON
  router.post('/restore', auth, requireAdmin, upload.single('file'), async (req, res) => {
    const requestId = `admin-restore-${Date.now()}`;
    const start = Date.now();
    const client = await pool.connect();
    try {
      if (!req.file) {
        logger.warn('No file uploaded for restore', { requestId });
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const backup = JSON.parse(req.file.buffer.toString());

      // Check payments remarks column
      const paymentsColumns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'payments' AND table_schema = 'public'
      `);
      const hasRemarksColumn = paymentsColumns.rows.some(row => row.column_name === 'remarks');

      await client.query('BEGIN');
      // Clean tables
      await client.query('DELETE FROM payments');
      await client.query('DELETE FROM expenses');
      await client.query('DELETE FROM students');
      await client.query('DELETE FROM seats');
      await client.query('DELETE FROM student_fees_config');

      // Restore seats
      for (const row of backup.seats || []) {
        await client.query(`INSERT INTO seats (seat_number, occupant_sex, created_at, updated_at, modified_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (seat_number) DO NOTHING`, [row.seat_number, row.occupant_sex, row.created_at, row.updated_at, row.modified_by]);
      }

      // Restore students (normalize contact numbers to 10 digits; default to '1234567890' when invalid)
      for (const row of backup.students || []) {
        const restoredContact = (() => {
          if (!row || row.contact_number === null || row.contact_number === undefined) return '1234567890';
          const digits = String(row.contact_number).replace(/[^0-9]/g, '');
          return /^[0-9]{10}$/.test(digits) ? digits : '1234567890';
        })();
        await client.query(`INSERT INTO students (id, name, father_name, contact_number, sex, seat_number, membership_date, membership_till, membership_status, created_at, updated_at, modified_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`, [row.id, row.name, row.father_name, restoredContact, row.sex, row.seat_number, row.membership_date, row.membership_till, row.membership_status, row.created_at, row.updated_at, row.modified_by]);
      }

      // Restore users (skip admin if present)
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
      logger.info('Restore completed', { requestId, durationMs: Date.now() - start });
      res.json({ message: 'Restore completed successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Restore error', { requestId, error: error.message });
      res.status(500).json({ error: 'Restore failed: ' + error.message });
    } finally {
      client.release();
    }
  });

  // Import Excel data
  router.post('/import-excel', auth, requireAdmin, upload.single('file'), async (req, res) => {
    const requestId = `admin-import-${Date.now()}`;
    const startTime = Date.now();
    const client = await pool.connect();

    const getColumnValue = (row, possibleNames) => {
      for (const name of possibleNames) {
        if (row.hasOwnProperty(name)) {
          return row[name];
        }
      }
      return null;
    };

    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const parseExcelDate = (value) => {
      if (value === null || value === undefined) return null;
      if (value instanceof Date) return new Date(value.getTime() - IST_OFFSET_MS);
      if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) return new Date(parsed.getTime() - IST_OFFSET_MS);
      }
      if (typeof value === 'number' && value > 1) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const dateUtc = new Date(excelEpoch.getTime() + (value * 24 * 60 * 60 * 1000));
        return new Date(dateUtc.getTime() - IST_OFFSET_MS);
      }
      return null;
    };

    const parseGender = (val) => {
      if (val === null || val === undefined) return null;
      const s = String(val).trim().toLowerCase();
      if (!s) return null;
      if (s === 'm' || s === 'male' || s.startsWith('m')) return 'male';
      if (s === 'f' || s === 'female' || s.startsWith('f')) return 'female';
      return null;
    };

    // Generate a pseudo-unique 12-digit Aadhaar-like number when missing
    const generateAadhaar = () => {
      // Use timestamp + random to reduce collision probability, then trim/pad to 12 digits
      const ts = Date.now().toString().slice(-8); // last 8 digits of ms timestamp
      const rand = Math.floor(Math.random() * 1e4).toString().padStart(4, '0');
      const candidate = (ts + rand).slice(0, 12);
      return candidate;
    };

    // Normalize contact number: return exactly 10 digits or null
    const normalizeContact = (val) => {
      if (val === null || val === undefined) return null;
      const s = String(val).trim();
      // Remove common formatting characters
      const digits = s.replace(/[^0-9]/g, '');
      if (/^[0-9]{10}$/.test(digits)) return digits;
      return null;
    };

    // Column mappings (same as before)
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
  ,
  aadhaar_number: ['Aadhaar', 'Aadhar', 'Aadhaar Number', 'AADHAR', 'aadhaar', 'Aadhaar_Number'],
  address: ['Address', 'address', 'Residential Address', 'Address_Line']
    };

    const renewalColumnMappings = {
      id: ['ID', 'id', 'Id', 'Student_ID', 'Student ID', 'student_id', 'StudentID'],
      seat_number: ['Seat_Number', 'seat_number', 'Seat Number', 'SeatNumber', 'Seat', 'Seat#'],
      amount_paid: ['Amount_paid', 'amount_paid', 'Amount Paid', 'AmountPaid', 'Amount', 'Payment_Amount', 'Payment Amount'],
      payment_date: ['Payment_date', 'payment_date', 'Payment Date', 'PaymentDate', 'Date', 'Transaction_Date'],
      payment_mode: ['Payment_mode', 'payment_mode', 'Payment Mode', 'PaymentMode', 'Mode', 'Method', 'Payment_Method']
    };

    try {
      logger.info('Starting import-excel', { requestId, user: req.user?.username });

      if (!req.file) {
        logger.warn('No file uploaded for import', { requestId });
        return res.status(400).json({ error: 'No file uploaded', requestId });
      }

      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });

      const findSheet = (workbook, possibleNames) => {
        for (const name of possibleNames) {
          if (workbook.SheetNames.some(sheet => sheet.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(sheet.toLowerCase()))) {
            return workbook.SheetNames.find(sheet => sheet.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(sheet.toLowerCase()));
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
        logger.warn('Missing required sheets for import', { requestId, available: workbook.SheetNames });
        return res.status(400).json({ error: `Missing required sheets: ${missingSheets.join(', ')}. Available: ${workbook.SheetNames.join(', ')}`, requestId });
      }

      await client.query('BEGIN');
      logger.info('Transaction started for import', { requestId });

      let importedCount = 0;
      let memberImported = 0;
      let memberSkipped = 0;
      let renewalImported = 0;
      let renewalSkipped = 0;

      const membersData = xlsx.utils.sheet_to_json(workbook.Sheets[membersSheetName]);
      logger.info('Processing members', { requestId, total: membersData.length });

      for (let i = 0; i < membersData.length; i++) {
        const member = membersData[i];
        const memberName = getColumnValue(member, memberColumnMappings.name) || 'Unknown';

        const memberId = getColumnValue(member, memberColumnMappings.id);
        const memberSexRaw = getColumnValue(member, memberColumnMappings.sex);
        const memberSex = parseGender(memberSexRaw);
        const seatNumber = getColumnValue(member, memberColumnMappings.seat_number);
        const membershipStatus = getColumnValue(member, memberColumnMappings.membership_status);
        // New fields: aadhaar_number and address. Provide defaults when missing.
        let aadhaarNumber = (getColumnValue(member, memberColumnMappings.aadhaar_number) || '').toString().replace(/\D/g, '');
        if (!aadhaarNumber || aadhaarNumber.length !== 12) {
          aadhaarNumber = generateAadhaar();
        }
        // Ensure Aadhaar is unique in students table to avoid unique constraint errors
        try {
          let attempts = 0;
          while (attempts < 5) {
            const existing = await client.query(`SELECT id FROM students WHERE aadhaar_number = $1 LIMIT 1`, [aadhaarNumber]);
            if (existing.rows.length === 0) break;
            // If found and belongs to same incoming id, break (we'll update). Otherwise regenerate.
            if (existing.rows[0].id && String(existing.rows[0].id) === String(memberId)) break;
            aadhaarNumber = generateAadhaar();
            attempts++;
          }
        } catch (e) {
          // If uniqueness check fails for any reason, keep the current aadhaarNumber (best effort)
          logger.warn('Aadhaar uniqueness check failed during import', { requestId, error: e.message });
        }
        let addressVal = (getColumnValue(member, memberColumnMappings.address) || '').toString().trim();
        if (!addressVal) addressVal = 'NA';

        if (!memberId || !memberName || memberName === 'Unknown') {
          memberSkipped++;
          continue;
        }

  // Ensure membership_date is not null; default to today when missing
  const membershipDateVal = parseExcelDate(getColumnValue(member, memberColumnMappings.membership_date)) || new Date();

  const studentResult = await client.query(`
          INSERT INTO students (
            id, name, father_name, contact_number, sex, 
            seat_number, membership_date, membership_till, membership_status,
            aadhaar_number, address, modified_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
            aadhaar_number = COALESCE(NULLIF(EXCLUDED.aadhaar_number, ''), students.aadhaar_number),
            address = COALESCE(NULLIF(EXCLUDED.address, ''), students.address),
            modified_by = EXCLUDED.modified_by,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          memberId,
          (memberName || '').toString().substring(0, 100).toUpperCase(),
          (getColumnValue(member, memberColumnMappings.father_name) || '').toString().substring(0, 100).toUpperCase(),
          // Ensure contact number is exactly 10 digits; default to '1234567890' when invalid/missing
          (normalizeContact(getColumnValue(member, memberColumnMappings.contact_number)) || '1234567890'),
          memberSex || null,
          (seatNumber || '').toString().substring(0, 20),
          membershipDateVal,
          parseExcelDate(getColumnValue(member, memberColumnMappings.membership_till)),
          ['active', 'expired', 'suspended'].includes(membershipStatus) 
            ? membershipStatus 
            : 'active',
          aadhaarNumber,
          addressVal,
          req.user.userId || req.user.id
        ]);

        if (seatNumber && studentResult.rows[0]) {
          const cleanSeatNumber = String(seatNumber).substring(0, 20);
          const studentGender = memberSex || null;

          const seatExistsResult = await client.query(`
            SELECT seat_number, occupant_sex FROM seats WHERE seat_number = $1
          `, [cleanSeatNumber]);

          if (seatExistsResult.rows.length === 0) {
            await client.query(`
              INSERT INTO seats (seat_number, occupant_sex, created_at, updated_at, modified_by)
              VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3)
            `, [cleanSeatNumber, studentGender || null, req.user.userId || req.user.id]);
          }

          await client.query(`
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
        }

        importedCount++;
        memberImported++;

        if ((i + 1) % 50 === 0) {
          logger.info('Members import progress', { requestId, processed: i + 1, total: membersData.length });
        }
      }

      // Renewals
      const renewalsData = xlsx.utils.sheet_to_json(workbook.Sheets[renewalsSheetName]);
      logger.info('Processing renewals', { requestId, total: renewalsData.length });

      for (let i = 0; i < renewalsData.length; i++) {
        const renewal = renewalsData[i];
        const studentId = getColumnValue(renewal, renewalColumnMappings.id);
        const amount = getColumnValue(renewal, renewalColumnMappings.amount_paid);
        const paymentDate = getColumnValue(renewal, renewalColumnMappings.payment_date);
        const paymentMode = getColumnValue(renewal, renewalColumnMappings.payment_mode);
        const seatNumber = getColumnValue(renewal, renewalColumnMappings.seat_number);

        if (!studentId || !amount) {
          renewalSkipped++;
          continue;
        }

        const studentCheckResult = await client.query(`SELECT id FROM students WHERE id = $1`, [studentId]);
        if (studentCheckResult.rows.length === 0) {
          renewalSkipped++;
          continue;
        }

        await client.query(`
          INSERT INTO payments (
            student_id, amount, payment_date, payment_mode, description, modified_by,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          studentId,
          Math.max(0, parseFloat(amount || 0)),
          parseExcelDate(paymentDate) || new Date(),
          ['cash', 'online'].includes((paymentMode || 'cash').toLowerCase()) ? (paymentMode || 'cash').toLowerCase() : 'cash',
          `Renewal payment - Seat ${String(seatNumber || 'N/A').substring(0, 100)}`,
          req.user.userId || req.user.id
        ]);

        importedCount++;
        renewalImported++;

        if ((i + 1) % 50 === 0) {
          logger.info('Renewals import progress', { requestId, processed: i + 1, total: renewalsData.length });
        }
      }

      await client.query('COMMIT');
      logger.info('Import committed', { requestId, importedCount, memberImported, renewalImported, memberSkipped, renewalSkipped, durationMs: Date.now() - startTime });

      const totalSkipped = memberSkipped + renewalSkipped;
      const message = totalSkipped > 0 ? `Import completed! ${importedCount} records imported, ${totalSkipped} records skipped due to missing data.` : `Import completed successfully! All ${importedCount} records imported.`;

      res.json({
        message,
        imported: importedCount,
        skipped: totalSkipped,
        members: { total: membersData.length, imported: memberImported, skipped: memberSkipped, errors: 0 },
        renewals: { total: renewalsData.length, imported: renewalImported, skipped: renewalSkipped, errors: 0 },
        success: true,
        allOrNothing: true,
        requestId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Import failed', { requestId, error: error.message });
      res.status(400).json({ message: `Import failed: ${error.message}. No data was imported.`, success: false, allOrNothing: true, error: error.message, requestId });
    } finally {
      client.release();
    }
  });

  // Export Excel
  router.get('/export-excel', auth, requireAdmin, async (req, res) => {
    const requestId = `admin-export-${Date.now()}`;
    try {
      logger.info('Starting export-excel', { requestId });
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

      const workbook = xlsx.utils.book_new();
      const membersSheet = xlsx.utils.json_to_sheet(studentsResult.rows);
      xlsx.utils.book_append_sheet(workbook, membersSheet, 'Library Members');
      const renewalsSheet = xlsx.utils.json_to_sheet(paymentsResult.rows);
      xlsx.utils.book_append_sheet(workbook, renewalsSheet, 'Renewals');

      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="library-data-export.xlsx"');
      res.send(buffer);

      logger.info('Export completed', { requestId });
    } catch (error) {
      logger.error('Export error', { error: error.message });
      res.status(500).json({ error: 'Export failed: ' + error.message });
    }
  });

  // Clean database
  router.post('/clean-database', auth, requireAdmin, async (req, res) => {
    const requestId = `clean-db-${Date.now()}`;
    logger.info('Starting clean-database', { requestId });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tablesResult = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name != 'users'
      `);
      const tableNames = tablesResult.rows.map(row => row.table_name);
      logger.info('Tables to clean', { requestId, tables: tableNames });

      // Disable user-defined triggers
      for (const table of tableNames) {
        const triggersResult = await client.query(`
          SELECT tgname FROM pg_trigger 
          WHERE tgrelid = 'public."${table}"'::regclass 
            AND NOT tgisinternal 
            AND tgname NOT LIKE 'RI_ConstraintTrigger%'
        `);
        for (const trig of triggersResult.rows) {
          await client.query(`ALTER TABLE "${table}" DISABLE TRIGGER "${trig.tgname}"`);
        }
      }

      // Delete in safe order
      const ordered = [];
      if (tableNames.includes('payments')) ordered.push('payments');
      if (tableNames.includes('expenses')) ordered.push('expenses');
      if (tableNames.includes('students')) ordered.push('students');
      for (const t of tableNames) if (!ordered.includes(t)) ordered.push(t);
      for (const table of ordered) {
        await client.query(`DELETE FROM "${table}"`);
      }

      // Enable triggers back
      for (const table of tableNames) {
        const triggersResult = await client.query(`
          SELECT tgname FROM pg_trigger 
          WHERE tgrelid = 'public."${table}"'::regclass 
            AND NOT tgisinternal 
            AND tgname NOT LIKE 'RI_ConstraintTrigger%'
        `);
        for (const trig of triggersResult.rows) {
          await client.query(`ALTER TABLE "${table}" ENABLE TRIGGER "${trig.tgname}"`);
        }
      }

      // Restart sequences
      const seqResult = await client.query(`SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'`);
      for (const seq of seqResult.rows) {
        await client.query(`ALTER SEQUENCE "${seq.sequence_name}" RESTART WITH 1`);
      }
      await client.query(`ALTER SEQUENCE students_id_seq RESTART WITH 20250001`);

      await client.query('COMMIT');
      logger.info('Database cleaned', { requestId });

      // Run setup-database.js
      const setupProcess = spawn('node', ['setup-database.js'], {
        cwd: require('path').resolve(__dirname, '..'),
        shell: true
      });

      let output = '';
      let errorOutput = '';
      setupProcess.stdout.on('data', (data) => {
        output += data.toString();
        logger.info('[setup-database] stdout', { data: data.toString() });
      });
      setupProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        logger.error('[setup-database] stderr', { data: data.toString() });
      });
      setupProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('setup-database executed successfully', { requestId });
          res.json({ message: 'Database cleaned and setup-database.js executed successfully', setupOutput: output });
        } else {
          logger.error('setup-database failed', { requestId, errorOutput });
          res.status(500).json({ error: 'Database cleaned but setup-database.js failed', setupError: errorOutput });
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cleaning database', { requestId, error: error.message });
      res.status(500).json({ error: 'Failed to clean database', details: error.message });
    } finally {
      client.release();
    }
  });
};
