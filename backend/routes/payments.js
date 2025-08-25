const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/payments - Get all payments
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.*,
        s.name as student_name,
        seats.seat_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN seats ON s.id = seats.student_id
      ORDER BY p.payment_date DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GET /api/payments/student/:studentId - Get payments for a specific student
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const query = `
      SELECT 
        p.*,
        s.name as student_name,
        seats.seat_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN seats ON s.id = seats.student_id
      WHERE p.student_id = $1
      ORDER BY p.payment_date DESC
    `;
    
    const result = await pool.query(query, [studentId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student payments:', error);
    res.status(500).json({ error: 'Failed to fetch student payments' });
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
      remarks,
      modified_by
    } = req.body;
    
    console.log('🔍 Step 1: Validating payment data...');
    
    // Validation
    if (!student_id || !amount || !payment_date || !payment_mode) {
      console.log('❌ Validation failed - missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields: student_id, amount, payment_date, payment_mode' 
      });
    }
    
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      console.log('❌ Validation failed - invalid amount:', amount);
      return res.status(400).json({ 
        error: 'Amount must be a positive number' 
      });
    }
    
    console.log('✅ Step 1: Validation passed');
    console.log('🚀 Step 2: Starting database transaction...');
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      console.log('💾 Step 3: Inserting payment record...');
      
      // Insert payment
      const paymentQuery = `
        INSERT INTO payments (
          student_id, amount, payment_date, payment_mode, remarks, modified_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const paymentValues = [
        student_id, amount, payment_date, payment_mode, remarks, modified_by
      ];
      
      console.log('📝 Payment query:', paymentQuery);
      console.log('📝 Payment values:', paymentValues);
      
      const paymentResult = await pool.query(paymentQuery, paymentValues);
      console.log('✅ Step 3: Payment record inserted:', paymentResult.rows[0]);
      
      console.log('🔄 Step 4: Updating student record...');
      
      // Update student's total_paid and last_payment_date
      const updateStudentQuery = `
        UPDATE students 
        SET 
          total_paid = total_paid + $1,
          last_payment_date = $2,
          modified_by = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;
      
      const updateValues = [amount, payment_date, modified_by, student_id];
      console.log('📝 Update query:', updateStudentQuery);
      console.log('📝 Update values:', updateValues);
      
      const updateResult = await pool.query(updateStudentQuery, updateValues);
      console.log('✅ Step 4: Student record updated:', updateResult.rows[0]);
      
      console.log('💯 Step 5: Committing transaction...');
      await pool.query('COMMIT');
      
      const executionTime = Date.now() - startTime;
      console.log('🎉 === PAYMENT CREATE SUCCESS ===');
      console.log('⏱️ Total execution time:', executionTime + 'ms');
      console.log('📤 Response:', JSON.stringify(paymentResult.rows[0], null, 2));
      
      res.status(201).json(paymentResult.rows[0]);
    } catch (error) {
      console.log('💥 Database operation failed, rolling back...');
      await pool.query('ROLLBACK');
      throw error;
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
  try {
    const { id } = req.params;
    const {
      student_id,
      amount,
      payment_date,
      payment_mode,
      remarks,
      modified_by
    } = req.body;
    
    const query = `
      UPDATE payments 
      SET 
        student_id = $2,
        amount = $3,
        payment_date = $4,
        payment_mode = $5,
        remarks = $6,
        modified_by = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      id, student_id, amount, payment_date, payment_mode, remarks, modified_by
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// DELETE /api/payments/:id - Delete payment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM payments WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json({ message: 'Payment deleted successfully', payment: result.rows[0] });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
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
