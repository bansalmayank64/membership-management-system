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
        s.status,
        s.occupant_sex,
        st.id as student_id,
        st.name as student_name,
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
      LEFT JOIN students st ON s.student_id = st.id
      WHERE s.status != 'removed'
      ORDER BY 
        CASE 
          WHEN s.seat_number ~ '^[0-9]+$' THEN CAST(s.seat_number AS INTEGER)
          ELSE 999999 
        END ASC,
        s.seat_number ASC
    `;
    
    console.log(`🔍 Step 2: Executing database query...`);
    const queryStart = Date.now();
    const result = await pool.query(query);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Query executed successfully in ${queryTime}ms, returned ${result.rows.length} rows`);
    console.log(`📋 Raw data sample:`, result.rows.slice(0, 2));
    
    console.log(`🔄 Step 3: Transforming data to match frontend expectations...`);
    const transformStart = Date.now();
    
    // Transform data to match frontend expectations
    const seats = result.rows.map(row => ({
      seatNumber: row.seat_number,
      occupied: row.status === 'occupied' && row.student_id,
      studentName: row.student_name,
      gender: row.student_sex,
      studentId: row.student_id ? `STU${row.student_id.toString().padStart(3, '0')}` : null,
      contactNumber: row.contact_number,
      membershipExpiry: row.membership_till ? row.membership_till.toISOString().split('T')[0] : null,
      lastPayment: row.last_payment_date ? row.last_payment_date.toISOString().split('T')[0] : null,
      expiring: row.expiring,
      removed: row.status === 'removed',
      maintenance: row.status === 'maintenance'
    }));
    
    const transformTime = Date.now() - transformStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`🔧 Data transformation completed in ${transformTime}ms`);
    console.log(`📊 Response statistics: ${seats.length} seats processed`);
    console.log(`📈 Seat status breakdown:`, {
      occupied: seats.filter(s => s.occupied).length,
      vacant: seats.filter(s => !s.occupied && !s.maintenance).length,
      maintenance: seats.filter(s => s.maintenance).length,
      expiring: seats.filter(s => s.expiring).length
    });
    
    console.log(`✨ Step 4: Sending response...`);
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
    
    console.log(`📝 Step 2: Preparing database insertion query...`);
    const query = `
      INSERT INTO seats (seat_number, occupant_sex, modified_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    console.log(`🔧 Step 3: Executing database insertion...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [seat_number, occupant_sex, modified_by]);
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
        u.username as modified_by_name
      FROM seats_history sh
      LEFT JOIN users u ON sh.modified_by = u.id
      WHERE sh.seat_number = $1
      ORDER BY sh.action_timestamp DESC
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

// PUT /api/seats/:seatNumber - Update seat status
router.put('/:seatNumber', async (req, res) => {
  const requestId = `seats-put-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`🪑🔄 [${new Date().toISOString()}] Starting PUT /api/seats/:seatNumber [${requestId}]`);
    
    const { seatNumber } = req.params;
    const { status, modified_by } = req.body;
    
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
    
    if (!status) {
      console.log(`❌ Validation failed: status is required`);
      return res.status(400).json({ 
        error: 'Status is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing seat update query...`);
    const query = `
      UPDATE seats 
      SET status = $1, modified_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE seat_number = $3
      RETURNING *
    `;
    
    console.log(`🔧 Step 3: Executing seat update...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [status, modified_by, seatNumber]);
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
    
    console.log(`📝 Step 2: Preparing seat removal query (marking as removed)...`);
    const query = `
      UPDATE seats 
      SET status = 'removed', modified_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE seat_number = $2
      RETURNING *
    `;
    
    console.log(`🔧 Step 3: Executing seat removal...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [modified_by, seatNumber]);
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

      // Get current seat and student information
      console.log(`🔍 Step 3: Fetching current seat and student information...`);
      const seatQuery = `
        SELECT s.*, st.name as student_name, st.membership_till, st.id as student_id
        FROM seats s
        LEFT JOIN students st ON s.student_id = st.id
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

      // Check if seat is occupied and has expired membership
      if (seatInfo.status !== 'occupied' || !seatInfo.student_id) {
        console.log(`❌ Seat is not occupied: ${seatNumber}`);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Seat is not currently occupied',
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }

      // Check if membership is expired
      const now = new Date();
      const membershipTill = new Date(seatInfo.membership_till);
      const isExpired = membershipTill < now;

      console.log(`📅 Membership check:`, {
        membership_till: seatInfo.membership_till,
        is_expired: isExpired,
        current_time: now.toISOString()
      });

      if (!isExpired) {
        console.log(`❌ Student membership is still active: ${seatNumber}`);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Student membership is still active. Can only mark expired seats as vacant.',
          membership_till: seatInfo.membership_till,
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔄 Step 4: Marking seat as vacant...`);
      
      // Update seat status to available and clear occupant info
      const updateSeatQuery = `
        UPDATE seats 
        SET student_id = NULL, status = 'available', occupant_sex = NULL, 
            modified_by = $1, updated_at = CURRENT_TIMESTAMP
        WHERE seat_number = $2
        RETURNING *
      `;
      
      const updateSeatResult = await client.query(updateSeatQuery, [modified_by, seatNumber]);
      console.log(`✅ Seat marked as vacant:`, updateSeatResult.rows[0]);

      // Update student to remove seat assignment
      console.log(`🔄 Step 5: Updating student record...`);
      const updateStudentQuery = `
        UPDATE students 
        SET seat_number = NULL, membership_status = 'expired',
            modified_by = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      
      const updateStudentResult = await client.query(updateStudentQuery, [modified_by, seatInfo.student_id]);
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
