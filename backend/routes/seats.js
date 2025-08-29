const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/seats - Get all seats with student information
router.get('/', async (req, res) => {
  const requestId = `seats-get-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🪑 [${new Date().toISOString()}] Starting GET /api/seats [${requestId}]`);
    console.log(`📊 Request details: IP=${req.ip}, User-Agent=${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`📝 Step 1: Preparing database query for all seats with student information`);
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
              WHEN st.membership_till <= NOW() + INTERVAL '7 days' AND st.membership_till > NOW() THEN true
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
          WHEN st.id IS NOT NULL AND st.membership_till IS NOT NULL AND st.membership_till < NOW() THEN true
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
    
    console.log(`🔍 Step 2: Executing database query...`);
    const queryStart = Date.now();
    const result = await pool.query(query);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Query executed successfully in ${queryTime}ms, returned ${result.rows.length} rows`);
    
    // Show a more representative sample: first 2 rows + any seats with students
    const seatsWithStudents = result.rows.filter(row => row.student_id !== null);
    const sampleData = {
      firstTwoSeats: result.rows.slice(0, 2),
      seatsWithStudents: seatsWithStudents.slice(0, 3),
      totalSeatsWithStudents: seatsWithStudents.length
    };
    console.log(`📋 Raw data sample:`, sampleData);
    
    console.log(`🔄 Step 3: Transforming data to match frontend expectations...`);
    const transformStart = Date.now();
    
    // Transform data to match frontend expectations with enhanced validation
    const seats = result.rows.map(row => ({
      seatNumber: row.seat_number,
      occupied: row.is_truly_occupied, // Use the enhanced computed field for accurate occupancy status
      studentName: row.student_name,
      gender: row.student_sex,
      studentId: row.student_id,
      contactNumber: row.contact_number,
      membershipExpiry: row.membership_till ? row.membership_till.toISOString().split('T')[0] : null,
      lastPayment: row.last_payment_date ? row.last_payment_date.toISOString().split('T')[0] : null,
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
    const totalTime = Date.now() - startTime;
    
    console.log(`🔧 Data transformation completed in ${transformTime}ms`);
    console.log(`📊 Response statistics: ${seats.length} seats processed`);
    
    //console.log(`📊 Response seats final: ${JSON.stringify(seats, null, 2)}`);
    console.log(`📈 Seat status breakdown:`, {
      total: seats.length,
      occupied: seats.filter(s => s.occupied).length,
      vacant: seats.filter(s => !s.occupied && !s.maintenance && !s.removed).length,
      maintenance: seats.filter(s => s.maintenance).length,
      removed: seats.filter(s => s.removed).length,
      expiring: seats.filter(s => s.expiring).length,
      expired: seats.filter(s => s.membershipExpired).length,
      suspended: seats.filter(s => s.membershipSuspended).length,
      needsAttention: seats.filter(s => s.needsAttention).length,
      canMarkVacant: seats.filter(s => s.canMarkVacant).length,
      withStudents: seats.filter(s => s.hasStudent).length,
      withGenderRestriction: seats.filter(s => s.occupantSexRestriction).length
    });
    
    console.log(`✨ Step 4: Sending response...`);
    
    // Log complete response data for debugging frontend display issues
    console.log(`📤 COMPLETE RESPONSE DATA:`, JSON.stringify({
      totalSeats: seats.length,
      seatsWithStudents: seats.filter(s => s.hasStudent),
      sampleTransformedSeats: seats.slice(0, 5),
      occupiedSeatsDetails: seats.filter(s => s.occupied)
    }, null, 2));
    
    console.log(`🎯 [${new Date().toISOString()}] GET /api/seats completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(seats);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/seats FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch seats',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/seats - Create a new seat
router.post('/', async (req, res) => {
  const requestId = `seats-post-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🪑➕ [${new Date().toISOString()}] Starting POST /api/seats [${requestId}]`);
    console.log(`📊 Request body:`, req.body);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    const { seat_number, occupant_sex, modified_by } = req.body;
    
    console.log(`🔍 Step 1: Validating input parameters...`);
    console.log(`📋 Seat details: seat_number="${seat_number}", occupant_sex="${occupant_sex}", modified_by="${modified_by}"`);
    
    if (!seat_number) {
      console.log(`❌ Validation failed: seat_number is required`);
      return res.status(400).json({ 
        error: 'Seat number is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate occupant_sex if provided
    if (occupant_sex && !['male', 'female'].includes(occupant_sex)) {
      console.log(`❌ Validation failed: invalid occupant_sex value`);
      return res.status(400).json({ 
        error: 'Occupant sex must be either "male" or "female"',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate seat_number format (should be alphanumeric)
    if (!/^[A-Za-z0-9\-]+$/.test(seat_number)) {
      console.log(`❌ Validation failed: invalid seat_number format`);
      return res.status(400).json({ 
        error: 'Seat number can only contain letters, numbers, and hyphens',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing database insertion query...`);
    const query = `
      INSERT INTO seats (seat_number, occupant_sex, created_at, updated_at, modified_by)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3)
      RETURNING *
    `;
    
    console.log(`🔧 Step 3: Executing database insertion...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [seat_number, occupant_sex, req.user?.userId || req.user?.id || 1]);
    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Seat created successfully in ${queryTime}ms`);
    console.log(`📋 New seat data:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] POST /api/seats completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] POST /api/seats FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      constraint: error.constraint,
      table: error.table,
      column: error.column
    });
    
    // Handle specific database errors
    if (error.code === '23505') { // Unique violation
      console.log(`🚫 Duplicate seat number detected: ${req.body.seat_number}`);
      return res.status(409).json({ 
        error: 'Seat number already exists',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create seat',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/seats/:seatNumber/history - Get seat change history
router.get('/:seatNumber/history', async (req, res) => {
  const requestId = `seats-history-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🪑📚 [${new Date().toISOString()}] Starting GET /api/seats/:seatNumber/history [${requestId}]`);
    
    const { seatNumber } = req.params;
    console.log(`📊 Request params: seatNumber="${seatNumber}"`);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`🔍 Step 1: Validating seat number parameter...`);
    if (!seatNumber) {
      console.log(`❌ Validation failed: seatNumber parameter is required`);
      return res.status(400).json({ 
        error: 'Seat number parameter is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing seat history query...`);
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
    
    console.log(`🔧 Step 3: Executing seat history query...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [seatNumber]);
    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Seat history query executed successfully in ${queryTime}ms`);
    console.log(`📋 History records found: ${result.rows.length}`);
    console.log(`📊 Sample history data:`, result.rows.slice(0, 2));
    
    console.log(`🎯 [${new Date().toISOString()}] GET /api/seats/:seatNumber/history completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/seats/:seatNumber/history FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      seatNumber: req.params.seatNumber
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch seat history',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/seats/:seatNumber - Update seat properties (Note: Status is now determined by student assignments)
router.put('/:seatNumber', async (req, res) => {
  const requestId = `seats-put-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🪑🔄 [${new Date().toISOString()}] Starting PUT /api/seats/:seatNumber [${requestId}]`);
    
    const { seatNumber } = req.params;
    const { occupant_sex, modified_by } = req.body;
    
    console.log(`📊 Request params: seatNumber="${seatNumber}"`);
    console.log(`📊 Request body:`, req.body);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`🔍 Step 1: Validating input parameters...`);
    if (!seatNumber) {
      console.log(`❌ Validation failed: seatNumber parameter is required`);
      return res.status(400).json({ 
        error: 'Seat number parameter is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate occupant_sex if provided
    if (occupant_sex && !['male', 'female'].includes(occupant_sex)) {
      console.log(`❌ Validation failed: invalid occupant_sex value`);
      return res.status(400).json({ 
        error: 'occupant_sex must be either "male" or "female"',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing seat update query...`);
    const query = `
      UPDATE seats 
      SET occupant_sex = $1, modified_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE seat_number = $3
      RETURNING *
    `;
    
    console.log(`🔧 Step 3: Executing seat update...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [occupant_sex, req.user?.userId || req.user?.id || 1, seatNumber]);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Update query executed successfully in ${queryTime}ms`);
    console.log(`📋 Rows affected: ${result.rowCount}`);
    
    if (result.rows.length === 0) {
      console.log(`❌ Seat not found: ${seatNumber}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] PUT /api/seats/:seatNumber completed with 404 in ${totalTime}ms [${requestId}]`);
      
      return res.status(404).json({ 
        error: 'Seat not found',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`📊 Updated seat data:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] PUT /api/seats/:seatNumber completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows[0]);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] PUT /api/seats/:seatNumber FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      seatNumber: req.params.seatNumber,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      error: 'Failed to update seat',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/seats/:seatNumber - Mark seat as removed
router.delete('/:seatNumber', async (req, res) => {
  const requestId = `seats-delete-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🪑🗑️ [${new Date().toISOString()}] Starting DELETE /api/seats/:seatNumber [${requestId}]`);
    
    const { seatNumber } = req.params;
    const { modified_by } = req.body;
    
    console.log(`📊 Request params: seatNumber="${seatNumber}"`);
    console.log(`📊 Request body:`, req.body);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`🔍 Step 1: Validating input parameters...`);
    if (!seatNumber) {
      console.log(`❌ Validation failed: seatNumber parameter is required`);
      return res.status(400).json({ 
        error: 'Seat number parameter is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing seat deletion query...`);
    const query = `
      DELETE FROM seats 
      WHERE seat_number = $1
      RETURNING *
    `;
    
    console.log(`🔧 Step 3: Executing seat deletion...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [seatNumber]);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Removal query executed successfully in ${queryTime}ms`);
    console.log(`📋 Rows affected: ${result.rowCount}`);
    
    if (result.rows.length === 0) {
      console.log(`❌ Seat not found: ${seatNumber}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] DELETE /api/seats/:seatNumber completed with 404 in ${totalTime}ms [${requestId}]`);
      
      return res.status(404).json({ 
        error: 'Seat not found',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`📊 Removed seat data:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] DELETE /api/seats/:seatNumber completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json({ message: 'Seat marked as removed', seat: result.rows[0] });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] DELETE /api/seats/:seatNumber FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      seatNumber: req.params.seatNumber,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      error: 'Failed to remove seat',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/seats/:seatNumber/mark-vacant - Mark expired seat as vacant
router.put('/:seatNumber/mark-vacant', async (req, res) => {
  const requestId = `seats-mark-vacant-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🪑🔄 [${new Date().toISOString()}] Starting PUT /api/seats/:seatNumber/mark-vacant [${requestId}]`);
    
    const { seatNumber } = req.params;
    const { modified_by } = req.body;
    
    console.log(`📊 Request params: seatNumber="${seatNumber}"`);
    console.log(`📊 Request body:`, req.body);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`🔍 Step 1: Validating input parameters...`);
    if (!seatNumber) {
      console.log(`❌ Validation failed: seatNumber parameter is required`);
      return res.status(400).json({ 
        error: 'Seat number parameter is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Starting database transaction...`);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('✅ Transaction started successfully');

      // Get current seat and student information with proper validation
      console.log(`🔍 Step 3: Fetching current seat and student information...`);
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
        console.log(`❌ Seat not found: ${seatNumber}`);
        await client.query('ROLLBACK');
        const totalTime = Date.now() - startTime;
        console.log(`🎯 [${new Date().toISOString()}] PUT /api/seats/:seatNumber/mark-vacant completed with 404 in ${totalTime}ms [${requestId}]`);
        
        return res.status(404).json({ 
          error: 'Seat not found',
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }

      const seatInfo = seatResult.rows[0];
      console.log(`📊 Current seat info:`, seatInfo);

      // Check if seat has a student assigned
      if (!seatInfo.student_id) {
        console.log(`❌ Seat has no student assigned: ${seatNumber}`);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Seat is not currently occupied or has no student assigned',
          hasStudent: !!seatInfo.student_id,
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }

      // Check if membership is expired
      const now = new Date();
      const membershipTill = new Date(seatInfo.membership_till);
      const isExpired = membershipTill < now;

      console.log(`📅 Membership validation:`, {
        student_name: seatInfo.student_name,
        membership_till: seatInfo.membership_till,
        membership_status: seatInfo.membership_status,
        is_expired: isExpired,
        current_time: now.toISOString()
      });

      // Allow marking as vacant if:
      // 1. Membership is expired (past due date), OR
      // 2. Membership status is already 'expired' or 'suspended'
      const canMarkVacant = isExpired || 
                           seatInfo.membership_status === 'expired' || 
                           seatInfo.membership_status === 'suspended';

      if (!canMarkVacant) {
        console.log(`❌ Student membership is still active: ${seatNumber}`);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Student membership is still active. Can only mark expired or suspended memberships as vacant.',
          membership_till: seatInfo.membership_till,
          membership_status: seatInfo.membership_status,
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔄 Step 4: Marking seat as vacant and updating student record...`);
      
      // Update seat status to available and clear occupant info
      const updateSeatQuery = `
        UPDATE seats 
        SET occupant_sex = NULL, 
            modified_by = $1, 
            updated_at = CURRENT_TIMESTAMP
        WHERE seat_number = $2
        RETURNING *
      `;
      
      const updateSeatResult = await client.query(updateSeatQuery, [req.user?.userId || req.user?.id || 1, seatNumber]);
      console.log(`✅ Seat marked as vacant:`, updateSeatResult.rows[0]);

      // Update student to remove seat assignment and set status to expired
      console.log(`🔄 Step 5: Updating student record...`);
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
      console.log(`✅ Student record updated:`, updateStudentResult.rows[0]);

      console.log(`💯 Step 6: Committing transaction...`);
      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] PUT /api/seats/:seatNumber/mark-vacant completed successfully in ${totalTime}ms [${requestId}]`);
      
      res.json({ 
        message: 'Seat marked as vacant successfully',
        seat: updateSeatResult.rows[0],
        student: updateStudentResult.rows[0],
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.log('🔄 Rolling back transaction due to error...');
      await client.query('ROLLBACK');
      console.log('✅ Transaction rolled back');
      throw error;
    } finally {
      console.log('🔌 Releasing database connection...');
      client.release();
      console.log('✅ Database connection released');
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] PUT /api/seats/:seatNumber/mark-vacant FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      seatNumber: req.params.seatNumber,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      error: 'Failed to mark seat as vacant',
      details: error.message,
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
