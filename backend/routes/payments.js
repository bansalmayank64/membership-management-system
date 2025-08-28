const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/payments - Get all payments
router.get('/', async (req, res) => {
  const requestId = `payments-get-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰 [${new Date().toISOString()}] Starting GET /api/payments [${requestId}]`);
    console.log(`📊 Request details: IP=${req.ip}, User-Agent=${req.get('User-Agent')?.substring(0, 50)}...`);
    console.log(`📝 Query params:`, req.query);
    
    console.log(`📝 Step 1: Preparing database query for all payments...`);
    const query = `
      SELECT 
        p.*,
        s.name as student_name,
        s.seat_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      ORDER BY p.payment_date DESC
    `;
    
    console.log(`🔍 Step 2: Executing database query...`);
    const queryStart = Date.now();
    const result = await pool.query(query);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Query executed successfully in ${queryTime}ms, returned ${result.rows.length} rows`);
    console.log(`📋 Sample payment data:`, result.rows.slice(0, 2));
    
    const totalTime = Date.now() - startTime;
    console.log(`🎯 [${new Date().toISOString()}] GET /api/payments completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/payments FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      constraint: error.constraint
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch payments',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/payments/student/:studentId - Get payments for a specific student
router.get('/student/:studentId', async (req, res) => {
  const requestId = `payments-student-get-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰👤 [${new Date().toISOString()}] Starting GET /api/payments/student/:studentId [${requestId}]`);
    
    const { studentId } = req.params;
    console.log(`📊 Request params: studentId="${studentId}"`);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`🔍 Step 1: Validating student ID parameter...`);
    if (!studentId || isNaN(studentId)) {
      console.log(`❌ Validation failed: Invalid student ID`);
      return res.status(400).json({ 
        error: 'Valid student ID is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing database query for student payments...`);
    const query = `
      SELECT 
        p.*,
        s.name as student_name,
        s.seat_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      WHERE p.student_id = $1
      ORDER BY p.payment_date DESC
    `;
    
    console.log(`🔍 Step 3: Executing database query...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [studentId]);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Query executed successfully in ${queryTime}ms, returned ${result.rows.length} rows`);
    console.log(`📋 Payment records for student ${studentId}:`, result.rows.length);
    
    const totalTime = Date.now() - startTime;
    console.log(`🎯 [${new Date().toISOString()}] GET /api/payments/student/:studentId completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/payments/student/:studentId FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      studentId: req.params.studentId
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch student payments',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/payments - Create a new payment
router.post('/', async (req, res) => {
  const startTime = Date.now();
  console.log('\n🔥 === PAYMENT CREATE REQUEST START ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('📨 Request Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const {
      student_id,
      amount,
      payment_date,
      payment_mode,
      payment_type,
      remarks,
      modified_by
    } = req.body;
    
    console.log('🔍 Step 1: Validating payment data with database constraints...');
    
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
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors,
        received: { student_id, amount, payment_date, payment_mode, payment_type, remarks },
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('🚀 Step 2: Starting database transaction...');
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('✅ Transaction started successfully');

      // Normalize payment mode to lowercase for database consistency
      const normalizedPaymentMode = payment_mode.toLowerCase();
      
      console.log('🔍 Step 3: Verifying student exists...');
      const studentCheckQuery = 'SELECT id, name FROM students WHERE id = $1';
      const studentCheck = await client.query(studentCheckQuery, [student_id]);
      
      if (studentCheck.rows.length === 0) {
        console.log('❌ Student not found:', student_id);
        throw new Error(`Student with ID ${student_id} not found`);
      }
      
      const student = studentCheck.rows[0];
      console.log('✅ Student verified:', { id: student.id, name: student.name });

      console.log('💾 Step 4: Processing payment amount based on type...');
      
      // Apply payment type logic: positive for monthly_fee, negative for refund
      let finalAmount = parseFloat(amount);
      if (payment_type === 'monthly_fee') {
        finalAmount = Math.abs(finalAmount); // Ensure positive
        console.log(`💰 Monthly fee payment: ₹${finalAmount} (positive)`);
      } else if (payment_type === 'refund') {
        finalAmount = -Math.abs(finalAmount); // Ensure negative
        console.log(`💸 Refund payment: ₹${finalAmount} (negative)`);
      }
      
      console.log('💾 Step 5: Inserting payment record...');
      
      // Insert payment
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
        payment_date, 
        normalizedPaymentMode, 
        payment_type,
        remarks || `${payment_type === 'monthly_fee' ? 'Monthly fee' : 'Refund'} payment for ${student.name}`, // Default description if remarks empty
        req.user?.userId || req.user?.id || 1
      ];
      
      console.log('📝 Payment query:', paymentQuery);
      console.log('📝 Payment values:', paymentValues);
      
      const paymentResult = await client.query(paymentQuery, paymentValues);
      console.log('✅ Step 5: Payment record inserted:', paymentResult.rows[0]);
      
      console.log('💯 Step 6: Committing transaction...');
      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      const executionTime = Date.now() - startTime;
      console.log('🎉 === PAYMENT CREATE SUCCESS ===');
      console.log('⏱️ Total execution time:', executionTime + 'ms');
      console.log('📤 Response:', JSON.stringify(paymentResult.rows[0], null, 2));
      
      res.status(201).json(paymentResult.rows[0]);
      
    } catch (error) {
      console.log('💥 Database operation failed, rolling back...');
      await client.query('ROLLBACK');
      console.log('✅ Transaction rolled back');
      throw error;
    } finally {
      console.log('🔌 Releasing database connection...');
      client.release();
      console.log('✅ Database connection released');
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ === PAYMENT CREATE ERROR ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('💥 Error details:', error);
    console.error('📍 Stack trace:', error.stack);
    
    res.status(500).json({ error: 'Failed to create payment: ' + error.message });
  }
});

// PUT /api/payments/:id - Update payment
router.put('/:id', async (req, res) => {
  const requestId = `payments-put-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰🔄 [${new Date().toISOString()}] Starting PUT /api/payments/:id [${requestId}]`);
    
    const { id } = req.params;
    const {
      student_id,
      amount,
      payment_date,
      payment_mode,
      description,
      modified_by
    } = req.body;
    
    console.log(`📊 Request params: id="${id}"`);
    console.log(`📊 Request body:`, req.body);
    
    console.log(`🔍 Step 1: Validating input parameters...`);
    
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
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing payment update query...`);
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
    
    console.log(`🔧 Step 3: Executing payment update...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [
      id, student_id, parseFloat(amount), payment_date, payment_mode.toLowerCase(), description, req.user?.userId || req.user?.id || 1
    ]);
    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Update query executed in ${queryTime}ms`);
    
    if (result.rows.length === 0) {
      console.log(`❌ Payment not found: ID=${id}`);
      console.log(`🎯 [${new Date().toISOString()}] PUT /api/payments/:id completed with 404 in ${totalTime}ms [${requestId}]`);
      
      return res.status(404).json({ 
        error: 'Payment not found',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📊 Updated payment data:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] PUT /api/payments/:id completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows[0]);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] PUT /api/payments/:id FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      paymentId: req.params.id,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      error: 'Failed to update payment',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/payments/:id - Delete payment
router.delete('/:id', async (req, res) => {
  const requestId = `payments-delete-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰🗑️ [${new Date().toISOString()}] Starting DELETE /api/payments/:id [${requestId}]`);
    
    const { id } = req.params;
    console.log(`📊 Request params: id="${id}"`);
    console.log(`👤 User: ${req.user?.userId || req.user?.id || 'unknown'}`);
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Valid payment ID is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🔍 Step 1: Deleting payment record...`);
    const query = 'DELETE FROM payments WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Payment not found: ID=${id}`);
      return res.status(404).json({ 
        error: 'Payment not found',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Payment deleted successfully in ${totalTime}ms`);
    console.log(`📊 Deleted payment:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] DELETE /api/payments/:id completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json({ 
      message: 'Payment deleted successfully', 
      payment: result.rows[0],
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] DELETE /api/payments/:id FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      paymentId: req.params.id
    });
    
    res.status(500).json({ 
      error: 'Failed to delete payment',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
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
    console.error('Error fetching payment summary:', error);
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

module.exports = router;
