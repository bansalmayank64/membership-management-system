import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET /api/students - Get all students
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        seats.status as seat_status
      FROM students s
      LEFT JOIN seats ON s.seat_number = seats.seat_number
      ORDER BY s.id
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/students/:id - Get student by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        s.*,
        seats.status as seat_status
      FROM students s
      LEFT JOIN seats ON s.seat_number = seats.seat_number
      WHERE s.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// POST /api/students - Create a new student
router.post('/', async (req, res) => {
  try {
    const {
      seat_number,
      sex,
      name_student,
      father_name,
      contact_number,
      membership_date,
      total_paid,
      membership_till,
      membership_status,
      modified_by
    } = req.body;
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Insert student
      const studentQuery = `
        INSERT INTO students (
          seat_number, sex, name_student, father_name, contact_number,
          membership_date, total_paid, membership_till, membership_status, modified_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const studentResult = await pool.query(studentQuery, [
        seat_number, sex, name_student, father_name, contact_number,
        membership_date, total_paid, membership_till, membership_status, modified_by
      ]);
      
      // Update seat status to occupied if seat is assigned
      if (seat_number) {
        await pool.query(
          'UPDATE seats SET status = $1, modified_by = $2 WHERE seat_number = $3',
          ['occupied', modified_by, seat_number]
        );
      }
      
      await pool.query('COMMIT');
      res.status(201).json(studentResult.rows[0]);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// PUT /api/students/:id - Update student
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      seat_number,
      sex,
      name_student,
      father_name,
      contact_number,
      membership_date,
      total_paid,
      membership_till,
      membership_status,
      modified_by
    } = req.body;
    
    const query = `
      UPDATE students 
      SET 
        seat_number = $2,
        sex = $3,
        name_student = $4,
        father_name = $5,
        contact_number = $6,
        membership_date = $7,
        total_paid = $8,
        membership_till = $9,
        membership_status = $10,
        modified_by = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      id, seat_number, sex, name_student, father_name, contact_number,
      membership_date, total_paid, membership_till, membership_status, modified_by
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// DELETE /api/students/:id - Delete student
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { modified_by } = req.body;
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Get student's seat before deletion
      const studentQuery = 'SELECT seat_number FROM students WHERE id = $1';
      const studentResult = await pool.query(studentQuery, [id]);
      
      if (studentResult.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found' });
      }
      
      const seatNumber = studentResult.rows[0].seat_number;
      
      // Delete student
      await pool.query('DELETE FROM students WHERE id = $1', [id]);
      
      // Update seat status to available if seat was occupied
      if (seatNumber) {
        await pool.query(
          'UPDATE seats SET status = $1, modified_by = $2 WHERE seat_number = $3',
          ['available', modified_by, seatNumber]
        );
      }
      
      await pool.query('COMMIT');
      res.json({ message: 'Student deleted successfully' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// GET /api/students/expiring - Get expiring memberships
router.get('/expiring/memberships', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        seats.status as seat_status
      FROM students s
      LEFT JOIN seats ON s.seat_number = seats.seat_number
      WHERE s.membership_till <= NOW() + INTERVAL '7 days'
      AND s.membership_status = 'ACTIVE'
      ORDER BY s.membership_till
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expiring memberships:', error);
    res.status(500).json({ error: 'Failed to fetch expiring memberships' });
  }
});

export default router;
