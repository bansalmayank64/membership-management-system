const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/payments - Get all payments
router.get('/', async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/payments', req);
  try {
    rl.businessLogic('Preparing database query for all payments');
    const query = `
      SELECT 
        p.*,
        s.name as student_name,
        s.seat_number,
        s.contact_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      ORDER BY p.payment_date DESC
    `;
    rl.queryStart('Execute payments query', query);
    const queryStart = Date.now();
    const result = await pool.query(query);
    rl.querySuccess('Execute payments query', queryStart, result, true);

    rl.success(result.rows);
    res.json(result.rows);
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
    if (!studentId || isNaN(studentId)) {
      rl.validationError('studentId', ['Invalid student ID']);
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
      }
      // Check decimal places (NUMERIC(10,2) allows 2 decimal places)
      const decimalParts = amount.toString().split('.');
      if (decimalParts[1] && decimalParts[1].length > 2) {
        validationErrors.push('Amount can have maximum 2 decimal places');
      }
    }

    // Payment date validation - TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    if (!payment_date) {
      validationErrors.push('Payment date is required');
    } else {
      const paymentDate = new Date(payment_date);
      if (isNaN(paymentDate.getTime())) {
        validationErrors.push('Payment date must be a valid date');
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
      const studentCheckQuery = 'SELECT id, name, sex, membership_till FROM students WHERE id = $1';
      const studentCheck = await client.query(studentCheckQuery, [student_id]);
      if (studentCheck.rows.length === 0) {
        throw new Error(`Student with ID ${student_id} not found`);
      }
      const student = studentCheck.rows[0];
      rl.info('Student verified', { studentId: student.id, name: student.name, gender: student.sex });

      let membershipExtensionDays = 0;
      // Handle membership extension for monthly fee payments
      if (extend_membership && payment_type === 'monthly_fee') {
        rl.businessLogic('Processing membership extension');
        const feeConfigQuery = 'SELECT monthly_fees FROM student_fees_config WHERE gender = $1';
        const feeConfigResult = await client.query(feeConfigQuery, [student.sex]);
        if (feeConfigResult.rows.length > 0) {
          const monthlyFees = parseFloat(feeConfigResult.rows[0].monthly_fees);
          const paymentAmount = Math.abs(parseFloat(amount));
          membershipExtensionDays = Math.floor((paymentAmount / monthlyFees) * 30);
          rl.info('Membership extension calculated', { monthlyFees, paymentAmount, membershipExtensionDays });
          if (membershipExtensionDays > 0) {
            const currentMembershipTill = student.membership_till ? new Date(student.membership_till) : new Date();
            const newMembershipTill = new Date(currentMembershipTill);
            newMembershipTill.setDate(newMembershipTill.getDate() + membershipExtensionDays);
            const updateMembershipQuery = 'UPDATE students SET membership_till = $1 WHERE id = $2';
            await client.query(updateMembershipQuery, [newMembershipTill, student_id]);
            rl.info('Extended membership', { studentId: student_id, newMembershipTill: newMembershipTill.toISOString(), membershipExtensionDays });
          }
        } else {
          rl.warn('No fee configuration found for gender', { gender: student.sex });
        }
      }

      // Handle membership reduction for refunds when requested
      if (extend_membership && payment_type === 'refund') {
        rl.businessLogic('Processing membership reduction for refund');
        const feeConfigQuery = 'SELECT monthly_fees FROM student_fees_config WHERE gender = $1';
        const feeConfigResult = await client.query(feeConfigQuery, [student.sex]);
        if (feeConfigResult.rows.length > 0) {
          const monthlyFees = parseFloat(feeConfigResult.rows[0].monthly_fees);
          const paymentAmount = Math.abs(parseFloat(amount));
          const membershipReductionDays = Math.floor((paymentAmount / monthlyFees) * 30);
          rl.info('Membership reduction calculated', { monthlyFees, paymentAmount, membershipReductionDays });
          if (membershipReductionDays > 0) {
            const currentMembershipTill = student.membership_till ? new Date(student.membership_till) : new Date();
            const newMembershipTill = new Date(currentMembershipTill);
            newMembershipTill.setDate(newMembershipTill.getDate() - membershipReductionDays);
            const updateMembershipQuery = 'UPDATE students SET membership_till = $1 WHERE id = $2';
            await client.query(updateMembershipQuery, [newMembershipTill, student_id]);
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

      rl.businessLogic('Inserting payment record');
      const paymentQuery = `
        INSERT INTO payments (
          student_id, amount, payment_date, payment_mode, payment_type, description, modified_by,
          created_at, updated_at
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const paymentValues = [
        student_id,
        finalAmount,
        normalizedPaymentMode,
        payment_type,
        remarks || `${payment_type === 'monthly_fee' ? 'Monthly fee' : 'Refund'} payment for ${student.name}${membershipExtensionDays > 0 ? ` (Extended membership by ${membershipExtensionDays} days)` : ''}`,
        req.user?.userId || req.user?.id || 1
      ];

      rl.queryStart('Insert payment', paymentQuery, paymentValues);
      const paymentResult = await client.query(paymentQuery, paymentValues);
      rl.transactionCommit();
      await client.query('COMMIT');

      rl.success(paymentResult.rows[0]);
      res.status(201).json(paymentResult.rows[0]);
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

// PUT /api/payments/:id - Update payment
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
    rl.validationStart('Validating input parameters for payment update');
    
    // Enhanced validation with database constraints
    const validationErrors = [];

    // ID validation
    if (!id || isNaN(id)) {
      validationErrors.push('Valid payment ID is required');
    }

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
      if (numAmount <= 0) {
        validationErrors.push('Amount must be a positive number');
      } else if (numAmount > 99999999.99) {
        validationErrors.push('Amount exceeds maximum allowed value (99,999,999.99)');
      }
    }

    // Payment date validation
    if (!payment_date) {
      validationErrors.push('Payment date is required');
    } else {
      const paymentDate = new Date(payment_date);
      if (isNaN(paymentDate.getTime())) {
        validationErrors.push('Payment date must be a valid date');
      }
    }

    // Payment mode validation - CHECK (payment_mode IN ('cash','online'))
    if (!payment_mode) {
      validationErrors.push('Payment mode is required');
    } else if (!['cash', 'online', 'CASH', 'ONLINE'].includes(payment_mode)) {
      validationErrors.push('Payment mode must be either "cash" or "online"');
    }

    if (validationErrors.length > 0) {
      rl.validationError('update', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, requestId: rl.requestId, timestamp: new Date().toISOString() });
    }

    rl.businessLogic('Preparing payment update query');
    const query = `
      UPDATE payments 
      SET 
        student_id = $2,
        amount = $3,
        payment_date = $4,
        payment_mode = $5,
        description = $6,
        modified_by = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const queryStart = rl.queryStart('Execute payment update', query, [id, student_id, parseFloat(amount), payment_date, payment_mode.toLowerCase(), description, req.user?.userId || req.user?.id || 1]);
    const result = await pool.query(query, [id, student_id, parseFloat(amount), payment_date, payment_mode.toLowerCase(), description, req.user?.userId || req.user?.id || 1]);
    rl.querySuccess('Execute payment update', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('Payment not found for update', { paymentId: id });
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

    const query = 'DELETE FROM payments WHERE id = $1 RETURNING *';
    const queryStart = rl.queryStart('Delete payment', query, [id]);
    const result = await pool.query(query, [id]);
    rl.querySuccess('Delete payment', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('Payment not found for delete', { paymentId: id });
      return res.status(404).json({ error: 'Payment not found', requestId: rl.requestId, timestamp: new Date().toISOString() });
    }

    rl.success(result.rows[0]);
    res.json({ message: 'Payment deleted successfully', payment: result.rows[0], requestId: rl.requestId, timestamp: new Date().toISOString() });
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

module.exports = router;
