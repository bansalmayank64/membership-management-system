const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { toISTDateString } = require('../utils/dateUtils');

// Helper: prefer membership_till if present, otherwise use canonical membership_date, otherwise today
const getMembershipBaseDate = (student) => {
  try {
    if (student && student.membership_till) {
      const d = new Date(student.membership_till);
      if (!isNaN(d.getTime())) return d;
    }

    if (student && student.membership_date) {
      const sd = new Date(student.membership_date);
      if (!isNaN(sd.getTime())) return sd;
    }

    return new Date();
  } catch (err) {
    return new Date();
  }
};

const router = express.Router();

// GET /api/payments - Get all payments
router.get('/', async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/payments', req);
  try {
    rl.businessLogic('Preparing database query for paginated/filtered payments');

    // Parse pagination and filter params
    const page = parseInt(req.query.page, 10) || 0; // zero-based
    const pageSize = parseInt(req.query.pageSize, 10) || 25;
    const seatNumber = req.query.seatNumber || null;
    const studentName = req.query.studentName || null;
    const studentId = req.query.studentId || null;
  const startDate = req.query.startDate || null; // expected YYYY-MM-DD
  const endDate = req.query.endDate || null; // expected YYYY-MM-DD
  const paymentMode = req.query.paymentMode || null; // 'cash' or 'online'

    // Build WHERE clauses
    const whereClauses = [];
    const params = [];
    let idx = 1;

    if (seatNumber) {
      whereClauses.push(`s.seat_number::text ILIKE $${idx++}`);
      params.push(`%${seatNumber}%`);
    }
    if (studentName) {
      whereClauses.push(`s.name ILIKE $${idx++}`);
      params.push(`%${studentName}%`);
    }
    if (studentId) {
      whereClauses.push(`p.student_id::text ILIKE $${idx++}`);
      params.push(`%${studentId}%`);
    }
    if (startDate) {
      whereClauses.push(`p.payment_date >= $${idx++}`);
      params.push(startDate + ' 00:00:00');
    }
    if (endDate) {
      whereClauses.push(`p.payment_date <= $${idx++}`);
      params.push(endDate + ' 23:59:59');
    }
    if (paymentMode) {
      // Case-insensitive match on payment_mode
      whereClauses.push(`LOWER(p.payment_mode) = LOWER($${idx++})`);
      params.push(paymentMode);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total matching rows
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      ${whereSQL}
    `;
    rl.queryStart('Count payments query', countQuery, params);
    const countStart = Date.now();
    const countResult = await pool.query(countQuery, params);
    rl.querySuccess('Count payments query', countStart, countResult, true);
    const total = parseInt(countResult.rows[0].total, 10) || 0;

    // Fetch page
    const offset = page * pageSize;
    const dataQuery = `
      SELECT 
        p.*,
        s.name as student_name,
        s.seat_number,
        s.contact_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      ${whereSQL}
      ORDER BY p.payment_date DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(pageSize, offset);
    rl.queryStart('Fetch payments page', dataQuery, params);
    const dataStart = Date.now();
    const dataResult = await pool.query(dataQuery, params);
    rl.querySuccess('Fetch payments page', dataStart, dataResult, true);

    rl.success({ payments: dataResult.rows, total });
    res.json({ payments: dataResult.rows, total });
  } catch (error) {
  rl.error(error);
  res.status(500).json({ error: 'Failed to fetch payments', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

// GET /api/payments/student/:studentId - Get payments for a specific student
router.get('/student/:studentId', async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/payments/student/:studentId', req);
  try {
    const { studentId } = req.params;
    rl.validationStart('Validating student ID parameter');
    if (!studentId) {
      rl.validationError('studentId', ['Student ID is required']);
      return res.status(400).json({ error: 'Valid student ID is required', requestId: rl.requestId, timestamp: new Date().toISOString() });
    }

    rl.businessLogic('Preparing database query for student payments');
    const query = `
      SELECT 
        p.*,
        s.name as student_name,
        s.seat_number,
        s.contact_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      WHERE p.student_id = $1
      ORDER BY p.payment_date DESC
    `;
    const queryStart = rl.queryStart('Execute student payments query', query, [studentId]);
    const result = await pool.query(query, [studentId]);
    rl.querySuccess('Execute student payments query', queryStart, result, true);

    rl.success(result.rows);
    res.json(result.rows);
  } catch (error) {
    rl.error(error);
    res.status(500).json({ error: 'Failed to fetch student payments', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

// POST /api/payments - Create a new payment
router.post('/', async (req, res) => {
  const rl = logger.createRequestLogger('POST', '/api/payments', req);
  try {
    const {
      student_id,
      amount,
      payment_date,
      payment_mode,
      payment_type,
      remarks,
      modified_by,
      extend_membership = false // New field for membership extension
    } = req.body;

    rl.validationStart('Validating payment data');
    
    // Enhanced validation with database schema constraints
    const validationErrors = [];

    // Student ID validation - REFERENCES students(id)
    if (!student_id || isNaN(student_id)) {
      validationErrors.push('Valid student ID is required (must be a number)');
    }

    // Amount validation - NUMERIC(10,2) NOT NULL
    if (!amount) {
      validationErrors.push('Payment amount is required');
    } else if (isNaN(amount)) {
      validationErrors.push('Amount must be a valid number');
    } else {
      const numAmount = parseFloat(amount);
      if (numAmount === 0) {
        validationErrors.push('Amount cannot be zero');
      } else if (Math.abs(numAmount) > 99999999.99) {
        validationErrors.push('Amount exceeds maximum allowed value (99,999,999.99)');
      } else if (Math.abs(numAmount) < 0.01) {
        validationErrors.push('Amount must be at least 0.01');
      }
      // Check decimal places (NUMERIC(10,2) allows 2 decimal places)
      const decimalParts = amount.toString().split('.');
      if (decimalParts[1] && decimalParts[1].length > 2) {
        validationErrors.push('Amount can have maximum 2 decimal places');
      }
      // Additional business rules for refunds
      if (payment_type === 'refund' && numAmount > 0) {
        // Allow positive refund amounts, will be converted to negative automatically
      } else if (payment_type === 'monthly_fee' && numAmount < 0) {
        validationErrors.push('Monthly fee payments cannot have negative amounts');
      }
    }

    // Payment date validation - TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    // Normalize: if client sent only a date (YYYY-MM-DD), preserve that date but use the current server time for hours/minutes/seconds
    let normalizedPaymentDate = null;
    if (!payment_date) {
      validationErrors.push('Payment date is required');
    } else {
      const asString = String(payment_date).trim();
      // Detect date-only strings like '2025-09-12'
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(asString);
      if (isDateOnly) {
        const now = new Date();
        const parts = asString.split('-').map(Number);
        // Construct a Date in server local timezone using provided date and current time
        const dt = new Date(parts[0], parts[1] - 1, parts[2], now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        if (isNaN(dt.getTime())) {
          validationErrors.push('Payment date must be a valid date');
        } else {
          normalizedPaymentDate = dt;
        }
      } else {
        const tentative = new Date(asString);
        if (isNaN(tentative.getTime())) {
          validationErrors.push('Payment date must be a valid date');
        } else {
          normalizedPaymentDate = tentative;
        }
      }
    }

    // Payment mode validation - CHECK (payment_mode IN ('cash','online')) DEFAULT 'cash'
    if (!payment_mode) {
      validationErrors.push('Payment mode is required');
    } else if (!['cash', 'online', 'CASH', 'ONLINE'].includes(payment_mode)) {
      validationErrors.push('Payment mode must be either "cash" or "online" (database constraint)');
    }

    // Payment type validation - CHECK (payment_type IN ('monthly_fee','refund'))
    if (!payment_type) {
      validationErrors.push('Payment type is required');
    } else if (!['monthly_fee', 'refund'].includes(payment_type)) {
      validationErrors.push('Payment type must be either "monthly_fee" or "refund"');
    }

    // Remarks validation (optional) - TEXT field
    if (remarks && typeof remarks === 'string' && remarks.length > 10000) {
      validationErrors.push('Remarks cannot exceed 10,000 characters');
    }

    if (validationErrors.length > 0) {
      rl.validationError('payment', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, received: { student_id, amount, payment_date, payment_mode, payment_type, remarks }, timestamp: new Date().toISOString() });
    }

    rl.transactionStart();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const normalizedPaymentMode = payment_mode.toLowerCase();
      rl.businessLogic('Verifying student exists and getting details');
  const studentCheckQuery = 'SELECT id, name, sex, membership_till, membership_type, membership_date FROM students WHERE id = $1';
      const studentCheck = await client.query(studentCheckQuery, [student_id]);
      if (studentCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        rl.validationError('student_id', [`Student with ID ${student_id} not found`]);
        return res.status(400).json({ 
          error: `Student with ID ${student_id} not found`, 
          details: [`Student with ID ${student_id} does not exist in the database`],
          requestId: rl.requestId, 
          timestamp: new Date().toISOString() 
        });
      }
      const student = studentCheck.rows[0];
      rl.info('Student verified', { studentId: student.id, name: student.name, gender: student.sex });

      // Fetch fee configuration early to enforce free membership (monthly fee = 0) restriction
      let monthlyFees = null;
      try {
        if (student.membership_type) {
          const feeCfgQuery = 'SELECT male_monthly_fees, female_monthly_fees FROM student_fees_config WHERE membership_type = $1 AND is_active = TRUE';
          const feeCfgRes = await client.query(feeCfgQuery, [student.membership_type]);
          if (feeCfgRes.rows.length > 0) {
            const cfg = feeCfgRes.rows[0];
            monthlyFees = parseFloat(student.sex === 'male' ? cfg.male_monthly_fees : cfg.female_monthly_fees);
            if (isNaN(monthlyFees)) monthlyFees = null;
          }
        }
      } catch (feeErr) {
        rl.warn('Failed to fetch fee configuration while validating payment', { error: feeErr.message });
      }

      // If monthly fee is explicitly zero, block ALL payments (both monthly_fee and refund) per business rule
      if (monthlyFees !== null && !isNaN(monthlyFees) && monthlyFees <= 0) {
        rl.validationError('payment', ['Payments are disabled for free membership students (monthly fee = 0)']);
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Payments are disabled for free membership students (monthly fee = 0)',
          requestId: rl.requestId,
          timestamp: new Date().toISOString()
        });
      }

      // Enhanced refund validation - check if refund amount exceeds total payments
      if (payment_type === 'refund') {
        rl.businessLogic('Validating refund amount against total payments for student');
        const totalPaymentsQuery = `
          SELECT COALESCE(SUM(amount), 0) as total_paid 
          FROM payments 
          WHERE student_id = $1 AND payment_type = 'monthly_fee' AND amount > 0
        `;
        const totalPaymentsResult = await client.query(totalPaymentsQuery, [student_id]);
        const totalPaid = parseFloat(totalPaymentsResult.rows[0].total_paid) || 0;
        const refundAmount = Math.abs(parseFloat(amount));
        
        if (refundAmount > totalPaid) {
          rl.validationError('refund', [`Refund amount (${refundAmount}) cannot exceed total payments (${totalPaid})`]);
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Refund amount cannot exceed total payments made by student',
            details: [`Refund amount: ${refundAmount}, Total paid: ${totalPaid}`],
            requestId: rl.requestId,
            timestamp: new Date().toISOString()
          });
        }
        rl.info('Refund validation passed', { refundAmount, totalPaid, studentId: student_id });
      }

      let membershipExtensionDays = 0;
      // Handle membership extension for monthly fee payments
      if (extend_membership && payment_type === 'monthly_fee') {
        rl.businessLogic('Processing membership extension');
        // Determine membership_type for student (default to 'full_time' if missing)
        const membershipType = student.membership_type;
        const feeConfigQuery = 'SELECT male_monthly_fees, female_monthly_fees FROM student_fees_config WHERE membership_type = $1 AND is_active = TRUE';
        const feeConfigResult = await client.query(feeConfigQuery, [membershipType]);
        if (feeConfigResult.rows.length > 0) {
          const cfg = feeConfigResult.rows[0];
          const monthlyFees = parseFloat(student.sex === 'male' ? cfg.male_monthly_fees : cfg.female_monthly_fees);
          const paymentAmount = Math.abs(parseFloat(amount));
          if (monthlyFees > 0) {
            membershipExtensionDays = Math.floor((paymentAmount / monthlyFees) * 30);
          } else {
            membershipExtensionDays = 0; // Guard against division by zero
          }
          rl.info('Membership extension calculated', { monthlyFees, paymentAmount, membershipExtensionDays });
            if (membershipExtensionDays > 0) {
            const currentMembershipTill = getMembershipBaseDate(student);
            const newMembershipTill = new Date(currentMembershipTill);
            newMembershipTill.setDate(newMembershipTill.getDate() + membershipExtensionDays);
            const updateMembershipQuery = 'UPDATE students SET membership_till = $1 WHERE id = $2';
            await client.query(updateMembershipQuery, [toISTDateString(newMembershipTill), student_id]);
            rl.info('Extended membership', { studentId: student_id, newMembershipTill: newMembershipTill.toISOString(), membershipExtensionDays });
          }
        } else {
          rl.warn('No fee configuration found for gender', { gender: student.sex });
        }
      }

      // Handle membership reduction for refunds when requested
      if (extend_membership && payment_type === 'refund') {
        rl.businessLogic('Processing membership reduction for refund');
        const membershipType = student.membership_type;
        const feeConfigQuery = 'SELECT male_monthly_fees, female_monthly_fees FROM student_fees_config WHERE membership_type = $1 AND is_active = TRUE';
        const feeConfigResult = await client.query(feeConfigQuery, [membershipType]);
        if (feeConfigResult.rows.length > 0) {
          const cfg = feeConfigResult.rows[0];
          const monthlyFees = parseFloat(student.sex === 'male' ? cfg.male_monthly_fees : cfg.female_monthly_fees);
          const paymentAmount = Math.abs(parseFloat(amount));
          const membershipReductionDays = monthlyFees > 0 ? Math.floor((paymentAmount / monthlyFees) * 30) : 0; // Guard division by zero
          rl.info('Membership reduction calculated', { monthlyFees, paymentAmount, membershipReductionDays });
          if (membershipReductionDays > 0) {
            const currentMembershipTill = getMembershipBaseDate(student);
            const newMembershipTill = new Date(currentMembershipTill);
            newMembershipTill.setDate(newMembershipTill.getDate() - membershipReductionDays);
            const updateMembershipQuery = 'UPDATE students SET membership_till = $1 WHERE id = $2';
            await client.query(updateMembershipQuery, [toISTDateString(newMembershipTill), student_id]);
            rl.info('Reduced membership', { studentId: student_id, newMembershipTill: newMembershipTill.toISOString(), membershipReductionDays });
            // Store the reduction value in membershipExtensionDays for description reuse
            membershipExtensionDays = -membershipReductionDays;
          }
        } else {
          rl.warn('No fee configuration found for gender', { gender: student.sex });
        }
      }

      let finalAmount = parseFloat(amount);
      if (payment_type === 'monthly_fee') {
        finalAmount = Math.abs(finalAmount);
      } else if (payment_type === 'refund') {
        finalAmount = -Math.abs(finalAmount);
      }

      // Enhanced duplicate payment detection
      rl.businessLogic('Checking for duplicate payments');
      const duplicateCheckQuery = `
        SELECT id FROM payments 
        WHERE student_id = $1 
          AND ABS(amount - $2) < 0.01 
          AND payment_type = $3 
          AND payment_date >= CURRENT_DATE - INTERVAL '1 minute'
      `;
      const duplicateCheck = await client.query(duplicateCheckQuery, [student_id, finalAmount, payment_type]);
      if (duplicateCheck.rows.length > 0) {
        rl.validationError('duplicate', ['Duplicate payment detected within the last minute']);
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Duplicate payment detected',
          details: ['A similar payment was already recorded within the last minute'],
          requestId: rl.requestId,
          timestamp: new Date().toISOString()
        });
      }

      rl.businessLogic('Inserting payment record with referential integrity checks');
      const paymentQuery = `
        INSERT INTO payments (
          student_id, amount, payment_date, payment_mode, payment_type, description, modified_by,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const paymentValues = [
        student_id,
        finalAmount,
        normalizedPaymentDate || payment_date, // prefer normalized Date (with time) when available
        normalizedPaymentMode,
        payment_type,
        remarks || `${payment_type === 'monthly_fee' ? 'Monthly fee' : 'Refund'} payment for ${student.name}${membershipExtensionDays > 0 ? ` (Extended membership by ${membershipExtensionDays} days)` : membershipExtensionDays < 0 ? ` (Reduced membership by ${Math.abs(membershipExtensionDays)} days)` : ''}`,
        req.user?.userId || req.user?.id || 1
      ];

      rl.queryStart('Insert payment', paymentQuery, paymentValues);
      const paymentResult = await client.query(paymentQuery, paymentValues);
      
      // Verify the payment was inserted correctly
      if (paymentResult.rows.length === 0) {
        throw new Error('Payment insertion failed - no rows returned');
      }
      
      const insertedPayment = paymentResult.rows[0];
      
      // Additional verification - check if the payment-student relationship is maintained
      const verificationQuery = `
        SELECT p.id, p.student_id, p.amount, s.name as student_name 
        FROM payments p 
        JOIN students s ON p.student_id = s.id 
        WHERE p.id = $1
      `;
      const verificationResult = await client.query(verificationQuery, [insertedPayment.id]);
      if (verificationResult.rows.length === 0) {
        throw new Error('Payment-student relationship verification failed');
      }
      
      rl.transactionCommit();
      await client.query('COMMIT');

      rl.success(insertedPayment);
      res.status(201).json({
        ...insertedPayment,
        student_name: student.name,
        membership_extension_days: membershipExtensionDays
      });
    } catch (error) {
      await client.query('ROLLBACK');
      rl.transactionRollback(error.message);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    rl.error(error);
  logger.error('Error creating payment', { error: error.message, stack: error.stack });
  res.status(500).json({ error: 'Failed to create payment: ' + error.message });
  }
});

// PUT /api/payments/:id - Update payment (partial updates supported)
router.put('/:id', async (req, res) => {
  const rl = logger.createRequestLogger('PUT', '/api/payments/:id', req);
  try {
    const { id } = req.params;
    const {
      student_id,
      amount,
      payment_date,
      payment_mode,
      description,
      modified_by
    } = req.body;

    rl.validationStart('Validating input parameters for payment update (partial)');
    const validationErrors = [];

    // ID validation
    if (!id || isNaN(id)) {
      validationErrors.push('Valid payment ID is required');
      rl.validationError('id', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, requestId: rl.requestId, timestamp: new Date().toISOString() });
    }

    // Fetch existing payment first
    const existingPaymentQuery = `
      SELECT p.*, s.name as student_name 
      FROM payments p 
      LEFT JOIN students s ON p.student_id = s.id 
      WHERE p.id = $1
    `;
    const existingPaymentResult = await pool.query(existingPaymentQuery, [id]);
    if (existingPaymentResult.rows.length === 0) {
      rl.warn('Payment not found for update', { paymentId: id });
      return res.status(404).json({ error: 'Payment not found', requestId: rl.requestId, timestamp: new Date().toISOString() });
    }

    const existingPayment = existingPaymentResult.rows[0];
    if (!existingPayment.student_name) {
      rl.error('Payment-student relationship integrity violation', { paymentId: id, studentId: existingPayment.student_id });
      return res.status(400).json({ 
        error: 'Payment-student relationship integrity violation', 
        details: [`Payment ${id} references non-existent student ${existingPayment.student_id}`],
        requestId: rl.requestId, 
        timestamp: new Date().toISOString() 
      });
    }

    // If student_id is provided, verify student exists
    if (student_id !== undefined && student_id !== null) {
      if (isNaN(student_id)) {
        validationErrors.push('student_id must be a number when provided');
      } else {
        const newStudentQuery = 'SELECT id, name, membership_date FROM students WHERE id = $1';
        const newStudentResult = await pool.query(newStudentQuery, [student_id]);
        if (newStudentResult.rows.length === 0) {
          validationErrors.push(`Student with ID ${student_id} not found`);
        }
      }
    }

    // Validate provided amount (only when present)
    let parsedAmount = undefined;
    if (amount !== undefined && amount !== null) {
      if (isNaN(amount)) {
        validationErrors.push('Amount must be a valid number when provided');
      } else {
        parsedAmount = parseFloat(amount);
        if (parsedAmount <= 0) validationErrors.push('Amount must be a positive number');
        if (Math.abs(parsedAmount) > 99999999.99) validationErrors.push('Amount exceeds maximum allowed value (99,999,999.99)');
        const decimalParts = amount.toString().split('.');
        if (decimalParts[1] && decimalParts[1].length > 2) validationErrors.push('Amount can have maximum 2 decimal places');
      }
    }

    // Validate payment_mode when provided
    let normalizedMode = undefined;
    if (payment_mode !== undefined && payment_mode !== null) {
      if (!['cash', 'online', 'CASH', 'ONLINE'].includes(payment_mode)) {
        validationErrors.push('Payment mode must be either "cash" or "online" when provided');
      } else {
        normalizedMode = payment_mode.toLowerCase();
      }
    }

    // Validate payment_date when provided (and parse)
    let parsedPaymentDate = undefined;
    if (payment_date !== undefined && payment_date !== null) {
      const asString = String(payment_date).trim();
      const tentative = new Date(asString);
      if (isNaN(tentative.getTime())) {
        validationErrors.push('Payment date must be a valid date when provided');
      } else {
        // If client provided a date-only string (YYYY-MM-DD), preserve the original time component
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(asString);
        if (isDateOnly && existingPayment.payment_date) {
          const existingDt = new Date(existingPayment.payment_date);
          const newDt = new Date(asString + 'T00:00:00');
          newDt.setHours(existingDt.getHours(), existingDt.getMinutes(), existingDt.getSeconds(), existingDt.getMilliseconds());
          parsedPaymentDate = newDt;
        } else {
          parsedPaymentDate = tentative;
        }
      }
    }

    if (validationErrors.length > 0) {
      rl.validationError('update', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, requestId: rl.requestId, timestamp: new Date().toISOString() });
    }

    // Build dynamic update only for changed fields
    const setClauses = [];
    const values = [];
    let idx = 1;

    // student_id
    if (student_id !== undefined && student_id !== null && Number(student_id) !== Number(existingPayment.student_id)) {
      setClauses.push(`student_id = $${idx++}`);
      values.push(Number(student_id));
    }

    // amount
    if (parsedAmount !== undefined && Number(parsedAmount) !== Number(existingPayment.amount)) {
      setClauses.push(`amount = $${idx++}`);
      values.push(parsedAmount);
    }

    // payment_date
    if (parsedPaymentDate !== undefined) {
      const existingTs = existingPayment.payment_date ? new Date(existingPayment.payment_date).getTime() : null;
      if (existingTs === null || parsedPaymentDate.getTime() !== existingTs) {
        setClauses.push(`payment_date = $${idx++}`);
        values.push(parsedPaymentDate);
      }
    }

    // payment_mode
    if (normalizedMode !== undefined && existingPayment.payment_mode && normalizedMode !== String(existingPayment.payment_mode).toLowerCase()) {
      setClauses.push(`payment_mode = $${idx++}`);
      values.push(normalizedMode);
    } else if (normalizedMode !== undefined && !existingPayment.payment_mode) {
      setClauses.push(`payment_mode = $${idx++}`);
      values.push(normalizedMode);
    }

    // description
    if (description !== undefined && description !== null && String(description) !== String(existingPayment.description)) {
      setClauses.push(`description = $${idx++}`);
      values.push(description);
    }

    // If nothing to update, return existing row
    if (setClauses.length === 0) {
      rl.info('No fields changed - skipping update', { paymentId: id });
      return res.json(existingPayment);
    }

    // Always set modified_by when performing an update
    setClauses.push(`modified_by = $${idx++}`);
    values.push(req.user?.userId || req.user?.id || 1);

    const updateQuery = `UPDATE payments SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx++} RETURNING *`;
    values.push(id);

    const queryStart = rl.queryStart('Execute payment partial update', updateQuery, values);
    const result = await pool.query(updateQuery, values);
    rl.querySuccess('Execute payment partial update', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('Payment not found for update after verification', { paymentId: id });
      return res.status(404).json({ error: 'Payment not found', requestId: rl.requestId, timestamp: new Date().toISOString() });
    }

    rl.success(result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    rl.error(error, { paymentId: req.params.id, requestBody: req.body });
    res.status(500).json({ error: 'Failed to update payment', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/payments/:id - Delete payment
router.delete('/:id', async (req, res) => {
  const rl = logger.createRequestLogger('DELETE', '/api/payments/:id', req);
  try {
    const { id } = req.params;
    rl.info('Delete payment request', { paymentId: id, user: req.user?.userId || req.user?.id || 'unknown' });

    if (!id || isNaN(id)) {
      rl.validationError('delete', ['Invalid payment ID']);
      return res.status(400).json({ error: 'Valid payment ID is required', requestId: rl.requestId, timestamp: new Date().toISOString() });
    }
    // Use transaction: fetch payment, delete it, then update student.membership_till if applicable
    rl.transactionStart();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fetchQuery = 'SELECT * FROM payments WHERE id = $1 FOR UPDATE';
      const fetchStart = rl.queryStart('Fetch payment for delete', fetchQuery, [id]);
      const fetchRes = await client.query(fetchQuery, [id]);
      rl.querySuccess('Fetch payment for delete', fetchStart, fetchRes, true);

      if (fetchRes.rows.length === 0) {
        await client.query('ROLLBACK');
        rl.transactionRollback('Payment not found');
        rl.warn('Payment not found for delete', { paymentId: id });
        return res.status(404).json({ error: 'Payment not found', requestId: rl.requestId, timestamp: new Date().toISOString() });
      }

      const payment = fetchRes.rows[0];

      const deleteQuery = 'DELETE FROM payments WHERE id = $1 RETURNING *';
      rl.queryStart('Delete payment', deleteQuery, [id]);
      const delRes = await client.query(deleteQuery, [id]);
      rl.querySuccess('Delete payment', null, delRes, true);

      // If payment is tied to a student and can affect membership, attempt to adjust membership_till
      try {
        if (payment.student_id && payment.payment_type) {
                const studentFetch = await client.query('SELECT id, sex, membership_till, membership_type, membership_date FROM students WHERE id = $1 FOR UPDATE', [payment.student_id]);
          if (studentFetch.rows.length > 0) {
            const student = studentFetch.rows[0];
            
            // Verify student-payment relationship integrity
            if (!student.id) {
              throw new Error(`Student relationship integrity violation for payment ${payment.id}`);
            }
            
            // Lookup fee config for student's membership type and gender
            const membershipType = student.membership_type;
            if (!membershipType) {
              rl.warn('Student has no membership type - skipping membership adjustment', { studentId: student.id });
            } else {
              const feeCfg = await client.query('SELECT male_monthly_fees, female_monthly_fees FROM student_fees_config WHERE membership_type = $1 AND is_active = TRUE', [membershipType]);
              if (feeCfg.rows.length > 0) {
                const cfg = feeCfg.rows[0];
                const monthlyFees = parseFloat(student.sex === 'male' ? cfg.male_monthly_fees : cfg.female_monthly_fees);
                
                if (monthlyFees > 0) {
                  const amountAbs = Math.abs(Number(payment.amount || 0));
                  const adjustDays = Math.floor((amountAbs / monthlyFees) * 30);
                  
                  if (adjustDays > 0) {
                    const currentMembershipTill = getMembershipBaseDate(student);
                    const newMembershipTill = new Date(currentMembershipTill);

                    // Reverse the original operation when deleting
                    if (payment.payment_type === 'monthly_fee' && Number(payment.amount) > 0) {
                      // Deleting a monthly fee (which extended membership) -> reduce membership
                      newMembershipTill.setDate(newMembershipTill.getDate() - adjustDays);
                      rl.info('Reversing membership extension for deleted monthly fee payment', { 
                        paymentId: payment.id, 
                        adjustDays: -adjustDays,
                        originalAmount: payment.amount 
                      });
                    } else if (payment.payment_type === 'refund' && Number(payment.amount) < 0) {
                      // Deleting a refund (which reduced membership) -> add back days
                      newMembershipTill.setDate(newMembershipTill.getDate() + adjustDays);
                      rl.info('Reversing membership reduction for deleted refund payment', { 
                        paymentId: payment.id, 
                        adjustDays: adjustDays,
                        originalAmount: payment.amount 
                      });
                    }

                    // Validate the new membership date
                    if (isNaN(newMembershipTill.getTime())) {
                      throw new Error('Invalid membership date calculation during payment deletion');
                    }

                    // Persist updated membership_till (store date part only)
                    const newDateStr = toISTDateString(newMembershipTill);
                    try {
                      const updRes = await client.query('UPDATE students SET membership_till = $1 WHERE id = $2 RETURNING *', [newDateStr, student.id]);
                      if (updRes.rows.length === 0) {
                        throw new Error('Failed to update student membership_till during payment delete - no rows affected');
                      }
                      rl.info('Successfully updated student membership_till on payment delete', { 
                        studentId: student.id, 
                        old: student.membership_till, 
                        new: updRes.rows[0].membership_till,
                        paymentId: payment.id
                      });
                    } catch (persistErr) {
                      rl.error(persistErr, { context: 'persist membership update', studentId: student.id });
                      throw new Error(`Membership update failed during payment deletion: ${persistErr.message}`);
                    }
                  } else {
                    rl.info('Computed 0 adjustment days; skipping membership update', { 
                      paymentId: id, 
                      amount: payment.amount, 
                      monthlyFees, 
                      amountAbs 
                    });
                  }
                } else {
                  rl.warn('Invalid or zero monthly_fees configuration; skipping membership update', { 
                    gender: student.sex, 
                    monthlyFees, 
                    membershipType 
                  });
                }
              } else {
                rl.warn('No fee configuration found for membership type; skipping membership update', { 
                  membershipType, 
                  gender: student.sex 
                });
              }
            }
          } else {
            rl.warn('Student not found for payment; skipping membership update', { 
              studentId: payment.student_id, 
              paymentId: payment.id 
            });
          }
        } else {
          rl.info('Payment has no student relationship or payment type; skipping membership update', { 
            paymentId: payment.id,
            studentId: payment.student_id,
            paymentType: payment.payment_type
          });
        }
      } catch (innerErr) {
        // Log detailed error information for debugging
        rl.error(innerErr, { 
          context: 'membership update after payment delete',
          paymentId: payment.id,
          studentId: payment.student_id,
          paymentType: payment.payment_type,
          paymentAmount: payment.amount
        });
        throw new Error(`Membership update failed during payment deletion: ${innerErr.message || String(innerErr)}`);
      }

      await client.query('COMMIT');
      rl.transactionCommit();

      rl.success(delRes.rows[0]);
      res.json({ message: 'Payment deleted successfully', payment: delRes.rows[0], requestId: rl.requestId, timestamp: new Date().toISOString() });
    } catch (error) {
      await client.query('ROLLBACK');
      rl.transactionRollback(error.message);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    rl.error(error, { paymentId: req.params.id });
    res.status(500).json({ error: 'Failed to delete payment', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

// GET /api/payments/summary - Get payment summary/statistics
router.get('/summary/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_payments,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        COUNT(CASE WHEN payment_mode = 'CASH' THEN 1 END) as cash_payments,
        COUNT(CASE WHEN payment_mode = 'ONLINE' THEN 1 END) as online_payments,
        SUM(CASE WHEN payment_mode = 'CASH' THEN amount ELSE 0 END) as cash_amount,
        SUM(CASE WHEN payment_mode = 'ONLINE' THEN amount ELSE 0 END) as online_amount
      FROM payments
      WHERE payment_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching payment summary', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

// POST /api/payments/validate - Validate payment data before submission
router.post('/validate', async (req, res) => {
  const rl = logger.createRequestLogger('POST', '/api/payments/validate', req);
  try {
    const { student_id, amount, payment_type } = req.body;
    
    const validationResults = {
      valid: true,
      errors: [],
      warnings: [],
      limits: {}
    };
    
    // Student validation
    if (!student_id || isNaN(student_id)) {
      validationResults.errors.push('Valid student ID is required');
      validationResults.valid = false;
    } else {
      // Check if student exists
  const studentQuery = 'SELECT id, name, membership_type, sex, membership_date FROM students WHERE id = $1';
      const studentResult = await pool.query(studentQuery, [student_id]);
      if (studentResult.rows.length === 0) {
        validationResults.errors.push(`Student with ID ${student_id} not found`);
        validationResults.valid = false;
      } else {
        const student = studentResult.rows[0];
        
        // Get fee configuration for limits
        if (student.membership_type) {
          const feeCfgQuery = 'SELECT male_monthly_fees, female_monthly_fees FROM student_fees_config WHERE membership_type = $1 AND is_active = TRUE';
          const feeCfgRes = await pool.query(feeCfgQuery, [student.membership_type]);
          if (feeCfgRes.rows.length > 0) {
            const cfg = feeCfgRes.rows[0];
            const monthlyFees = parseFloat(student.sex === 'male' ? cfg.male_monthly_fees : cfg.female_monthly_fees);
            validationResults.limits.monthly_fee = monthlyFees;
            validationResults.limits.max_single_payment = monthlyFees * 12; // 12 months max
            
            if (monthlyFees <= 0) {
              validationResults.errors.push('Payments are disabled for free membership students');
              validationResults.valid = false;
            }
          }
        }
        
        // For refunds, check available refund amount
        if (payment_type === 'refund') {
          const totalPaidQuery = `
            SELECT COALESCE(SUM(amount), 0) as total_paid 
            FROM payments 
            WHERE student_id = $1 AND payment_type = 'monthly_fee' AND amount > 0
          `;
          const totalPaidResult = await pool.query(totalPaidQuery, [student_id]);
          const totalPaid = parseFloat(totalPaidResult.rows[0].total_paid) || 0;
          validationResults.limits.max_refund_amount = totalPaid;
        }
      }
    }
    
    // Amount validation
    if (!amount) {
      validationResults.errors.push('Payment amount is required');
      validationResults.valid = false;
    } else if (isNaN(amount)) {
      validationResults.errors.push('Amount must be a valid number');
      validationResults.valid = false;
    } else {
      const numAmount = Math.abs(parseFloat(amount));
      
      // Basic limits
      if (numAmount < 0.01) {
        validationResults.errors.push('Amount must be at least 0.01');
        validationResults.valid = false;
      } else if (numAmount > 99999999.99) {
        validationResults.errors.push('Amount exceeds maximum allowed value (99,999,999.99)');
        validationResults.valid = false;
      }
      
      // Business rule limits
      if (validationResults.limits.max_single_payment && numAmount > validationResults.limits.max_single_payment) {
        validationResults.warnings.push(`Amount (${numAmount}) exceeds recommended single payment limit (${validationResults.limits.max_single_payment})`);
      }
      
      if (payment_type === 'refund' && validationResults.limits.max_refund_amount && numAmount > validationResults.limits.max_refund_amount) {
        validationResults.errors.push(`Refund amount (${numAmount}) cannot exceed total payments (${validationResults.limits.max_refund_amount})`);
        validationResults.valid = false;
      }
    }
    
    rl.success(validationResults);
    res.json(validationResults);
  } catch (error) {
    rl.error(error);
    res.status(500).json({ error: 'Payment validation failed', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
