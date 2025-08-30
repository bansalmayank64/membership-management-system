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
        seats.seat_number as assigned_seat,
        CASE 
          WHEN s.seat_number IS NOT NULL THEN 'occupied'
          ELSE 'available'
        END as seat_status,
        COALESCE(payment_summary.total_paid, 0) as total_paid,
        payment_summary.last_payment_date
      FROM students s
      LEFT JOIN seats ON s.seat_number = seats.seat_number
      LEFT JOIN (
        SELECT 
          student_id,
          SUM(amount) as total_paid,
          MAX(payment_date) as last_payment_date
        FROM payments 
        GROUP BY student_id
      ) payment_summary ON s.id = payment_summary.student_id
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
        CASE 
          WHEN s.seat_number IS NOT NULL THEN 'occupied'
          ELSE 'available'
        END as seat_status,
        'student' as record_type
      FROM students s
      LEFT JOIN seats ON s.seat_number = seats.seat_number
      where s.status = 'active'
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
        NULL as created_at,
        NULL as updated_at,
        NULL as modified_by,
        seat_number as assigned_seat,
        'available' as seat_status,
        'unassigned_seat' as record_type
      FROM seats 
      WHERE NOT EXISTS (
        SELECT 1 FROM students WHERE students.seat_number = seats.seat_number
      )
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
        seats.seat_number as assigned_seat,
        CASE 
          WHEN s.seat_number IS NOT NULL THEN 'occupied'
          ELSE 'available'
        END as seat_status
      FROM students s
      LEFT JOIN seats ON s.seat_number = seats.seat_number
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

