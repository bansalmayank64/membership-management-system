const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/students - Get all students
router.get('/', async (req, res) => {
  const startTime = Date.now();
  console.log('\n🔄 === GET STUDENTS REQUEST START ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🔍 Query params:', req.query);
  console.log('🌐 Request headers:', {
    authorization: req.headers.authorization ? '[TOKEN_PRESENT]' : '[NO_TOKEN]',
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent']
  });
  
  try {
    console.log('🚀 Step 1: Executing database query...');
    
    const query = `
      SELECT 
        s.*,
        seats.seat_number,
        seats.status as seat_status
      FROM students s
      LEFT JOIN seats ON s.id = seats.student_id
      ORDER BY s.created_at DESC
    `;
    
    console.log('📝 SQL Query:', query);
    
    const result = await pool.query(query);
    
    console.log('✅ Step 2: Query executed successfully');
    console.log('📊 Records found:', result.rows.length);
    console.log('📋 Sample record:', result.rows[0] ? JSON.stringify(result.rows[0], null, 2) : 'No records');
    
    const executionTime = Date.now() - startTime;
    console.log('🎉 === GET STUDENTS SUCCESS ===');
    console.log('⏱️ Total execution time:', executionTime + 'ms');
    
    res.json(result.rows);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('💥 === GET STUDENTS ERROR ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('🔍 Error type:', error.constructor.name);
    console.error('📄 Error message:', error.message);
    console.error('📍 Error stack:', error.stack);
    console.error('🗄️ Database connection status:', pool.totalCount || 'Unknown');
    
    res.status(500).json({ 
      error: 'Failed to fetch students',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/students/with-unassigned-seats - Get all students with unassigned seats included
router.get('/with-unassigned-seats', async (req, res) => {
  const startTime = Date.now();
  console.log('\n🔄 === GET STUDENTS WITH UNASSIGNED SEATS REQUEST START ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  
  try {
    console.log('🚀 Step 1: Executing query for students and unassigned seats...');
    
    // Query to get all students with their seat information
    const studentsQuery = `
      SELECT 
        s.*,
        seats.seat_number as assigned_seat,
        seats.status as seat_status,
        'student' as record_type
      FROM students s
      LEFT JOIN seats ON s.id = seats.student_id
      ORDER BY s.created_at DESC
    `;
    
    // Query to get all unassigned seats
    const unassignedSeatsQuery = `
      SELECT 
        NULL as id,
        NULL as name,
        NULL as father_name,
        NULL as contact_number,
        NULL as sex,
        seat_number,
        NULL as membership_date,
        NULL as membership_till,
        NULL as membership_status,
        NULL as total_paid,
        NULL as last_payment_date,
        NULL as created_at,
        NULL as updated_at,
        NULL as modified_by,
        seat_number as assigned_seat,
        status as seat_status,
        'unassigned_seat' as record_type
      FROM seats 
      WHERE student_id IS NULL 
        AND status = 'available'
      ORDER BY 
        CASE 
          WHEN seat_number ~ '^[0-9]+$' THEN CAST(seat_number AS INTEGER)
          ELSE 999999 
        END ASC,
        seat_number ASC
    `;
    
    console.log('📝 Executing students query...');
    const studentsResult = await pool.query(studentsQuery);
    
    console.log('📝 Executing unassigned seats query...');
    const unassignedSeatsResult = await pool.query(unassignedSeatsQuery);
    
    // Combine results
    const combinedResults = [
      ...studentsResult.rows,
      ...unassignedSeatsResult.rows
    ];
    
    console.log('✅ Step 2: Queries executed successfully');
    console.log('📊 Students found:', studentsResult.rows.length);
    console.log('📊 Unassigned seats found:', unassignedSeatsResult.rows.length);
    console.log('📊 Total records:', combinedResults.length);
    
    const executionTime = Date.now() - startTime;
    console.log('🎉 === GET STUDENTS WITH UNASSIGNED SEATS SUCCESS ===');
    console.log('⏱️ Total execution time:', executionTime + 'ms');
    
    res.json({
      students: studentsResult.rows,
      unassignedSeats: unassignedSeatsResult.rows,
      combined: combinedResults,
      stats: {
        totalStudents: studentsResult.rows.length,
        assignedStudents: studentsResult.rows.filter(s => s.assigned_seat).length,
        unassignedStudents: studentsResult.rows.filter(s => !s.assigned_seat).length,
        availableSeats: unassignedSeatsResult.rows.length
      }
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('💥 === GET STUDENTS WITH UNASSIGNED SEATS ERROR ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('🔍 Error type:', error.constructor.name);
    console.error('📄 Error message:', error.message);
    console.error('📍 Error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Failed to fetch students with unassigned seats',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/students/:id - Get student by ID
router.get('/:id', async (req, res) => {
  const startTime = Date.now();
  console.log('\n🔍 === GET STUDENT BY ID REQUEST START ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🆔 Student ID:', req.params.id);
  
  try {
    const { id } = req.params;
    console.log('🚀 Step 1: Executing database query for student ID:', id);
    
    const query = `
      SELECT 
        s.*,
        seats.seat_number,
        seats.status as seat_status
      FROM students s
      LEFT JOIN seats ON s.id = seats.student_id
      WHERE s.id = $1
    `;
    
    console.log('📝 SQL Query:', query);
    console.log('📝 Parameters:', [id]);
    
    const result = await pool.query(query, [id]);
    
    console.log('✅ Step 2: Query executed successfully');
    console.log('📊 Records found:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('❌ Student not found with ID:', id);
      return res.status(404).json({ 
        error: 'Student not found',
        studentId: id,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('📋 Student data:', JSON.stringify(result.rows[0], null, 2));
    
    const executionTime = Date.now() - startTime;
    console.log('🎉 === GET STUDENT BY ID SUCCESS ===');
    console.log('⏱️ Total execution time:', executionTime + 'ms');
    
    res.json(result.rows[0]);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('💥 === GET STUDENT BY ID ERROR ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('🔍 Error type:', error.constructor.name);
    console.error('📄 Error message:', error.message);
    console.error('📍 Error stack:', error.stack);
    console.error('🆔 Student ID that failed:', req.params.id);
    
    res.status(500).json({ 
      error: 'Failed to fetch student',
      details: error.message,
      studentId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/students - Create new student
router.post('/', async (req, res) => {
  const startTime = Date.now();
  console.log('\n🔥 === CREATE STUDENT REQUEST START ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('📨 Request Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      name, 
      father_name, 
      contact_number, 
      sex, 
      seat_number, 
      membership_till, 
      modified_by 
    } = req.body;

    console.log('🔍 Step 1: Validating input data...');

    // Enhanced input validation
    const validationErrors = [];

    // Name validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      validationErrors.push('Name is required and must be a non-empty string');
    } else if (name.trim().length < 2) {
      validationErrors.push('Name must be at least 2 characters long');
    } else if (name.trim().length > 100) {
      validationErrors.push('Name must not exceed 100 characters');
    } else if (!/^[a-zA-Z\s\.\-']+$/.test(name.trim())) {
      validationErrors.push('Name can only contain letters, spaces, dots, hyphens, and apostrophes');
    }

    // Gender/Sex validation - only Male or Female allowed
    if (!sex || typeof sex !== 'string') {
      validationErrors.push('Gender is required');
    } else if (!['Male', 'Female', 'male', 'female', 'M', 'F', 'm', 'f'].includes(sex.trim())) {
      validationErrors.push('Gender must be either Male or Female');
    }

    // Contact number validation
    if (!contact_number || typeof contact_number !== 'string') {
      validationErrors.push('Contact number is required');
    } else {
      const cleanContact = contact_number.replace(/[\s\-\(\)]/g, '');
      if (!/^\+?[0-9]{10,15}$/.test(cleanContact)) {
        validationErrors.push('Contact number must be 10-15 digits (may include country code with +)');
      }
    }

    // Father's name validation (optional but if provided, should be valid)
    if (father_name && typeof father_name === 'string') {
      if (father_name.trim().length < 2) {
        validationErrors.push("Father's name must be at least 2 characters long if provided");
      } else if (father_name.trim().length > 100) {
        validationErrors.push("Father's name must not exceed 100 characters");
      } else if (!/^[a-zA-Z\s\.\-']+$/.test(father_name.trim())) {
        validationErrors.push("Father's name can only contain letters, spaces, dots, hyphens, and apostrophes");
      }
    }

    // Membership date validation
    if (membership_till) {
      const membershipDate = new Date(membership_till);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(membershipDate.getTime())) {
        validationErrors.push('Membership till date must be a valid date');
      } else if (membershipDate < today) {
        validationErrors.push('Membership till date cannot be in the past');
      }
    }

    // Seat number validation (optional but if provided, should be valid)
    if (seat_number && typeof seat_number === 'string') {
      const trimmedSeatNumber = seat_number.trim().toLowerCase();
      // Allow "unassigned" as a special case
      if (trimmedSeatNumber === 'unassigned') {
        // Valid - this means student doesn't have a physical seat
        console.log('📝 Student will be created without seat assignment (unassigned)');
      } else if (!/^[A-Za-z0-9\-]+$/.test(seat_number.trim())) {
        validationErrors.push('Seat number can only contain letters, numbers, and hyphens, or use "unassigned"');
      } else if (seat_number.trim().length > 20) {
        validationErrors.push('Seat number must not exceed 20 characters');
      }
    }

    if (validationErrors.length > 0) {
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors,
        received: { 
          name: name || null, 
          sex: sex || null, 
          contact_number: contact_number || null,
          father_name: father_name || null,
          seat_number: seat_number || null,
          membership_till: membership_till || null
        },
        timestamp: new Date().toISOString()
      });
    }

    // Normalize data
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedSex = sex.toLowerCase(); // Database expects lowercase: male/female
    const normalizedContact = contact_number.replace(/[\s\-\(\)]/g, '');
    const normalizedFatherName = father_name ? father_name.trim().replace(/\s+/g, ' ') : null;
    
    // Handle seat number normalization - special case for "unassigned"
    let normalizedSeatNumber = null;
    if (seat_number) {
      const trimmedSeatNumber = seat_number.trim().toLowerCase();
      if (trimmedSeatNumber === 'unassigned') {
        normalizedSeatNumber = 'UNASSIGNED'; // Use uppercase for consistency
      } else {
        normalizedSeatNumber = seat_number.trim().toUpperCase();
      }
    }

    console.log('✅ Step 1: Validation passed - all fields are valid');
    console.log('📋 Normalized data:', {
      name: normalizedName,
      sex: normalizedSex,
      contact_number: normalizedContact,
      father_name: normalizedFatherName,
      seat_number: normalizedSeatNumber
    });

    // Start transaction
    console.log('🚀 Step 2: Starting database transaction...');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('✅ Transaction started successfully');

      // Insert student WITHOUT seat_number first (to avoid trigger conflicts)
      console.log('💾 Step 3: Inserting student record...');
      const studentQuery = `
        INSERT INTO students (name, father_name, contact_number, sex, membership_till, modified_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const studentValues = [normalizedName, normalizedFatherName, normalizedContact, normalizedSex, membership_till, modified_by];
      console.log('📝 Student query:', studentQuery);
      console.log('📝 Student values:', studentValues);
      
      const studentResult = await client.query(studentQuery, studentValues);

      const student = studentResult.rows[0];
      console.log('✅ Step 3: Student created successfully:', {
        id: student.id,
        name: student.name,
        contact_number: student.contact_number,
        sex: student.sex
      });

      // If seat_number is provided, assign the seat
      if (normalizedSeatNumber) {
        console.log(`🪑 Step 4: Processing seat assignment for seat: ${normalizedSeatNumber}`);
        
        // Handle special case for "UNASSIGNED" seats
        if (normalizedSeatNumber === 'UNASSIGNED') {
          console.log('📝 Student marked as unassigned - no physical seat allocation');
          
          // Update student with unassigned seat number
          console.log('🔄 Updating student with unassigned status...');
          const updateStudentQuery = `
            UPDATE students 
            SET seat_number = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `;
          
          const updateStudentResult = await client.query(updateStudentQuery, ['UNASSIGNED', student.id]);
          console.log('✅ Student marked as unassigned:', {
            student_id: student.id,
            seat_number: 'UNASSIGNED',
            rows_affected: updateStudentResult.rowCount
          });
        } else {
          // Handle normal seat assignment
          console.log('🔍 Checking seat availability...');
          const seatCheckQuery = `
            SELECT * FROM seats 
            WHERE seat_number = $1 AND status = 'available' 
            AND (occupant_sex IS NULL OR occupant_sex = $2)
          `;
          
          const seatCheck = await client.query(seatCheckQuery, [normalizedSeatNumber, normalizedSex]);
          
          console.log('📊 Seat check results:', {
            seat_number: normalizedSeatNumber,
            student_sex: normalizedSex,
            seats_found: seatCheck.rows.length,
            seat_details: seatCheck.rows[0] || 'No seat found'
          });
          
          if (seatCheck.rows.length === 0) {
            console.log('❌ Seat assignment failed: Seat not available or gender mismatch');
            
            // Get more details about why the seat is not available
            const detailedSeatQuery = `SELECT * FROM seats WHERE seat_number = $1`;
            const detailedSeatResult = await client.query(detailedSeatQuery, [normalizedSeatNumber]);
            
            if (detailedSeatResult.rows.length === 0) {
              console.log(`❌ Seat ${normalizedSeatNumber} does not exist in database`);
            } else {
              const seatInfo = detailedSeatResult.rows[0];
              console.log('🔍 Seat exists but unavailable:', {
                seat_number: seatInfo.seat_number,
                status: seatInfo.status,
                occupant_sex: seatInfo.occupant_sex,
                student_id: seatInfo.student_id,
                reason: seatInfo.status !== 'available' ? 'Status not available' :
                        seatInfo.occupant_sex && seatInfo.occupant_sex !== normalizedSex ? 'Gender restriction' :
                        'Unknown reason'
              });
            }
            
            throw new Error(`Seat ${normalizedSeatNumber} is not available or doesn't match gender restriction`);
          }

          console.log('✅ Seat is available, proceeding with assignment...');

          // Update seat assignment
          console.log('🔄 Updating seat assignment...');
          const seatUpdateQuery = `
            UPDATE seats 
            SET student_id = $1, status = 'occupied', occupant_sex = $2, updated_at = CURRENT_TIMESTAMP
            WHERE seat_number = $3
          `;
          
          const seatUpdateResult = await client.query(seatUpdateQuery, [student.id, normalizedSex, normalizedSeatNumber]);
          console.log('✅ Seat updated successfully:', {
            seat_number: normalizedSeatNumber,
            student_id: student.id,
            rows_affected: seatUpdateResult.rowCount
          });

          // Update student with seat_number
          console.log('🔄 Updating student with seat number...');
          const updateStudentQuery = `
            UPDATE students 
            SET seat_number = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `;
          
          const updateStudentResult = await client.query(updateStudentQuery, [normalizedSeatNumber, student.id]);
          console.log('✅ Student seat assignment updated:', {
            student_id: student.id,
            seat_number: normalizedSeatNumber,
            rows_affected: updateStudentResult.rowCount
          });
        }
      } else {
        console.log('ℹ️ Step 4: No seat number provided, student created without seat assignment');
      }

      console.log('💯 Step 5: Committing transaction...');
      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      // Fetch the complete student data with seat info
      console.log('📖 Step 6: Fetching final student data...');
      const finalQuery = `
        SELECT 
          s.*,
          seats.seat_number,
          seats.status as seat_status
        FROM students s
        LEFT JOIN seats ON s.id = seats.student_id
        WHERE s.id = $1
      `;
      
      const finalResult = await client.query(finalQuery, [student.id]);
      const finalStudent = finalResult.rows[0];
      
      console.log('✅ Final student data:', JSON.stringify(finalStudent, null, 2));

      const executionTime = Date.now() - startTime;
      console.log('🎉 === CREATE STUDENT SUCCESS ===');
      console.log('⏱️ Total execution time:', executionTime + 'ms');
      
      res.status(201).json(finalStudent);
      
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
    const executionTime = Date.now() - startTime;
    
    console.error('💥 === CREATE STUDENT ERROR ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('🔍 Error type:', error.constructor.name);
    console.error('📄 Error message:', error.message);
    console.error('🔢 Error code:', error.code);
    console.error('📝 Error detail:', error.detail);
    console.error('🔗 Error constraint:', error.constraint);
    console.error('📍 Error stack:', error.stack);
    console.error('📤 Original request body:', JSON.stringify(req.body, null, 2));
    
    // Check for specific error types
    if (error.code === '23505') { // Unique constraint violation
      console.log('🔍 Duplicate key error detected');
      if (error.constraint === 'students_contact_number_key') {
        console.log('📞 Contact number already exists');
        return res.status(400).json({ 
          error: 'Contact number already exists',
          constraint: error.constraint,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to create student',
      details: error.detail || 'No additional details',
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/students/:id - Update student
router.put('/:id', async (req, res) => {
  const startTime = Date.now();
  console.log('\n🔄 === UPDATE STUDENT REQUEST START ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🆔 Student ID:', req.params.id);
  console.log('📨 Request Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { id } = req.params;
    const { 
      name, 
      father_name, 
      contact_number, 
      sex, 
      seat_number, 
      membership_till, 
      membership_status,
      modified_by 
    } = req.body;

    console.log('🔍 Step 1: Validating input data...');

    // Enhanced input validation (same as POST)
    const validationErrors = [];

    // ID validation
    if (!id || isNaN(id)) {
      validationErrors.push('Valid student ID is required');
    }

    // Name validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      validationErrors.push('Name is required and must be a non-empty string');
    } else if (name.trim().length < 2) {
      validationErrors.push('Name must be at least 2 characters long');
    } else if (name.trim().length > 100) {
      validationErrors.push('Name must not exceed 100 characters');
    } else if (!/^[a-zA-Z\s\.\-']+$/.test(name.trim())) {
      validationErrors.push('Name can only contain letters, spaces, dots, hyphens, and apostrophes');
    }

    // Gender/Sex validation - only Male or Female allowed
    if (!sex || typeof sex !== 'string') {
      validationErrors.push('Gender is required');
    } else if (!['Male', 'Female', 'male', 'female', 'M', 'F', 'm', 'f'].includes(sex.trim())) {
      validationErrors.push('Gender must be either Male or Female');
    }

    // Contact number validation
    if (!contact_number || typeof contact_number !== 'string') {
      validationErrors.push('Contact number is required');
    } else {
      const cleanContact = contact_number.replace(/[\s\-\(\)]/g, '');
      if (!/^\+?[0-9]{10,15}$/.test(cleanContact)) {
        validationErrors.push('Contact number must be 10-15 digits (may include country code with +)');
      }
    }

    // Father's name validation (optional but if provided, should be valid)
    if (father_name && typeof father_name === 'string') {
      if (father_name.trim().length < 2) {
        validationErrors.push("Father's name must be at least 2 characters long if provided");
      } else if (father_name.trim().length > 100) {
        validationErrors.push("Father's name must not exceed 100 characters");
      } else if (!/^[a-zA-Z\s\.\-']+$/.test(father_name.trim())) {
        validationErrors.push("Father's name can only contain letters, spaces, dots, hyphens, and apostrophes");
      }
    }

    // Membership date validation
    if (membership_till) {
      const membershipDate = new Date(membership_till);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(membershipDate.getTime())) {
        validationErrors.push('Membership till date must be a valid date');
      } else if (membershipDate < today) {
        validationErrors.push('Membership till date cannot be in the past');
      }
    }

    // Seat number validation (optional but if provided, should be valid)
    if (seat_number && typeof seat_number === 'string') {
      if (!/^[A-Za-z0-9\-]+$/.test(seat_number.trim())) {
        validationErrors.push('Seat number can only contain letters, numbers, and hyphens');
      } else if (seat_number.trim().length > 20) {
        validationErrors.push('Seat number must not exceed 20 characters');
      }
    }

    // Membership status validation
    if (membership_status && !['active', 'inactive', 'suspended', 'expired'].includes(membership_status)) {
      validationErrors.push('Membership status must be one of: active, inactive, suspended, expired');
    }

    if (validationErrors.length > 0) {
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors,
        received: { 
          id: id || null,
          name: name || null, 
          sex: sex || null, 
          contact_number: contact_number || null,
          father_name: father_name || null,
          seat_number: seat_number || null,
          membership_till: membership_till || null,
          membership_status: membership_status || null
        },
        timestamp: new Date().toISOString()
      });
    }

    // Normalize data
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedSex = sex.toLowerCase(); // Database expects lowercase: male/female
    const normalizedContact = contact_number.replace(/[\s\-\(\)]/g, '');
    const normalizedFatherName = father_name ? father_name.trim().replace(/\s+/g, ' ') : null;
    const normalizedSeatNumber = seat_number ? seat_number.trim().toUpperCase() : null;

    console.log('✅ Step 1: Validation passed - all fields are valid');
    console.log('📋 Normalized data:', {
      id,
      name: normalizedName,
      sex: normalizedSex,
      contact_number: normalizedContact,
      father_name: normalizedFatherName,
      seat_number: normalizedSeatNumber,
      membership_status
    });

    console.log('🚀 Step 2: Starting database transaction...');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('✅ Transaction started successfully');

      // Get current student data
      console.log('🔍 Step 3: Fetching current student data...');
      const currentStudentQuery = `
        SELECT s.*, s.seat_number as current_seat 
        FROM students s 
        WHERE s.id = $1
      `;
      const currentStudent = await client.query(currentStudentQuery, [id]);
      
      if (currentStudent.rows.length === 0) {
        console.log('❌ Student not found with ID:', id);
        return res.status(404).json({ 
          error: 'Student not found',
          studentId: id,
          timestamp: new Date().toISOString()
        });
      }

      const current = currentStudent.rows[0];
      console.log('✅ Current student data:', JSON.stringify(current, null, 2));

      // Update student information
      console.log('💾 Step 4: Updating student information...');
      const updateQuery = `
        UPDATE students 
        SET name = $1, father_name = $2, contact_number = $3, sex = $4, 
            seat_number = $5, membership_till = $6, membership_status = $7, modified_by = $8, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING *
      `;
      
      const updateValues = [normalizedName, normalizedFatherName, normalizedContact, normalizedSex, 
        normalizedSeatNumber, membership_till, membership_status, modified_by, id];
      console.log('📝 Update query:', updateQuery);
      console.log('📝 Update values:', updateValues);
      
      const studentResult = await client.query(updateQuery, updateValues);
      console.log('✅ Student information updated');

      // Handle seat changes
      if (normalizedSeatNumber !== current.current_seat) {
        console.log('🪑 Step 5: Processing seat change...');
        console.log('🔄 Seat change:', { from: current.current_seat, to: normalizedSeatNumber });
        
        // Free up current seat if any
        if (current.current_seat) {
          console.log('🔓 Freeing up current seat:', current.current_seat);
          await client.query(`
            UPDATE seats 
            SET student_id = NULL, status = 'available', occupant_sex = NULL, 
                updated_at = CURRENT_TIMESTAMP
            WHERE seat_number = $1
          `, [current.current_seat]);
          console.log('✅ Current seat freed up');
        }

        // Assign new seat if provided
        if (normalizedSeatNumber) {
          console.log('🔍 Checking new seat availability:', normalizedSeatNumber);
          const seatCheckQuery = `
            SELECT * FROM seats 
            WHERE seat_number = $1 AND status = 'available' 
            AND (occupant_sex IS NULL OR occupant_sex = $2)
          `;
          
          const seatCheck = await client.query(seatCheckQuery, [normalizedSeatNumber, normalizedSex]);
          console.log('📊 Seat check results:', {
            seat_number: normalizedSeatNumber,
            student_sex: normalizedSex,
            seats_found: seatCheck.rows.length
          });
          
          if (seatCheck.rows.length === 0) {
            console.log('❌ New seat not available or gender mismatch');
            throw new Error(`Seat ${normalizedSeatNumber} is not available or doesn't match gender restriction`);
          }

          console.log('🔒 Assigning new seat:', normalizedSeatNumber);
          await client.query(`
            UPDATE seats 
            SET student_id = $1, status = 'occupied', occupant_sex = $2, 
                updated_at = CURRENT_TIMESTAMP
            WHERE seat_number = $3
          `, [id, normalizedSex, normalizedSeatNumber]);
          console.log('✅ New seat assigned successfully');
        }
      } else {
        console.log('ℹ️ Step 4: No seat change required');
      }

      console.log('💯 Step 5: Committing transaction...');
      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      // Fetch updated student data
      console.log('📖 Step 6: Fetching updated student data...');
      const finalQuery = `
        SELECT 
          s.*,
          seats.seat_number,
          seats.status as seat_status
        FROM students s
        LEFT JOIN seats ON s.id = seats.student_id
        WHERE s.id = $1
      `;
      
      const finalResult = await client.query(finalQuery, [id]);
      const finalStudent = finalResult.rows[0];
      
      console.log('✅ Final updated student data:', JSON.stringify(finalStudent, null, 2));
      
      const executionTime = Date.now() - startTime;
      console.log('🎉 === UPDATE STUDENT SUCCESS ===');
      console.log('⏱️ Total execution time:', executionTime + 'ms');
      
      res.json(finalStudent);
      
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
    const executionTime = Date.now() - startTime;
    
    console.error('💥 === UPDATE STUDENT ERROR ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('🔍 Error type:', error.constructor.name);
    console.error('📄 Error message:', error.message);
    console.error('🔢 Error code:', error.code);
    console.error('📝 Error detail:', error.detail);
    console.error('📍 Error stack:', error.stack);
    console.error('🆔 Student ID that failed:', req.params.id);
    
    res.status(500).json({ 
      error: error.message || 'Failed to update student',
      details: error.detail || 'No additional details',
      studentId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/students/:id - Delete student
router.delete('/:id', async (req, res) => {
  const startTime = Date.now();
  console.log('\n🗑️ === DELETE STUDENT REQUEST START ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🆔 Student ID:', req.params.id);
  
  try {
    const { id } = req.params;
    
    console.log('🚀 Step 1: Starting database transaction...');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('✅ Transaction started successfully');

      // Get student's current seat
      console.log('🔍 Step 2: Fetching student and seat information...');
      const studentQuery = `
        SELECT s.seat_number 
        FROM students s 
        WHERE s.id = $1
      `;
      const studentResult = await client.query(studentQuery, [id]);
      
      if (studentResult.rows.length === 0) {
        console.log('❌ Student not found with ID:', id);
        return res.status(404).json({ 
          error: 'Student not found',
          studentId: id,
          timestamp: new Date().toISOString()
        });
      }

      const seatNumber = studentResult.rows[0].seat_number;
      console.log('✅ Student found with seat:', seatNumber || 'No seat assigned');

      // Free up the seat if assigned
      if (seatNumber) {
        console.log('🔓 Step 3: Freeing up assigned seat:', seatNumber);
        await client.query(`
          UPDATE seats 
          SET student_id = NULL, status = 'available', occupant_sex = NULL, 
              updated_at = CURRENT_TIMESTAMP
          WHERE seat_number = $1
        `, [seatNumber]);
        console.log('✅ Seat freed up successfully');
      } else {
        console.log('ℹ️ Step 3: No seat to free up');
      }

      // Delete student
      console.log('🗑️ Step 4: Deleting student record...');
      const deleteResult = await client.query('DELETE FROM students WHERE id = $1', [id]);
      console.log('✅ Student deleted, rows affected:', deleteResult.rowCount);

      console.log('💯 Step 5: Committing transaction...');
      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      const executionTime = Date.now() - startTime;
      console.log('🎉 === DELETE STUDENT SUCCESS ===');
      console.log('⏱️ Total execution time:', executionTime + 'ms');
      
      res.json({ 
        message: 'Student deleted successfully',
        studentId: id,
        freedSeat: seatNumber,
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
    const executionTime = Date.now() - startTime;
    
    console.error('💥 === DELETE STUDENT ERROR ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('🔍 Error type:', error.constructor.name);
    console.error('📄 Error message:', error.message);
    console.error('🔢 Error code:', error.code);
    console.error('📝 Error detail:', error.detail);
    console.error('📍 Error stack:', error.stack);
    console.error('🆔 Student ID that failed:', req.params.id);
    
    res.status(500).json({ 
      error: error.message || 'Failed to delete student',
      details: error.detail || 'No additional details',
      studentId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
