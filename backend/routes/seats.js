const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { toISTDateString } = require('../utils/dateUtils');

const router = express.Router();

// GET /api/seats - Get all seats with student information
router.get('/', async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/seats', req);
  try {
    rl.businessLogic('Preparing database query for all seats with student information');
    const query = `
      SELECT 
        s.seat_number,
        CASE 
          WHEN st.id IS NOT NULL THEN 'occupied'
          ELSE 'available'
        END as status,
        s.occupant_sex,
        st.id as student_id,
        st.name as student_name,
        st.sex as student_sex,
        st.contact_number,
        st.membership_till,
        st.membership_status,
        payment_summary.last_payment_date,
        -- Enhanced expiring logic: only calculate for seats with students
        CASE 
          WHEN st.id IS NOT NULL AND st.membership_till IS NOT NULL THEN
            CASE 
              -- Compare membership_till in IST by adding 5 hours 30 minutes before comparing to NOW()
              WHEN (st.membership_till + INTERVAL '5 hours 30 minutes') <= NOW() + INTERVAL '7 days' AND (st.membership_till + INTERVAL '5 hours 30 minutes') > NOW() THEN true
              ELSE false 
            END
          ELSE false 
        END as expiring,
        -- Enhanced occupancy logic with better validation
        CASE 
          WHEN st.id IS NOT NULL 
            AND st.membership_status != 'inactive'
            AND (st.membership_till IS NULL OR st.membership_till >= NOW() - INTERVAL '7 days') THEN true
          ELSE false 
        END as is_truly_occupied,
        -- Additional computed fields for better frontend handling
        CASE 
          WHEN st.id IS NOT NULL AND st.membership_till IS NOT NULL AND (st.membership_till + INTERVAL '5 hours 30 minutes') < NOW() THEN true
          ELSE false
        END as membership_expired,
        CASE 
          WHEN st.id IS NOT NULL AND st.membership_status = 'suspended' THEN true
          ELSE false
        END as membership_suspended
      FROM seats s
      LEFT JOIN students st ON s.seat_number = st.seat_number
      LEFT JOIN (
        SELECT 
          student_id,
          MAX(payment_date) as last_payment_date
        FROM payments 
        GROUP BY student_id
      ) payment_summary ON st.id = payment_summary.student_id
      ORDER BY 
        -- Improved sorting: handle numeric seats better
        CASE 
          WHEN s.seat_number ~ '^[0-9]+$' THEN CAST(s.seat_number AS INTEGER)
          WHEN s.seat_number ~ '^[A-Za-z][0-9]+$' THEN 1000000 + CAST(substring(s.seat_number from '[0-9]+') AS INTEGER)
          ELSE 9999999 
        END ASC,
        s.seat_number ASC
    `;
    
  const queryStart = rl.queryStart('seats list', query);
  const result = await pool.query(query);
  rl.querySuccess('seats list', queryStart, result, false);

  // Show a small sample in logs (not entire payload)
  const seatsWithStudents = result.rows.filter(row => row.student_id !== null);
  rl.info('Query result summary', { totalRows: result.rows.length, seatsWithStudents: Math.min(seatsWithStudents.length, 5) });

  rl.businessLogic('Transforming data to match frontend expectations');
    const transformStart = Date.now();
    
    // Transform data to match frontend expectations with enhanced validation
  const seats = result.rows.map(row => ({
      seatNumber: row.seat_number,
      occupied: row.is_truly_occupied, // Use the enhanced computed field for accurate occupancy status
      studentName: row.student_name,
      gender: row.student_sex,
      studentId: row.student_id,
      contactNumber: row.contact_number,
    membershipExpiry: row.membership_till ? toISTDateString(row.membership_till) : null,
  lastPayment: row.last_payment_date ? toISTDateString(row.last_payment_date) : null,
      expiring: row.expiring, // Show expiring status directly from calculation
      removed: false, // Status field removed - seats are either present or deleted
      maintenance: false, // Status field removed - maintenance should be handled separately
      membershipStatus: row.membership_status, // Add membership status for better validation
      membershipExpired: row.membership_expired || false, // New field for expired memberships
      membershipSuspended: row.membership_suspended || false, // New field for suspended memberships
      // Enhanced status information
      seatStatus: row.status,
      occupantSexRestriction: row.occupant_sex,
      hasStudent: !!row.student_id,
      // Validation flags for frontend
      canMarkVacant: row.is_truly_occupied && (row.membership_expired || row.membership_suspended || row.expiring),
      needsAttention: (row.is_truly_occupied && row.expiring) || row.membership_suspended
    }));
    
    const transformTime = Date.now() - transformStart;
    rl.info('Data transformation completed', { transformTimeMs: transformTime, seatsProcessed: seats.length });
    rl.statistics('Seat status breakdown', {
      total: seats.length,
      occupied: seats.filter(s => s.occupied).length,
      vacant: seats.filter(s => !s.occupied && !s.maintenance && !s.removed).length,
      expiring: seats.filter(s => s.expiring).length,
      expired: seats.filter(s => s.membershipExpired).length,
      suspended: seats.filter(s => s.membershipSuspended).length,
      needsAttention: seats.filter(s => s.needsAttention).length,
      canMarkVacant: seats.filter(s => s.canMarkVacant).length,
      withStudents: seats.filter(s => s.hasStudent).length,
      withGenderRestriction: seats.filter(s => s.occupantSexRestriction).length
    });

    // Send response (do not log entire payload)
    rl.success({ totalSeats: seats.length });
    res.json(seats);
  } catch (error) {
    rl.error(error);
    res.status(500).json({ error: 'Failed to fetch seats', timestamp: new Date().toISOString() });
  }
});

