import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET /api/seats - Get all seats with student information
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.seat_number,
        s.status,
        s.occupant_sex,
        st.id as student_id,
        st.name_student,
        st.sex as student_sex,
        st.contact_number,
        st.membership_till,
        st.membership_status,
        st.last_payment_date,
        CASE 
          WHEN st.membership_till < NOW() THEN true 
          WHEN st.membership_till <= NOW() + INTERVAL '7 days' THEN true
          ELSE false 
        END as expiring
      FROM seats s
      LEFT JOIN students st ON s.seat_number = st.seat_number
      WHERE s.status != 'removed'
      ORDER BY s.seat_number
    `;
    
    const result = await pool.query(query);
    
    // Transform data to match frontend expectations
    const seats = result.rows.map(row => ({
      seatNumber: row.seat_number,
      occupied: row.status === 'occupied' && row.student_id,
      studentName: row.name_student,
      gender: row.student_sex,
      studentId: row.student_id ? `STU${row.student_id.toString().padStart(3, '0')}` : null,
      contactNumber: row.contact_number,
      membershipExpiry: row.membership_till ? row.membership_till.toISOString().split('T')[0] : null,
      lastPayment: row.last_payment_date ? row.last_payment_date.toISOString().split('T')[0] : null,
      expiring: row.expiring,
      removed: row.status === 'removed',
      maintenance: row.status === 'maintenance'
    }));

    res.json(seats);
  } catch (error) {
    console.error('Error fetching seats:', error);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

// POST /api/seats - Create a new seat
router.post('/', async (req, res) => {
  try {
    const { seat_number, occupant_sex, modified_by } = req.body;
    
    const query = `
      INSERT INTO seats (seat_number, occupant_sex, modified_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [seat_number, occupant_sex, modified_by]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating seat:', error);
    res.status(500).json({ error: 'Failed to create seat' });
  }
});

// PUT /api/seats/:seatNumber - Update seat status
router.put('/:seatNumber', async (req, res) => {
  try {
    const { seatNumber } = req.params;
    const { status, modified_by } = req.body;
    
    const query = `
      UPDATE seats 
      SET status = $1, modified_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE seat_number = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, modified_by, seatNumber]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating seat:', error);
    res.status(500).json({ error: 'Failed to update seat' });
  }
});

// DELETE /api/seats/:seatNumber - Mark seat as removed
router.delete('/:seatNumber', async (req, res) => {
  try {
    const { seatNumber } = req.params;
    const { modified_by } = req.body;
    
    const query = `
      UPDATE seats 
      SET status = 'removed', modified_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE seat_number = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [modified_by, seatNumber]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    
    res.json({ message: 'Seat marked as removed', seat: result.rows[0] });
  } catch (error) {
    console.error('Error removing seat:', error);
    res.status(500).json({ error: 'Failed to remove seat' });
  }
});

export default router;
