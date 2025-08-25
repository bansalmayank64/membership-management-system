import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET /api/payments - Get all payments
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.*,
        s.name_student,
        s.seat_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
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
        s.name_student,
        s.seat_number
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
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
  try {
    const {
      student_id,
      amount,
      payment_date,
      payment_mode,
      remarks,
      modified_by
    } = req.body;
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Insert payment
      const paymentQuery = `
        INSERT INTO payments (
          student_id, amount, payment_date, payment_mode, remarks, modified_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const paymentResult = await pool.query(paymentQuery, [
        student_id, amount, payment_date, payment_mode, remarks, modified_by
      ]);
      
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
      
      await pool.query(updateStudentQuery, [
        amount, payment_date, modified_by, student_id
      ]);
      
      await pool.query('COMMIT');
      res.status(201).json(paymentResult.rows[0]);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
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

export default router;