// POST /api/seats - Create a new seat
router.post('/', async (req, res) => {
  const rl = logger.createRequestLogger('POST', '/api/seats', req);
  try {
    const { seat_number, occupant_sex, modified_by } = req.body;
    rl.validationStart('Validating input parameters for create seat');
    
    if (!seat_number) {
      rl.validationError('seat_number', ['Seat number is required']);
      return res.status(400).json({ error: 'Seat number is required', timestamp: new Date().toISOString() });
    }
    
    // Validate occupant_sex if provided
    if (occupant_sex && !['male', 'female'].includes(occupant_sex)) {
      rl.validationError('occupant_sex', ['Invalid occupant_sex value']);
      return res.status(400).json({ error: 'Occupant sex must be either "male" or "female"', timestamp: new Date().toISOString() });
    }
    
    // Validate seat_number format (should be alphanumeric)
    if (!/^[A-Za-z0-9\-]+$/.test(seat_number)) {
      rl.validationError('seat_number_format', ['Invalid seat_number format']);
      return res.status(400).json({ error: 'Seat number can only contain letters, numbers, and hyphens', timestamp: new Date().toISOString() });
    }
    
  rl.businessLogic('Preparing database insertion for new seat');
    const query = `
      INSERT INTO seats (seat_number, occupant_sex, created_at, updated_at, modified_by)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3)
      RETURNING *
    `;
    
    const queryStart = rl.queryStart('Insert seat', query, [seat_number, occupant_sex, req.user?.userId || req.user?.id || 1]);
    const result = await pool.query(query, [seat_number, occupant_sex, req.user?.userId || req.user?.id || 1]);
    rl.querySuccess('Insert seat', queryStart, result, true);
    rl.success(result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    rl.error(error);
    if (error.code === '23505') {
      rl.warn('Duplicate seat number', { seatNumber: req.body.seat_number });
      return res.status(409).json({ error: 'Seat number already exists', timestamp: new Date().toISOString() });
    }
    res.status(500).json({ error: 'Failed to create seat', timestamp: new Date().toISOString() });
  }
});

// POST /api/seats/assign - Assign a student to a seat
router.post('/assign', async (req, res) => {
  const rl = logger.createRequestLogger('POST', '/api/seats/assign', req);
  try {
    const { seatNumber, studentId } = req.body || {};
    rl.validationStart('Validating input for seat assign');
    if (!seatNumber || !studentId) {
      rl.validationError('missing_params', ['seatNumber and studentId are required']);
      return res.status(400).json({ error: 'seatNumber and studentId are required', timestamp: new Date().toISOString() });
    }

    rl.businessLogic('Starting transaction to assign student to seat');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock seat row
      const seatQuery = 'SELECT seat_number FROM seats WHERE seat_number = $1 FOR UPDATE';
      const seatRes = await client.query(seatQuery, [seatNumber]);
      if (seatRes.rows.length === 0) {
        await client.query('ROLLBACK');
        rl.warn('Seat not found for assign', { seatNumber });
        return res.status(404).json({ error: 'Seat not found', timestamp: new Date().toISOString() });
      }

      // Ensure seat is not already occupied
      const occupantCheck = await client.query('SELECT id FROM students WHERE seat_number = $1', [seatNumber]);
      if (occupantCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        rl.warn('Seat already occupied', { seatNumber, occupantId: occupantCheck.rows[0].id });
        return res.status(409).json({ error: 'Seat is already occupied', timestamp: new Date().toISOString() });
      }

      // Lock student row
      const studentQuery = 'SELECT id, sex, seat_number FROM students WHERE id = $1 FOR UPDATE';
      const studentRes = await client.query(studentQuery, [studentId]);
      if (studentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        rl.warn('Student not found for assign', { studentId });
        return res.status(404).json({ error: 'Student not found', timestamp: new Date().toISOString() });
      }
      const studentRow = studentRes.rows[0];

      // Ensure student does not already have a seat
      if (studentRow.seat_number) {
        await client.query('ROLLBACK');
        rl.warn('Student already has a seat', { studentId, currentSeat: studentRow.seat_number });
        return res.status(409).json({ error: 'Student already has a seat assigned', timestamp: new Date().toISOString() });
      }

      // Update student record with new seat
      const updateStudentQuery = `
        UPDATE students
        SET seat_number = $1, modified_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const modifiedBy = req.user?.userId || req.user?.id || 1;
      const updateStudentRes = await client.query(updateStudentQuery, [seatNumber, modifiedBy, studentId]);

      // Update seat occupant_sex to student's sex
      const updateSeatQuery = `
        UPDATE seats
        SET occupant_sex = $1, modified_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE seat_number = $3
        RETURNING *
      `;
      const updateSeatRes = await client.query(updateSeatQuery, [studentRow.sex, modifiedBy, seatNumber]);

      await client.query('COMMIT');
      rl.info('Seat assigned successfully', { seatNumber, studentId });
      res.json({ message: 'Seat assigned successfully', student: updateStudentRes.rows[0], seat: updateSeatRes.rows[0], timestamp: new Date().toISOString() });
    } catch (err) {
      await client.query('ROLLBACK');
      rl.transactionRollback(err.message);
      throw err;
    } finally {
      client.release();
      rl.info('Database connection released after assign');
    }
  } catch (error) {
    rl.error(error, { requestBody: req.body });
    res.status(500).json({ error: 'Failed to assign seat', details: error.message, timestamp: new Date().toISOString() });
  }
});

// GET /api/seats/:seatNumber/history - Get seat change history
router.get('/:seatNumber/history', async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/seats/:seatNumber/history', req);
  try {
    const { seatNumber } = req.params;
    rl.validationStart('Validating seatNumber parameter');
    if (!seatNumber) {
      rl.validationError('seatNumber', ['Seat number parameter is required']);
      return res.status(400).json({ error: 'Seat number parameter is required', timestamp: new Date().toISOString() });
    }
    rl.businessLogic('Preparing seat history query');
    const query = `
      SELECT 
        sh.*,
        u.username as modified_by_name,
        CASE 
          WHEN sh.end_date IS NULL THEN 'Current'
          ELSE 'Completed'
        END as assignment_status,
        CASE 
          WHEN sh.end_date IS NULL THEN NULL
          ELSE EXTRACT(DAYS FROM (sh.end_date - sh.start_date))
        END as days_assigned
      FROM seats_history sh
      LEFT JOIN users u ON sh.modified_by = u.id
      WHERE sh.seat_number = $1
      ORDER BY sh.start_date DESC, sh.action_timestamp DESC
      LIMIT 50
    `;
    
  const queryStart = rl.queryStart('seat history', query, [seatNumber]);
  const result = await pool.query(query, [seatNumber]);
  rl.querySuccess('seat history', queryStart, result, true);
  rl.success({ count: result.rows.length });
  res.json(result.rows);
  } catch (error) {
  rl.error(error, { seatNumber: req.params.seatNumber });
  res.status(500).json({ error: 'Failed to fetch seat history', timestamp: new Date().toISOString() });
  }
});

// PUT /api/seats/:seatNumber - Update seat properties (Note: Status is now determined by student assignments)
router.put('/:seatNumber', async (req, res) => {
  const rl = logger.createRequestLogger('PUT', '/api/seats/:seatNumber', req);
  try {
    const { seatNumber } = req.params;
    const { occupant_sex, modified_by } = req.body;
    rl.validationStart('Validating input parameters for seat update');
    if (!seatNumber) {
      rl.validationError('seatNumber', ['Seat number parameter is required']);
      return res.status(400).json({ error: 'Seat number parameter is required', timestamp: new Date().toISOString() });
    }
    if (occupant_sex && !['male', 'female'].includes(occupant_sex)) {
      rl.validationError('occupant_sex', ['Invalid occupant_sex value']);
      return res.status(400).json({ error: 'occupant_sex must be either "male" or "female"', timestamp: new Date().toISOString() });
    }
    rl.businessLogic('Preparing seat update query');
    const query = `
      UPDATE seats 
      SET occupant_sex = $1, modified_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE seat_number = $3
      RETURNING *
    `;
    
    const queryStart = rl.queryStart('Update seat', query, [occupant_sex, req.user?.userId || req.user?.id || 1, seatNumber]);
    const result = await pool.query(query, [occupant_sex, req.user?.userId || req.user?.id || 1, seatNumber]);
    rl.querySuccess('Update seat', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('Seat not found for update', { seatNumber });
      return res.status(404).json({ error: 'Seat not found', timestamp: new Date().toISOString() });
    }

    rl.success(result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    rl.error(error, { seatNumber: req.params.seatNumber, requestBody: req.body });
    res.status(500).json({ error: 'Failed to update seat', timestamp: new Date().toISOString() });
  }
});

// DELETE /api/seats/:seatNumber - Mark seat as removed
router.delete('/:seatNumber', async (req, res) => {
  const rl = logger.createRequestLogger('DELETE', '/api/seats/:seatNumber', req);
  try {
    const { seatNumber } = req.params;
    const { modified_by } = req.body;
    rl.validationStart('Validating input parameters for seat delete');
    if (!seatNumber) {
      rl.validationError('seatNumber', ['Seat number parameter is required']);
      return res.status(400).json({ error: 'Seat number parameter is required', timestamp: new Date().toISOString() });
    }
    rl.businessLogic('Preparing seat deletion query');
    const query = `
      DELETE FROM seats 
      WHERE seat_number = $1
      RETURNING *
    `;
    
  const queryStart = rl.queryStart('Delete seat', query, [seatNumber]);
  const result = await pool.query(query, [seatNumber]);
    rl.querySuccess('Delete seat', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('Seat not found for delete', { seatNumber });
      return res.status(404).json({ error: 'Seat not found', timestamp: new Date().toISOString() });
    }

    rl.success(result.rows[0]);
    res.json({ message: 'Seat marked as removed', seat: result.rows[0] });
  } catch (error) {
    rl.error(error, { seatNumber: req.params.seatNumber, requestBody: req.body });
    res.status(500).json({ error: 'Failed to remove seat', timestamp: new Date().toISOString() });
  }
});

// PUT /api/seats/:seatNumber/mark-vacant - Mark expired seat as vacant
router.put('/:seatNumber/mark-vacant', async (req, res) => {
  const rl = logger.createRequestLogger('PUT', '/api/seats/:seatNumber/mark-vacant', req);
  try {
    const { seatNumber } = req.params;
    const { modified_by } = req.body;
    rl.validationStart('Validating input parameters for mark-vacant');
    if (!seatNumber) {
      rl.validationError('seatNumber', ['Seat number parameter is required']);
      return res.status(400).json({ error: 'Seat number parameter is required', timestamp: new Date().toISOString() });
    }
    rl.businessLogic('Starting database transaction for mark-vacant');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      rl.info('Transaction started for mark-vacant');

      rl.businessLogic('Fetching current seat and student information');
      const seatQuery = `
        SELECT 
          s.seat_number,
          s.status,
          s.occupant_sex,
          st.id as student_id,
          st.name as student_name, 
          st.membership_till, 
          st.membership_status,
          st.sex as student_sex
        FROM seats s
        LEFT JOIN students st ON s.seat_number = st.seat_number
        WHERE s.seat_number = $1
      `;
      
      const seatResult = await client.query(seatQuery, [seatNumber]);
      
      if (seatResult.rows.length === 0) {
        await client.query('ROLLBACK');
        rl.warn('Seat not found for mark-vacant', { seatNumber });
        return res.status(404).json({ error: 'Seat not found', timestamp: new Date().toISOString() });
      }

      const seatInfo = seatResult.rows[0];
      rl.info('Current seat info', { seatInfo });

      if (!seatInfo.student_id) {
        await client.query('ROLLBACK');
        rl.warn('Seat has no student assigned', { seatNumber });
        return res.status(400).json({ error: 'Seat is not currently occupied or has no student assigned', hasStudent: !!seatInfo.student_id, timestamp: new Date().toISOString() });
      }

      const now = new Date();
      const membershipTill = new Date(seatInfo.membership_till);
      const isExpired = membershipTill < now;
      rl.info('Membership validation', { student_name: seatInfo.student_name, membership_till: seatInfo.membership_till, membership_status: seatInfo.membership_status, is_expired: isExpired, current_time: now.toISOString() });

      const canMarkVacant = isExpired || seatInfo.membership_status === 'expired' || seatInfo.membership_status === 'suspended';

      if (!canMarkVacant) {
        await client.query('ROLLBACK');
        rl.warn('Membership still active, cannot mark vacant', { seatNumber, membership_till: seatInfo.membership_till, membership_status: seatInfo.membership_status });
        return res.status(400).json({ error: 'Student membership is still active. Can only mark expired or suspended memberships as vacant.', membership_till: seatInfo.membership_till, membership_status: seatInfo.membership_status, timestamp: new Date().toISOString() });
      }

      rl.businessLogic('Marking seat as vacant and updating student record');
      const updateSeatQuery = `
        UPDATE seats 
        SET occupant_sex = NULL, 
            modified_by = $1, 
            updated_at = CURRENT_TIMESTAMP
        WHERE seat_number = $2
        RETURNING *
      `;
      
      const updateSeatResult = await client.query(updateSeatQuery, [req.user?.userId || req.user?.id || 1, seatNumber]);
  rl.info('Seat marked as vacant', { seat: updateSeatResult.rows[0] });

  // Update student to remove seat assignment and set status to expired
  rl.businessLogic('Updating student record to remove seat assignment');
      const updateStudentQuery = `
        UPDATE students 
        SET seat_number = NULL, 
            membership_status = 'expired',
            modified_by = $1, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      
      const updateStudentResult = await client.query(updateStudentQuery, [req.user?.userId || req.user?.id || 1, seatInfo.student_id]);
      rl.info('Student record updated', { student: updateStudentResult.rows[0] });

      await client.query('COMMIT');
      rl.info('Mark-vacant transaction committed');

      res.json({ message: 'Seat marked as vacant successfully', seat: updateSeatResult.rows[0], student: updateStudentResult.rows[0], timestamp: new Date().toISOString() });
      
    } catch (error) {
      await client.query('ROLLBACK');
      rl.transactionRollback(error.message);
      throw error;
    } finally {
      client.release();
      rl.info('Database connection released');
    }

  } catch (error) {
    rl.error(error, { seatNumber: req.params.seatNumber, requestBody: req.body });
    res.status(500).json({ error: 'Failed to mark seat as vacant', details: error.message, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