// GET /api/students/available-seats/:gender - Get available seats filtered by gender
router.get('/available-seats/:gender', async (req, res) => {
  const startTime = Date.now();
  console.log('\n🪑 === GET AVAILABLE SEATS BY GENDER REQUEST START ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🚹🚺 Gender filter:', req.params.gender);
  
  try {
    const { gender } = req.params;
    
    // Validate gender parameter
    if (!gender || !['male', 'female'].includes(gender.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid gender parameter. Must be either "male" or "female"',
        received: gender,
        timestamp: new Date().toISOString()
      });
    }
    
    const normalizedGender = gender.toLowerCase();
    console.log('🔍 Step 1: Fetching available seats for gender:', normalizedGender);
    
    const query = `
      SELECT 
        seat_number,
        'available' as status,
        occupant_sex
      FROM seats 
      WHERE (occupant_sex IS NULL OR occupant_sex = $1)
        AND NOT EXISTS (
          SELECT 1 FROM students WHERE students.seat_number = seats.seat_number
        )
      ORDER BY 
        CASE 
          WHEN seat_number ~ '^[0-9]+$' THEN CAST(seat_number AS INTEGER)
          ELSE 999999 
        END ASC,
        seat_number ASC
    `;
    
    console.log('📝 SQL Query:', query);
    console.log('📝 Parameters:', [normalizedGender]);
    
    const result = await pool.query(query, [normalizedGender]);
    
    console.log('✅ Step 2: Query executed successfully');
    console.log('📊 Available seats found:', result.rows.length);
    console.log('🪑 Sample seats:', result.rows.slice(0, 5).map(s => s.seat_number));
    
    const executionTime = Date.now() - startTime;
    console.log('🎉 === GET AVAILABLE SEATS BY GENDER SUCCESS ===');
    console.log('⏱️ Total execution time:', executionTime + 'ms');
    
    res.json({
      gender: normalizedGender,
      availableSeats: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('💥 === GET AVAILABLE SEATS BY GENDER ERROR ===');
    console.error('⏱️ Failed after:', executionTime + 'ms');
    console.error('🔍 Error type:', error.constructor.name);
    console.error('📄 Error message:', error.message);
    console.error('📍 Error stack:', error.stack);
    console.error('🚹🚺 Gender that failed:', req.params.gender);
    
    res.status(500).json({ 
      error: 'Failed to fetch available seats',
      details: error.message,
      gender: req.params.gender,
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
      seat_number
    } = req.body;

    console.log('🔍 Step 1: Validating input data...');

    // Enhanced input validation with database schema constraints
    const validationErrors = [];

    // Name validation (*REQUIRED) - VARCHAR(100) NOT NULL
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      validationErrors.push('*Name is required and must be a non-empty string');
    } else if (name.trim().length < 2) {
      validationErrors.push('*Name must be at least 2 characters long');
    } else if (name.trim().length > 100) {
      validationErrors.push('*Name must not exceed 100 characters (database constraint)');
    } else if (!/^[a-zA-Z\s\.\-']+$/.test(name.trim())) {
      validationErrors.push('*Name can only contain letters, spaces, dots, hyphens, and apostrophes');
    }

    // Gender/Sex validation (*REQUIRED) - CHECK (sex IN ('male','female')) NOT NULL
    if (!sex || typeof sex !== 'string') {
      validationErrors.push('*Gender is required');
    } else if (!['Male', 'Female', 'male', 'female', 'M', 'F', 'm', 'f'].includes(sex.trim())) {
      validationErrors.push('*Gender must be either Male or Female (database constraint: male/female)');
    }

    // Contact number validation (Optional) - VARCHAR(20) UNIQUE
    if (contact_number && typeof contact_number === 'string') {
      const cleanContact = contact_number.replace(/[\s\-\(\)]/g, '');
      if (cleanContact.length > 20) {
        validationErrors.push('Contact number must not exceed 20 characters (database constraint)');
      }
    }

    // Father's name validation (optional) - VARCHAR(100)
    if (father_name && typeof father_name === 'string') {
      if (father_name.trim().length < 2) {
        validationErrors.push("Father's name must be at least 2 characters long if provided");
      } else if (father_name.trim().length > 100) {
        validationErrors.push("Father's name must not exceed 100 characters (database constraint)");
      } else if (!/^[a-zA-Z\s\.\-']+$/.test(father_name.trim())) {
        validationErrors.push("Father's name can only contain letters, spaces, dots, hyphens, and apostrophes");
      }
    }

    // Seat number validation (optional) - VARCHAR(20)
    if (seat_number && typeof seat_number === 'string') {
      if (seat_number.trim().length > 20) {
        validationErrors.push('Seat number must not exceed 20 characters (database constraint)');
      } else if (!/^[A-Za-z0-9\-]+$/.test(seat_number.trim())) {
        validationErrors.push('Seat number can only contain letters, numbers, and hyphens');
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
          seat_number: seat_number || null
        },
        timestamp: new Date().toISOString()
      });
    }

    // Normalize data
    const normalizedName = name.trim().replace(/\s+/g, ' ').toUpperCase();
    const normalizedSex = sex.toLowerCase(); // Database expects lowercase: male/female
    const normalizedContact = contact_number && contact_number.trim() ? contact_number.replace(/[\s\-\(\)]/g, '') : null;
    const normalizedFatherName = father_name ? father_name.trim().replace(/\s+/g, ' ').toUpperCase() : null;
    const normalizedSeatNumber = seat_number ? seat_number.trim().toUpperCase() : null;

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

      // Insert student with all required fields according to the new schema
      console.log('💾 Step 3: Inserting student record...');
      const studentQuery = `
        INSERT INTO students (
          name,
          father_name,
          contact_number,
          sex,
          seat_number,
          membership_date,
          membership_till,
          membership_status,
          created_at,
          updated_at,
          modified_by
        )
        VALUES (
          $1,                             -- name (user input)
          $2,                             -- father_name (user input)
          $3,                             -- contact_number (user input)
          $4,                             -- sex (user input)
          $5,                             -- seat_number (user input)
          CURRENT_TIMESTAMP,              -- membership_date
          null,                           -- membership_till
          'active',                       -- membership_status
          CURRENT_TIMESTAMP,              -- created_at
          CURRENT_TIMESTAMP,              -- updated_at
          $6                              -- modified_by (req.user.userId)
        )
        RETURNING *
      `;
      
      const studentValues = [
        normalizedName, 
        normalizedFatherName, 
        normalizedContact, 
        normalizedSex, 
        normalizedSeatNumber,
        req.user?.userId || req.user?.id || 1
      ];
      console.log('📝 Student query:', studentQuery);
      console.log('📝 Student values:', studentValues);
      
      const studentResult = await client.query(studentQuery, studentValues);

      const student = studentResult.rows[0];
      console.log('✅ Step 3: Student created successfully:', {
        id: student.id,
        name: student.name,
        contact_number: student.contact_number,
        sex: student.sex,
        seat_number: student.seat_number,
        membership_date: student.membership_date,
        membership_till: student.membership_till,
        membership_status: student.membership_status
      });

      console.log('💯 Step 4: Committing transaction...');
      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      // Fetch the complete student data
      console.log('📖 Step 5: Fetching final student data...');
      const finalQuery = `
        SELECT 
          s.*,
          CASE 
            WHEN s.seat_number IS NOT NULL THEN 'occupied'
            ELSE 'available'
          END as seat_status
        FROM students s
        LEFT JOIN seats ON s.seat_number = seats.seat_number
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
      membership_date,
      membership_till, 
      membership_status,
      modified_by 
    } = req.body;

    console.log('🔍 Step 1: Validating input data...');

    // Enhanced input validation with database schema constraints
    const validationErrors = [];

    // ID validation
    if (!id || isNaN(id)) {
      validationErrors.push('Valid student ID is required');
    }

    // Name validation - VARCHAR(100) NOT NULL
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      validationErrors.push('Name is required and must be a non-empty string');
    } else if (name.trim().length < 2) {
      validationErrors.push('Name must be at least 2 characters long');
    } else if (name.trim().length > 100) {
      validationErrors.push('Name must not exceed 100 characters (database constraint)');
    } else if (!/^[a-zA-Z\s\.\-']+$/.test(name.trim())) {
      validationErrors.push('Name can only contain letters, spaces, dots, hyphens, and apostrophes');
    }

    // Gender/Sex validation - CHECK (sex IN ('male','female')) NOT NULL
    if (!sex || typeof sex !== 'string') {
      validationErrors.push('Gender is required');
    } else if (!['Male', 'Female', 'male', 'female', 'M', 'F', 'm', 'f'].includes(sex.trim())) {
      validationErrors.push('Gender must be either Male or Female (database constraint: male/female)');
    }

    // Contact number validation - VARCHAR(20) UNIQUE
    if (contact_number && typeof contact_number === 'string') {
      const cleanContact = contact_number.replace(/[\s\-\(\)]/g, '');
      if (cleanContact.length > 20) {
        validationErrors.push('Contact number must not exceed 20 characters (database constraint)');
      }
    }

    // Father's name validation (optional) - VARCHAR(100)
    if (father_name && typeof father_name === 'string') {
      if (father_name.trim().length < 2) {
        validationErrors.push("Father's name must be at least 2 characters long if provided");
      } else if (father_name.trim().length > 100) {
        validationErrors.push("Father's name must not exceed 100 characters (database constraint)");
      } else if (!/^[a-zA-Z\s\.\-']+$/.test(father_name.trim())) {
        validationErrors.push("Father's name can only contain letters, spaces, dots, hyphens, and apostrophes");
      }
    }

    // Membership date validation
    if (membership_date) {
      const startDate = new Date(membership_date);
      
      if (isNaN(startDate.getTime())) {
        validationErrors.push('Membership start date must be a valid date');
      }
    }

    if (membership_till) {
      const endDate = new Date(membership_till);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(endDate.getTime())) {
        validationErrors.push('Membership till date must be a valid date');
      }
      
      // Cross-validation: if both dates provided, start should be before end
      if (membership_date && membership_till) {
        const startDate = new Date(membership_date);
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate >= endDate) {
          validationErrors.push('Membership start date must be before end date');
        }
      }
    }

    // Seat number validation (optional) - VARCHAR(20)
    if (seat_number && typeof seat_number === 'string') {
      if (seat_number.trim().length > 20) {
        validationErrors.push('Seat number must not exceed 20 characters (database constraint)');
      }
    }

    // Membership status validation - CHECK (membership_status IN ('active','expired','suspended'))
    if (membership_status && !['active', 'inactive', 'suspended', 'expired'].includes(membership_status)) {
      validationErrors.push('Membership status must be one of: active, inactive, suspended, expired (database constraint: active, expired, suspended)');
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
          membership_date: membership_date || null,
          membership_till: membership_till || null,
          membership_status: membership_status || null
        },
        timestamp: new Date().toISOString()
      });
    }

    // Normalize data
    const normalizedName = name.trim().replace(/\s+/g, ' ').toUpperCase();
    const normalizedSex = sex.toLowerCase(); // Database expects lowercase: male/female
    const normalizedContact = contact_number && contact_number.trim() ? contact_number.replace(/[\s\-\(\)]/g, '') : null;
    const normalizedFatherName = father_name ? father_name.trim().replace(/\s+/g, ' ').toUpperCase() : null;
    const normalizedSeatNumber = seat_number ? seat_number.trim().toUpperCase() : null;

    console.log('✅ Step 1: Validation passed - all fields are valid');
    console.log('📋 Normalized data:', {
      id,
      name: normalizedName,
      sex: normalizedSex,
      contact_number: normalizedContact,
      father_name: normalizedFatherName,
      seat_number: normalizedSeatNumber,
      membership_date: membership_date || null,
      membership_till: membership_till || null,
      membership_status
    });

    console.log('🚀 Step 2: Updating student information...');
    
    // Check if student exists
    const checkStudentQuery = `SELECT id FROM students WHERE id = $1`;
    const studentExists = await pool.query(checkStudentQuery, [id]);
    
    if (studentExists.rows.length === 0) {
      console.log('❌ Student not found with ID:', id);
      return res.status(404).json({ 
        error: 'Student not found',
        studentId: id,
        timestamp: new Date().toISOString()
      });
    }

    // Update student information
    console.log('💾 Step 3: Updating student record...');
    const updateQuery = `
      UPDATE students 
      SET name = $1, father_name = $2, contact_number = $3, sex = $4, 
          seat_number = $5, membership_date = $6, membership_till = $7, 
          membership_status = $8, modified_by = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;
    
    const updateValues = [
      normalizedName, 
      normalizedFatherName, 
      normalizedContact, 
      normalizedSex, 
      normalizedSeatNumber,
      membership_date, 
      membership_till, 
      membership_status, 
      req.user?.userId || req.user?.id || 1, 
      id
    ];
    console.log('📝 Update query:', updateQuery);
    console.log('📝 Update values:', updateValues);
    
    const result = await pool.query(updateQuery, updateValues);
    const updatedStudent = result.rows[0];
    
    console.log('✅ Student information updated successfully');
    console.log('� Updated student data:', JSON.stringify(updatedStudent, null, 2));
    
    const executionTime = Date.now() - startTime;
    console.log('🎉 === UPDATE STUDENT SUCCESS ===');
    console.log('⏱️ Total execution time:', executionTime + 'ms');
    
    res.json(updatedStudent);

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
          SET occupant_sex = NULL, 
              updated_at = CURRENT_TIMESTAMP,
              modified_by = $2
          WHERE seat_number = $1
        `, [seatNumber, req.user?.userId || req.user?.id || 1]);
        console.log('✅ Seat freed up successfully with automatic history tracking via triggers');
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

// GET /api/students/:id/history - Get student seat assignment history
router.get('/:id/history', async (req, res) => {
  const requestId = `student-history-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`👤📚 [${new Date().toISOString()}] Starting GET /api/students/:id/history [${requestId}]`);
    
    const { id } = req.params;
    console.log(`📊 Request params: studentId="${id}"`);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`🔍 Step 1: Validating student ID parameter...`);
    if (!id) {
      console.log(`❌ Validation failed: student ID parameter is required`);
      return res.status(400).json({ 
        error: 'Student ID parameter is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing student history query...`);
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
      WHERE sh.student_id = $1
      ORDER BY sh.start_date DESC, sh.action_timestamp DESC
      LIMIT 50
    `;
    
    console.log(`🔧 Step 3: Executing student history query...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [id]);
    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Student history query executed successfully in ${queryTime}ms`);
    console.log(`📋 History records found: ${result.rows.length}`);
    console.log(`📊 Sample history data:`, result.rows.slice(0, 2));
    
    console.log(`🎯 [${new Date().toISOString()}] GET /api/students/:id/history completed successfully in ${totalTime}ms [${requestId}]`);
    res.json(result.rows);
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/students/:id/history FAILED after ${totalTime}ms [${requestId}]`);
    console.error('📍 Error details:', error.message);
    console.error('📍 Error stack:', error.stack);
    console.error('🆔 Student ID that failed:', req.params.id);
    
    res.status(500).json({ 
      error: 'Failed to fetch student history',
      details: error.message,
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/students/fee-config/:gender - Get fee configuration for a gender
router.get('/fee-config/:gender', async (req, res) => {
  const requestId = `student-fee-config-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰 [${new Date().toISOString()}] Starting GET /api/students/fee-config/:gender [${requestId}]`);
    
    const { gender } = req.params;
    console.log(`📊 Request params: gender="${gender}"`);
    
    // Validate gender parameter
    if (!gender || !['male', 'female'].includes(gender.toLowerCase())) {
      console.log('❌ Validation failed: Invalid gender parameter');
      return res.status(400).json({ 
        error: 'Valid gender (male/female) is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('🔍 Step 1: Fetching fee configuration from database...');
    const query = 'SELECT * FROM student_fees_config WHERE gender = $1';
    const result = await pool.query(query, [gender.toLowerCase()]);
    
    if (result.rows.length === 0) {
      console.log('❌ Fee configuration not found for gender:', gender);
      return res.status(404).json({ 
        error: `Fee configuration not found for gender: ${gender}`,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const feeConfig = result.rows[0];
    console.log('✅ Fee configuration found:', feeConfig);
    
    const totalTime = Date.now() - startTime;
    console.log(`🎯 [${new Date().toISOString()}] GET /api/students/fee-config/:gender completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(feeConfig);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/students/fee-config/:gender FAILED after ${totalTime}ms [${requestId}]`);
    console.error('💥 Error details:', {
      message: error.message,
      stack: error.stack,
      gender: req.params.gender
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch fee configuration',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
