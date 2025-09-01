const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/students - Get all students
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('GET /api/students start', { requestId, query: req.query });
  
  try {
  logger.info('Executing students query', { requestId });
    
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
    
  logger.queryStart('students list', query);
  const result = await pool.query(query);
  logger.querySuccess('students list', null, result, false);

  const executionTime = Date.now() - startTime;
  logger.info('GET /api/students success', { requestId, executionTime, count: result.rows.length });

  res.json(result.rows);
  } catch (error) {
  const executionTime = Date.now() - startTime;
  logger.requestError('GET', '/api/students', requestId, startTime, error);
  res.status(500).json({ error: 'Failed to fetch students', details: error.message, timestamp: new Date().toISOString() });
  }
});

// GET /api/students/with-unassigned-seats - Get all students with unassigned seats included
router.get('/with-unassigned-seats', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('GET /api/students/with-unassigned-seats start', { requestId });
  
  try {
  logger.info('Executing students + unassigned seats queries', { requestId });
    
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
    
  logger.queryStart('students with seats', studentsQuery);
  const studentsResult = await pool.query(studentsQuery);
  logger.querySuccess('students with seats', null, studentsResult, false);

  logger.queryStart('unassigned seats', unassignedSeatsQuery);
  const unassignedSeatsResult = await pool.query(unassignedSeatsQuery);
  logger.querySuccess('unassigned seats', null, unassignedSeatsResult, false);
    
    // Combine results
    const combinedResults = [
      ...studentsResult.rows,
      ...unassignedSeatsResult.rows
    ];
    
  const executionTime = Date.now() - startTime;
  logger.info('GET /api/students/with-unassigned-seats success', { requestId, executionTime, students: studentsResult.rows.length, availableSeats: unassignedSeatsResult.rows.length });

  res.json({ students: studentsResult.rows, unassignedSeats: unassignedSeatsResult.rows, combined: combinedResults, stats: { totalStudents: studentsResult.rows.length, assignedStudents: studentsResult.rows.filter(s => s.assigned_seat).length, unassignedStudents: studentsResult.rows.filter(s => !s.assigned_seat).length, availableSeats: unassignedSeatsResult.rows.length } });
  } catch (error) {
  const executionTime = Date.now() - startTime;
  logger.requestError('GET', '/api/students/with-unassigned-seats', requestId, startTime, error);
  res.status(500).json({ error: 'Failed to fetch students with unassigned seats', details: error.message, timestamp: new Date().toISOString() });
  }
});

// GET /api/students/:id - Get student by ID
router.get('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('GET /api/students/:id start', { requestId, studentId: req.params.id });
  
  try {
    const { id } = req.params;
  logger.info('Executing student by id query', { requestId, studentId: id });
    
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
    
    logger.queryStart('student by id', query, [id]);
    const result = await pool.query(query, [id]);
    logger.querySuccess('student by id', null, result, false);

    if (result.rows.length === 0) {
      logger.info('Student not found', { requestId, studentId: id });
      return res.status(404).json({ error: 'Student not found', studentId: id, timestamp: new Date().toISOString() });
    }

    const executionTime = Date.now() - startTime;
    logger.info('GET /api/students/:id success', { requestId, studentId: id, executionTime });
    res.json(result.rows[0]);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.requestError('GET', `/api/students/${req.params.id}`, requestId, startTime, error);
    res.status(500).json({ error: 'Failed to fetch student', details: error.message, studentId: req.params.id, timestamp: new Date().toISOString() });
  }
});

// GET /api/students/available-seats/:gender - Get available seats filtered by gender
router.get('/available-seats/:gender', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('GET /api/students/available-seats start', { requestId, gender: req.params.gender });
  
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
  logger.info('Fetching available seats for gender', { requestId, gender: normalizedGender });
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
    
  logger.queryStart('available seats by gender', query, [normalizedGender]);
  const result = await pool.query(query, [normalizedGender]);
  logger.querySuccess('available seats by gender', null, result, false);

  const executionTime = Date.now() - startTime;
  logger.info('GET /api/students/available-seats success', { requestId, gender: normalizedGender, count: result.rows.length, executionTime });

  res.json({ gender: normalizedGender, availableSeats: result.rows, count: result.rows.length, timestamp: new Date().toISOString() });
  } catch (error) {
  const executionTime = Date.now() - startTime;
  logger.requestError('GET', `/api/students/available-seats/${req.params.gender}`, requestId, startTime, error);
  res.status(500).json({ error: 'Failed to fetch available seats', details: error.message, gender: req.params.gender, timestamp: new Date().toISOString() });
  }
});

// POST /api/students - Create new student
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('POST /api/students start', { requestId, body: logger.maskSensitiveData(req.body) });
  
  try {
    const { 
      name, 
      father_name, 
      contact_number, 
      sex, 
      seat_number,
      aadhaar_number,
      address
    } = req.body;

  logger.info('Validating input data', { requestId });

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

    // Aadhaar number validation (*REQUIRED) - VARCHAR(20)
    if (!aadhaar_number || typeof aadhaar_number !== 'string' || aadhaar_number.trim().length === 0) {
      validationErrors.push('*Aadhaar number is required');
    } else {
      // Normalize by removing non-digits and validate length (common Aadhaar length = 12)
      const cleanAadhaar = aadhaar_number.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        validationErrors.push('*Aadhaar number must contain 12 digits');
      } else if (cleanAadhaar.length > 20) {
        validationErrors.push('Aadhaar number must not exceed 20 characters (database constraint)');
      }
    }

    // Address validation (*REQUIRED) - TEXT
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      validationErrors.push('*Address is required');
    } else if (address.trim().length > 1000) {
      validationErrors.push('Address is too long');
    }

    // Father's name validation (optional) - VARCHAR(100)
    if (father_name && typeof father_name === 'string') {
      if (father_name.trim().length < 2) {
        validationErrors.push("Father's name must be at least 2 characters long if provided");
      } else if (father_name.trim().length > 100) {
        validationErrors.push("Father's name must not exceed 100 characters (database constraint)");
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
      logger.warn('Validation failed for create student', { requestId, errors: validationErrors });
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, received: { name: name || null, sex: sex || null, contact_number: contact_number || null, father_name: father_name || null, seat_number: seat_number || null }, timestamp: new Date().toISOString() });
    }

    // Normalize data
  const normalizedName = name.trim().replace(/\s+/g, ' ').toUpperCase();
    const normalizedSex = sex.toLowerCase(); // Database expects lowercase: male/female
    const normalizedContact = contact_number && contact_number.trim() ? contact_number.replace(/[\s\-\(\)]/g, '') : null;
    const normalizedFatherName = father_name ? father_name.trim().replace(/\s+/g, ' ').toUpperCase() : null;
    const normalizedSeatNumber = seat_number ? seat_number.trim().toUpperCase() : null;
  const normalizedAadhaar = aadhaar_number ? aadhaar_number.replace(/\D/g, '') : null;
  const normalizedAddress = address ? address.trim() : null;

  logger.info('Validation passed', { requestId, normalized: { name: normalizedName, sex: normalizedSex, contact_number: normalizedContact, father_name: normalizedFatherName, seat_number: normalizedSeatNumber } });

    // Start transaction
  logger.info('Starting database transaction', { requestId });
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
  logger.info('Transaction started', { requestId });

      // Check if Aadhaar already exists - prevent duplicate creation
      if (normalizedAadhaar) {
        // Return key fields so frontend can show helpful info (contact, seat, aadhaar, address, etc.)
        const existingQuery = `SELECT id, name, membership_status, contact_number, seat_number, aadhaar_number, address, father_name, sex, membership_date, membership_till FROM students WHERE aadhaar_number = $1 LIMIT 1`;
        logger.queryStart('check existing aadhaar', existingQuery, [normalizedAadhaar]);
        const existingRes = await client.query(existingQuery, [normalizedAadhaar]);
        logger.querySuccess('check existing aadhaar', null, existingRes, false);
        if (existingRes.rows.length > 0) {
          // Do not create duplicate - inform client
          await client.query('ROLLBACK');
          logger.warn('Attempt to create student with existing aadhaar', { requestId, aadhaar: normalizedAadhaar, existingId: existingRes.rows[0].id });
          return res.status(409).json({ error: 'Aadhaar already exists', student: existingRes.rows[0], timestamp: new Date().toISOString() });
        }
      }

      // Insert student with all required fields according to the new schema
  logger.info('Inserting student record', { requestId });
  const studentQuery = `
        INSERT INTO students (
          name,
          father_name,
          contact_number,
          aadhaar_number,
          address,
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
          $4,                             -- aadhaar_number (user input)
          $5,                             -- address (user input)
          $6,                             -- sex (user input)
          $7,                             -- seat_number (user input)
          CURRENT_TIMESTAMP,              -- membership_date
          null,                           -- membership_till
          'active',                       -- membership_status
          CURRENT_TIMESTAMP,              -- created_at
          CURRENT_TIMESTAMP,              -- updated_at
          $8                              -- modified_by (req.user.userId)
        )
        RETURNING *
      `;
      
      const studentValues = [
  normalizedName,
  normalizedFatherName,
  normalizedContact,
  normalizedAadhaar,
  normalizedAddress,
  normalizedSex,
  normalizedSeatNumber,
  req.user?.userId || req.user?.id || 1
      ];
  logger.queryStart('insert student', studentQuery, studentValues);
  const studentResult = await client.query(studentQuery, studentValues);
  logger.querySuccess('insert student', null, studentResult, false);

  const student = studentResult.rows[0];
  logger.info('Student created', { requestId, studentId: student.id });

  logger.info('Committing transaction', { requestId });
  await client.query('COMMIT');
  logger.info('Transaction committed', { requestId });
      
      // Fetch the complete student data
  logger.info('Fetching final student data', { requestId, studentId: student.id });
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
      
  logger.info('Create student success', { requestId, studentId: student.id, executionTime: Date.now() - startTime });
  res.status(201).json(finalStudent);
      
    } catch (error) {
      logger.warn('Rolling back transaction due to error', { requestId, error: error.message });
      await client.query('ROLLBACK');
      logger.info('Transaction rolled back', { requestId });
      throw error;
    } finally {
      logger.info('Releasing database connection', { requestId });
      client.release();
      logger.info('Database connection released', { requestId });
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.requestError('POST', '/api/students', requestId, startTime, error);
    if (error.code === '23505' && error.constraint === 'students_contact_number_key') {
      logger.warn('Duplicate contact number on create student', { requestId });
      return res.status(400).json({ error: 'Contact number already exists', constraint: error.constraint, timestamp: new Date().toISOString() });
    }

    res.status(500).json({ error: error.message || 'Failed to create student', details: error.detail || 'No additional details', timestamp: new Date().toISOString() });
  }
});

// PUT /api/students/:id - Update student
router.put('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('PUT /api/students/:id start', { requestId, studentId: req.params.id, body: logger.maskSensitiveData(req.body) });
  
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
      aadhaar_number,
      address,
      modified_by 
    } = req.body;

  logger.info('Validating update input', { requestId, studentId: id });

    // Enhanced input validation with database schema constraints
    const validationErrors = [];

    // ID validation
    if (!id || isNaN(id)) {
      validationErrors.push('Valid student ID is required');
    }

    // If ID looks valid, fetch existing student so we can default missing fields
    let currentStudentRow = null;
    if (validationErrors.length === 0) {
      const checkStudentQuery = `SELECT * FROM students WHERE id = $1`;
      const studentExists = await pool.query(checkStudentQuery, [id]);
      if (studentExists.rows.length === 0) {
        logger.warn('Student not found for update', { requestId, studentId: id });
        return res.status(404).json({ 
          error: 'Student not found',
          studentId: id,
          timestamp: new Date().toISOString()
        });
      }
      currentStudentRow = studentExists.rows[0];
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

    // Aadhaar number validation - only validate if provided in update payload
    if (aadhaar_number && typeof aadhaar_number === 'string' && aadhaar_number.trim().length > 0) {
      const cleanAadhaar = aadhaar_number.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        validationErrors.push('*Aadhaar number must contain 12 digits');
      } else if (cleanAadhaar.length > 20) {
        validationErrors.push('Aadhaar number must not exceed 20 characters (database constraint)');
      }
    }

    // Address validation - only validate if provided in update payload
    if (address && typeof address === 'string' && address.trim().length > 0) {
      if (address.trim().length > 1000) {
        validationErrors.push('Address is too long');
      }
    }

    // Father's name validation (optional) - VARCHAR(100)
    if (father_name && typeof father_name === 'string') {
      if (father_name.trim().length < 2) {
        validationErrors.push("Father's name must be at least 2 characters long if provided");
      } else if (father_name.trim().length > 100) {
        validationErrors.push("Father's name must not exceed 100 characters (database constraint)");
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

    // Normalize membership status (do not reassign destructured const)
    const effectiveMembershipStatus = membership_status || 'active';

    if (validationErrors.length > 0) {
      logger.warn('Validation failed for update', { requestId, errors: validationErrors });
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, received: { id: id || null, name: name || null, sex: sex || null, contact_number: contact_number || null, father_name: father_name || null, seat_number: seat_number || null, membership_date: membership_date || null, membership_till: membership_till || null, membership_status: membership_status || null }, timestamp: new Date().toISOString() });
    }

    // Normalize data
  const normalizedName = name.trim().replace(/\s+/g, ' ').toUpperCase();
    const normalizedSex = sex.toLowerCase(); // Database expects lowercase: male/female
    const normalizedContact = contact_number && contact_number.trim() ? contact_number.replace(/[\s\-\(\)]/g, '') : null;
    const normalizedFatherName = father_name ? father_name.trim().replace(/\s+/g, ' ').toUpperCase() : null;
    const normalizedSeatNumber = seat_number ? seat_number.trim().toUpperCase() : null;
  // Default to existing values when field not provided in update
  const normalizedAadhaar = (aadhaar_number && aadhaar_number.trim().length > 0) ? aadhaar_number.replace(/\D/g, '') : (currentStudentRow ? currentStudentRow.aadhaar_number : null);
  const normalizedAddress = (address && address.trim().length > 0) ? address.trim() : (currentStudentRow ? currentStudentRow.address : null);

  logger.info('Validation passed for update', { requestId, id, normalized: { name: normalizedName, sex: normalizedSex, contact_number: normalizedContact, father_name: normalizedFatherName, seat_number: normalizedSeatNumber, membership_date: membership_date || null, membership_till: membership_till || null, membership_status: effectiveMembershipStatus } });
  logger.info('Updating student information', { requestId, id });
    
    // Check if student exists
    const checkStudentQuery = `SELECT id FROM students WHERE id = $1`;
    const studentExists = await pool.query(checkStudentQuery, [id]);
    
    if (studentExists.rows.length === 0) {
        logger.warn('Student not found for update', { requestId, studentId: id });
      return res.status(404).json({ 
        error: 'Student not found',
        studentId: id,
        timestamp: new Date().toISOString()
      });
    }

      // Update student information
      logger.info('Updating student record', { requestId, studentId: id });
    const updateQuery = `
      UPDATE students 
      SET name = $1, father_name = $2, contact_number = $3, aadhaar_number = $4, address = $5, sex = $6, 
          seat_number = $7, membership_date = $8, membership_till = $9, 
          membership_status = $10, modified_by = $11, updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `;
    
    const updateValues = [
      normalizedName, 
      normalizedFatherName, 
      normalizedContact, 
      normalizedAadhaar,
      normalizedAddress,
      normalizedSex, 
      normalizedSeatNumber,
      membership_date, 
      membership_till, 
      effectiveMembershipStatus, 
      req.user?.userId || req.user?.id || 1, 
      id
    ];
  logger.queryStart('update student', updateQuery, updateValues);
  const result = await pool.query(updateQuery, updateValues);
  const updatedStudent = result.rows[0];
  logger.querySuccess('update student', null, result, false);
  logger.info('Student updated successfully', { requestId, id });
  res.json(updatedStudent);

  } catch (error) {
  const executionTime = Date.now() - startTime;
  logger.requestError('PUT', `/api/students/${req.params.id}`, requestId, startTime, error);
  // Handle unique aadhaar violation gracefully
  if (error && error.code === '23505' && error.constraint && error.constraint.includes('aadhaar')) {
    logger.warn('Duplicate aadhaar on update', { requestId, constraint: error.constraint });
    return res.status(409).json({ error: 'Aadhaar already exists for another student', constraint: error.constraint, timestamp: new Date().toISOString() });
  }
  res.status(500).json({ error: error.message || 'Failed to update student', details: error.detail || 'No additional details', studentId: req.params.id, timestamp: new Date().toISOString() });
  }
});

// GET /api/students/by-aadhaar/:aadhaar - Lookup student by Aadhaar
router.get('/by-aadhaar/:aadhaar', async (req, res) => {
  const requestId = `student-by-aadhaar-${Date.now()}`;
  try {
    const raw = req.params.aadhaar || '';
    const clean = raw.replace(/\D/g, '');
    if (!clean) return res.status(400).json({ error: 'Aadhaar is required', timestamp: new Date().toISOString() });

    const query = `SELECT id, name, membership_status, seat_number, contact_number FROM students WHERE aadhaar_number = $1 LIMIT 1`;
    const result = await pool.query(query, [clean]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.requestError('GET', `/api/students/by-aadhaar/${req.params.aadhaar}`, requestId, Date.now(), err);
    res.status(500).json({ error: 'Failed to lookup by aadhaar', details: err.message });
  }
});

// PATCH /api/students/:id/activate - activate a student by id and optionally set membership_status to active
router.patch('/:id/activate', async (req, res) => {
  const requestId = `activate-student-${Date.now()}`;
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Student id required' });

    const query = `UPDATE students SET membership_status = 'active', updated_at = CURRENT_TIMESTAMP, modified_by = $1 WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [req.user?.userId || req.user?.id || 1, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.requestError('PATCH', `/api/students/${req.params.id}/activate`, requestId, Date.now(), err);
    res.status(500).json({ error: 'Failed to activate student', details: err.message });
  }
});

// DELETE /api/students/:id - Delete student
router.delete('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('DELETE /api/students start', { requestId, studentId: req.params.id });
  
  try {
    const { id } = req.params;
    
    logger.info('Starting transaction for delete', { requestId });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      logger.info('Transaction started for delete', { requestId });

      // Get student's current seat
      logger.info('Fetching student and seat information', { requestId, studentId: id });
      const studentQuery = `
        SELECT s.seat_number 
        FROM students s 
        WHERE s.id = $1
      `;
      const studentResult = await client.query(studentQuery, [id]);
      
      if (studentResult.rows.length === 0) {
  logger.info('Student not found for delete', { requestId, studentId: id });
  return res.status(404).json({ error: 'Student not found', studentId: id, timestamp: new Date().toISOString() });
      }

      const seatNumber = studentResult.rows[0].seat_number;
  logger.info('Student found for delete', { requestId, studentId: id, seatNumber: seatNumber || null });

      // Free up the seat if assigned
      if (seatNumber) {
  logger.info('Freeing up assigned seat', { requestId, seatNumber });
  await client.query(`
          UPDATE seats 
          SET occupant_sex = NULL, 
              updated_at = CURRENT_TIMESTAMP,
              modified_by = $2
          WHERE seat_number = $1
        `, [seatNumber, req.user?.userId || req.user?.id || 1]);
  logger.info('Seat freed up successfully', { requestId, seatNumber });
      } else {
  logger.info('No seat to free up for delete', { requestId, studentId: id });
      }

      // Delete student
  logger.info('Deleting student record', { requestId, studentId: id });
  const deleteResult = await client.query('DELETE FROM students WHERE id = $1', [id]);
  logger.info('Student deleted', { requestId, studentId: id, rowsAffected: deleteResult.rowCount });

  logger.info('Committing delete transaction', { requestId });
  await client.query('COMMIT');
  logger.info('Delete transaction committed', { requestId });
      
      const executionTime = Date.now() - startTime;
  logger.info('DELETE STUDENT SUCCESS', { requestId, studentId: id, executionTime });
      
      res.json({ 
        message: 'Student deleted successfully',
        studentId: id,
        freedSeat: seatNumber,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
  logger.warn('Rolling back delete transaction due to error', { requestId, error: error.message });
  await client.query('ROLLBACK');
  logger.info('Delete transaction rolled back', { requestId });
  throw error;
    } finally {
  logger.info('Releasing database connection after delete', { requestId });
  client.release();
  logger.info('Database connection released after delete', { requestId });
    }

  } catch (error) {
  const executionTime = Date.now() - startTime;
  logger.requestError('DELETE', `/api/students/${req.params.id}`, requestId, startTime, error);
  res.status(500).json({ error: error.message || 'Failed to delete student', details: error.detail || 'No additional details', studentId: req.params.id, timestamp: new Date().toISOString() });
  }
});

// GET /api/students/:id/history - Get student seat assignment history
router.get('/:id/history', async (req, res) => {
  const requestId = `student-history-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    logger.info('GET /api/students/:id/history start', { requestId, params: req.params });
    const { id } = req.params;
    if (!id) {
      logger.warn('Validation failed: student id required', { requestId });
      return res.status(400).json({ error: 'Student ID parameter is required', requestId: requestId, timestamp: new Date().toISOString() });
    }
    
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
    
  logger.queryStart('student history', query, [id]);
  const queryStart = Date.now();
  const result = await pool.query(query, [id]);
  const queryTime = Date.now() - queryStart;
  logger.querySuccess('student history', null, result, false);
  logger.info('GET student history success', { requestId, queryTime, count: result.rows.length });
  res.json(result.rows);
    
  } catch (error) {
  const totalTime = Date.now() - startTime;
  logger.requestError('GET', `/api/students/${req.params.id}/history`, requestId, startTime, error);
  res.status(500).json({ error: 'Failed to fetch student history', details: error.message, requestId: requestId, timestamp: new Date().toISOString() });
  }
});

// GET /api/students/fee-config/:gender - Get fee configuration for a gender
router.get('/fee-config/:gender', async (req, res) => {
  const requestId = `student-fee-config-${Date.now()}`;
  const startTime = Date.now();
  try {
    logger.info('GET /api/students/fee-config start', { requestId, params: req.params });
    const { gender } = req.params;
    if (!gender || !['male', 'female'].includes(gender.toLowerCase())) {
      logger.warn('Invalid gender parameter for fee-config', { requestId, gender });
      return res.status(400).json({ error: 'Valid gender (male/female) is required', requestId: requestId, timestamp: new Date().toISOString() });
    }

    logger.info('Fetching fee configuration from DB', { requestId, gender });
    const query = 'SELECT * FROM student_fees_config WHERE gender = $1';
    const result = await pool.query(query, [gender.toLowerCase()]);

    if (result.rows.length === 0) {
      logger.info('Fee configuration not found', { requestId, gender });
      return res.status(404).json({ error: `Fee configuration not found for gender: ${gender}`, requestId: requestId, timestamp: new Date().toISOString() });
    }

    const feeConfig = result.rows[0];
    logger.info('Fee configuration found', { requestId, gender });
    res.json(feeConfig);
  } catch (error) {
    logger.requestError('GET', `/api/students/fee-config/${req.params.gender}`, requestId, startTime, error);
    res.status(500).json({ error: 'Failed to fetch fee configuration', requestId: requestId, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
