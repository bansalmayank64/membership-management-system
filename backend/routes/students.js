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
    
    // Check if including inactive students is requested (for admin interface)
    const includeInactive = req.query.include_inactive === 'true';
    const membershipStatusFilter = includeInactive ? '' : "WHERE s.membership_status = 'active'";
    
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
      ${membershipStatusFilter}
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
    
    // Check if including inactive students is requested (for admin interface)
    const includeInactive = req.query.include_inactive === 'true';
    const membershipStatusFilter = includeInactive ? '' : "WHERE s.membership_status = 'active'";
    
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
      ${membershipStatusFilter}
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
        SELECT 1 FROM students WHERE students.seat_number = seats.seat_number ${includeInactive ? '' : "AND students.membership_status = 'active'"}
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
        END as seat_status,
        COALESCE(payment_summary.total_paid, 0) as total_paid,
        payment_summary.last_payment_date
      FROM students s
      LEFT JOIN seats ON s.seat_number = seats.seat_number
      LEFT JOIN (
        SELECT student_id, SUM(amount) as total_paid, MAX(payment_date) as last_payment_date
        FROM payments
        GROUP BY student_id
      ) payment_summary ON s.id = payment_summary.student_id
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
          SELECT 1 FROM students WHERE students.seat_number = seats.seat_number AND students.membership_status = 'active'
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
      address,
      membership_type,
      membership_date
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

    // Membership type validation removed - now accepts any membership type value
    // Default to 'full_time' if not provided for backward compatibility
    const defaultMembershipType = 'full_time';

    // Contact number validation (Optional) - VARCHAR(20) UNIQUE
    if (contact_number && typeof contact_number === 'string') {
      const cleanContact = contact_number.replace(/[\s\-\(\)]/g, '');
      if (cleanContact.length > 20) {
        validationErrors.push('Contact number must not exceed 20 characters (database constraint)');
      }
    }

    // Aadhaar number validation (optional) - VARCHAR(20)
    if (aadhaar_number && typeof aadhaar_number === 'string' && aadhaar_number.trim().length > 0) {
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
  // Normalize membership_date if provided (expect YYYY-MM-DD or ISO string). Convert to date-only (YYYY-MM-DD)
  // to avoid timezone shifts when storing in the DB.
  let normalizedMembershipDate = null;
  if (membership_date && typeof membership_date === 'string') {
    const raw = membership_date.trim();
    // If client sent a date-only string, keep it as-is
    const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateOnlyMatch) {
      normalizedMembershipDate = dateOnlyMatch[1];
    } else {
      // Try to parse and convert to local date components (YYYY-MM-DD)
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        normalizedMembershipDate = `${y}-${m}-${d}`;
      }
    }
  }

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
          membership_type,
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
          $7,                             -- membership_type (user input)
          $8,                             -- seat_number (user input)
          $9,                             -- membership_date (from client or null)
          $9,                             -- membership_till (set to membership start date)
          'active',                       -- membership_status
          CURRENT_TIMESTAMP,              -- created_at
          CURRENT_TIMESTAMP,              -- updated_at
          $10                             -- modified_by (req.user.userId)
        )
        RETURNING *
      `;
      
    const effectiveMembershipType = (membership_type && membership_type.trim()) ? membership_type.trim() : defaultMembershipType;
    const studentValues = [
  normalizedName,
  normalizedFatherName,
  normalizedContact,
  normalizedAadhaar,
  normalizedAddress,
  normalizedSex,
  effectiveMembershipType,
  normalizedSeatNumber,
  normalizedMembershipDate,
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
      modified_by,
      membership_type
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

    // Default name/sex to existing DB values when not provided (allow partial updates)
    const nameToValidate = (name !== undefined && name !== null) ? name : (currentStudentRow ? currentStudentRow.name : null);
    const sexToValidate = (sex !== undefined && sex !== null) ? sex : (currentStudentRow ? currentStudentRow.sex : null);

    // Name validation - VARCHAR(100) NOT NULL
    if (!nameToValidate || typeof nameToValidate !== 'string' || nameToValidate.trim().length === 0) {
      validationErrors.push('Name is required and must be a non-empty string');
    } else if (nameToValidate.trim().length < 2) {
      validationErrors.push('Name must be at least 2 characters long');
    } else if (nameToValidate.trim().length > 100) {
      validationErrors.push('Name must not exceed 100 characters (database constraint)');
    } else if (!/^[a-zA-Z\s\.\-']+$/.test(nameToValidate.trim())) {
      validationErrors.push('Name can only contain letters, spaces, dots, hyphens, and apostrophes');
    }

    // Gender/Sex validation - CHECK (sex IN ('male','female')) NOT NULL
    if (!sexToValidate || typeof sexToValidate !== 'string') {
      validationErrors.push('Gender is required');
    } else if (!['Male', 'Female', 'male', 'female', 'M', 'F', 'm', 'f'].includes(sexToValidate.trim())) {
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
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate > endDate) {
          // allow same-day start and end; only error when start is after end
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

    // Membership type validation removed - now accepts any membership type value
    // Default to existing value or 'full_time' for backward compatibility

    // Normalize membership status (do not reassign destructured const)
    const effectiveMembershipStatus = membership_status || 'active';

    if (validationErrors.length > 0) {
      logger.warn('Validation failed for update', { requestId, errors: validationErrors });
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, received: { id: id || null, name: name || null, sex: sex || null, contact_number: contact_number || null, father_name: father_name || null, seat_number: seat_number || null, membership_date: membership_date || null, membership_till: membership_till || null, membership_status: membership_status || null }, timestamp: new Date().toISOString() });
    }

    // Normalize data
  const normalizedName = (nameToValidate || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const normalizedSex = (sexToValidate || '').toLowerCase(); // Database expects lowercase: male/female
    const normalizedContact = contact_number && contact_number.trim() ? contact_number.replace(/[\s\-\(\)]/g, '') : null;
    const normalizedFatherName = father_name ? father_name.trim().replace(/\s+/g, ' ').toUpperCase() : null;
    const normalizedSeatNumber = seat_number ? seat_number.trim().toUpperCase() : null;
  // Default to existing values when field not provided in update
  const normalizedAadhaar = (aadhaar_number && aadhaar_number.trim().length > 0) ? aadhaar_number.replace(/\D/g, '') : (currentStudentRow ? currentStudentRow.aadhaar_number : null);
  const normalizedAddress = (address && address.trim().length > 0) ? address.trim() : (currentStudentRow ? currentStudentRow.address : null);
  // Normalize membership_date and membership_till to date-only strings to avoid timezone shifts
  let normalizedMembershipDateForUpdate = membership_date && typeof membership_date === 'string' ? (membership_date.match(/^(\d{4}-\d{2}-\d{2})$/) ? membership_date : (() => { const d = new Date(membership_date); return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()) : (currentStudentRow ? currentStudentRow.membership_date : null);
  let normalizedMembershipTillForUpdate = membership_till && typeof membership_till === 'string' ? (membership_till.match(/^(\d{4}-\d{2}-\d{2})$/) ? membership_till : (() => { const d = new Date(membership_till); return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()) : (currentStudentRow ? currentStudentRow.membership_till : null);

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
        membership_type = $7, seat_number = $8, membership_date = $9, membership_till = $10, 
          membership_status = $11, modified_by = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `;
    
    const updateValues = [
      normalizedName, 
      normalizedFatherName, 
      normalizedContact, 
      normalizedAadhaar,
      normalizedAddress,
      normalizedSex, 
      (membership_type && membership_type.trim()) ? membership_type.trim() : (currentStudentRow ? currentStudentRow.membership_type : 'full_time'),
      normalizedSeatNumber,
  normalizedMembershipDateForUpdate, 
  normalizedMembershipTillForUpdate, 
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
    // Changed behavior: always return 200 with a found flag to avoid frontend 404 noise.
    // Backward compatibility: old clients that expected the raw student object can still
    // handle this because they checked for an 'id' property; we now nest under 'student'.
    if (result.rows.length === 0) {
      return res.json({ found: false, student: null, timestamp: new Date().toISOString() });
    }
    return res.json({ found: true, student: result.rows[0], timestamp: new Date().toISOString() });
  } catch (err) {
    logger.requestError('GET', `/api/students/by-aadhaar/${req.params.aadhaar}`, requestId, Date.now(), err);
    res.status(500).json({ error: 'Failed to lookup by aadhaar', details: err.message });
  }
});

// PATCH /api/students/:id/activate - activate a student by id with reactivation options
router.patch('/:id/activate', async (req, res) => {
  const startTime = Date.now();
  const requestId = `activate-student-${Date.now()}`;
  logger.info('PATCH /api/students/:id/activate start', { requestId, studentId: req.params.id, body: req.body });
  
  try {
    const { id } = req.params;
    const { reactivationType } = req.body;
    
    // Validate required parameters
    if (!id) {
      logger.warn('Student ID required for activation', { requestId });
      return res.status(400).json({ error: 'Student id required', timestamp: new Date().toISOString() });
    }

    // Validate reactivationType - should be either 'resume' or 'fresh'
    if (!reactivationType || !['resume', 'fresh'].includes(reactivationType)) {
      logger.warn('Invalid reactivationType for activation', { requestId, reactivationType });
      return res.status(400).json({ 
        error: 'Invalid reactivationType. Must be either "resume" (Resume from previous membership end date) or "fresh" (Start fresh membership from today)',
        received: reactivationType,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Starting activation transaction', { requestId, studentId: id, reactivationType });
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      logger.info('Transaction started for activation', { requestId });

      // Get current student data to check previous membership details
      const studentQuery = `SELECT * FROM students WHERE id = $1`;
      const studentResult = await client.query(studentQuery, [id]);
      
      if (studentResult.rows.length === 0) {
        logger.warn('Student not found for activation', { requestId, studentId: id });
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found', studentId: id, timestamp: new Date().toISOString() });
      }

      const student = studentResult.rows[0];
      logger.info('Student found for activation', { requestId, studentId: id, currentStatus: student.membership_status, membershipTill: student.membership_till });

      // Calculate new membership start date based on reactivationType
      let newMembershipDate;
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format

      if (reactivationType === 'resume') {
        // Resume: Keep original membership start date
        newMembershipDate = student.membership_date; // Keep existing membership_date
        logger.info('Resume reactivation - keeping original membership date', { 
          requestId, 
          originalMembershipDate: student.membership_date, 
          membershipTill: student.membership_till 
        });
      } else if (reactivationType === 'fresh') {
        // Fresh: Update membership start date to today
        newMembershipDate = today;
        logger.info('Fresh reactivation - setting new membership date to today', { 
          requestId, 
          newMembershipDate, 
          originalMembershipDate: student.membership_date,
          membershipTill: student.membership_till 
        });
      }

      // Update student with new activation details (membership_status, membership_date, and membership_till)
      logger.info('Updating student with new activation details', { requestId, studentId: id });
      const updateQuery = `
        UPDATE students 
        SET membership_status = 'active', 
            membership_date = $1,
            membership_till = $1,
            updated_at = CURRENT_TIMESTAMP, 
            modified_by = $2 
        WHERE id = $3 
        RETURNING *
      `;
      
      const updateValues = [newMembershipDate, req.user?.userId || req.user?.id || 1, id];
      logger.queryStart('activate student', updateQuery, updateValues);
      const result = await client.query(updateQuery, updateValues);
      logger.querySuccess('activate student', null, result, false);

      if (result.rows.length === 0) {
        logger.warn('Student activation affected no rows', { requestId, studentId: id });
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found during activation', studentId: id, timestamp: new Date().toISOString() });
      }

      logger.info('Committing activation transaction', { requestId });
      await client.query('COMMIT');
      logger.info('Activation transaction committed', { requestId });

      const activatedStudent = result.rows[0];
      const executionTime = Date.now() - startTime;
      
      logger.info('Student activation success', { 
        requestId, 
        studentId: id, 
        reactivationType, 
        executionTime,
        newMembershipDate,
        membershipTill: activatedStudent.membership_till
      });

      res.json({
        success: true,
        student: activatedStudent,
        reactivationType,
        membershipPeriod: {
          from: newMembershipDate,
          till: activatedStudent.membership_till
        },
        message: reactivationType === 'resume' 
          ? 'Student reactivated with original membership dates'
          : 'Student reactivated with fresh membership start date',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.warn('Rolling back activation transaction due to error', { requestId, error: error.message });
      await client.query('ROLLBACK');
      logger.info('Activation transaction rolled back', { requestId });
      throw error;
    } finally {
      logger.info('Releasing database connection after activation', { requestId });
      client.release();
      logger.info('Database connection released after activation', { requestId });
    }

  } catch (err) {
    const executionTime = Date.now() - startTime;
    logger.requestError('PATCH', `/api/students/${req.params.id}/activate`, requestId, startTime, err);
    res.status(500).json({ 
      error: 'Failed to activate student', 
      details: err.message, 
      studentId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/students/:id/deactivate - Deactivate student (no refund)
router.post('/:id/deactivate', async (req, res) => {
  const requestId = `deactivate-student-${Date.now()}`;
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Student id required' });

    // Only allow if user is admin or authorized (add your auth logic as needed)
    // if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    // Set membership_status to 'inactive', clear seat assignment, set membership_till to today
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const updateQuery = `UPDATE students SET membership_status = 'inactive', seat_number = NULL, membership_till = $1, updated_at = CURRENT_TIMESTAMP, modified_by = $2 WHERE id = $3 RETURNING *`;
    const result = await pool.query(updateQuery, [todayIso, req.user?.userId || req.user?.id || 1, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    res.json({ success: true, student: result.rows[0] });
  } catch (err) {
    logger.requestError('POST', `/api/students/${req.params.id}/deactivate`, requestId, Date.now(), err);
    res.status(500).json({ error: 'Failed to deactivate student', details: err.message });
  }
});

// DELETE /api/students/:id - Delete student
router.delete('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('DELETE /api/students start', { requestId, studentId: req.params.id });
  
  try {
    const { id } = req.params;

    // Authorization: Only admins may permanently delete student data
    if (!req.user || req.user.role !== 'admin') {
      logger.warn('Unauthorized student delete attempt', { requestId, user: req.user && req.user.userId, requiredRole: 'admin' });
      return res.status(403).json({ error: 'Admin privileges required to delete student', timestamp: new Date().toISOString() });
    }

    logger.info('Starting transaction for permanent delete', { requestId });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      logger.info('Transaction started for permanent delete', { requestId });

      // Ensure student exists and fetch seat
      logger.info('Fetching student and seat information', { requestId, studentId: id });
      const studentQuery = `SELECT s.seat_number FROM students s WHERE s.id = $1`;
      const studentResult = await client.query(studentQuery, [id]);
      if (studentResult.rows.length === 0) {
        logger.info('Student not found for delete', { requestId, studentId: id });
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found', studentId: id, timestamp: new Date().toISOString() });
      }

      const seatNumber = studentResult.rows[0].seat_number;
      logger.info('Student found for permanent delete', { requestId, studentId: id, seatNumber: seatNumber || null });

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

      // Delete related records explicitly to ensure full removal
      logger.info('Deleting related payments, seat history, student history and activity logs', { requestId, studentId: id });
      const delPayments = await client.query('DELETE FROM payments WHERE student_id = $1 RETURNING id', [id]);
      const delSeatsHistory = await client.query('DELETE FROM seats_history WHERE student_id = $1 RETURNING history_id', [id]);
      const delStudentsHistory = await client.query('DELETE FROM students_history WHERE id = $1 RETURNING history_id', [id]);
      const delActivityLogs = await client.query("DELETE FROM activity_logs WHERE subject_type = 'student' AND subject_id = $1 RETURNING id", [id]);

      logger.info('Related records deleted', { requestId, payments: delPayments.rowCount, seats_history: delSeatsHistory.rowCount, students_history: delStudentsHistory.rowCount, activity_logs: delActivityLogs.rowCount });

      // Finally delete the student record
      logger.info('Deleting student record', { requestId, studentId: id });
      const deleteResult = await client.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
      if (deleteResult.rows.length === 0) {
        // Unexpected: student disappeared between checks
        logger.warn('Student deletion affected no rows', { requestId, studentId: id });
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found during delete', studentId: id, timestamp: new Date().toISOString() });
      }

      logger.info('Committing permanent delete transaction', { requestId });
      await client.query('COMMIT');
      logger.info('Permanent delete transaction committed', { requestId });

      const executionTime = Date.now() - startTime;
      logger.info('DELETE STUDENT SUCCESS (permanent)', { requestId, studentId: id, executionTime });

      res.json({ 
        message: 'Student permanently deleted successfully',
        studentId: id,
        freedSeat: seatNumber,
        deleted: {
          payments: delPayments.rowCount,
          seats_history: delSeatsHistory.rowCount,
          students_history: delStudentsHistory.rowCount,
          activity_logs: delActivityLogs.rowCount
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.warn('Rolling back permanent delete transaction due to error', { requestId, error: error.message });
      await client.query('ROLLBACK');
      logger.info('Permanent delete transaction rolled back', { requestId });
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

// New: GET /api/students/fee-config/:membershipType/:gender - Get fee configuration for a membership type and gender
router.get('/fee-config/:membershipType/:gender', async (req, res) => {
  const requestId = `student-fee-config-${Date.now()}`;
  const startTime = Date.now();
  try {
    logger.info('GET /api/students/fee-config by membershipType+gender start', { requestId, params: req.params });
    const { membershipType, gender } = req.params;
    
    if (!membershipType || !membershipType.trim()) {
      logger.warn('Missing membershipType parameter for fee-config', { requestId, membershipType });
      return res.status(400).json({ error: 'membershipType is required', requestId, timestamp: new Date().toISOString() });
    }
    
    if (!gender || !['male', 'female'].includes(gender.toLowerCase())) {
      logger.warn('Invalid gender parameter for fee-config', { requestId, gender });
      return res.status(400).json({ error: 'Valid gender (male/female) is required', requestId, timestamp: new Date().toISOString() });
    }

    logger.info('Fetching fee configuration from DB', { requestId, membershipType, gender });
    const query = 'SELECT * FROM student_fees_config WHERE membership_type = $1 AND is_active = TRUE';
    const result = await pool.query(query, [membershipType]);

    if (result.rows.length === 0) {
      logger.info('Fee configuration not found', { requestId, membershipType });
      return res.status(404).json({ error: `Fee configuration not found for membership type: ${membershipType}`, requestId: requestId, timestamp: new Date().toISOString() });
    }

    const feeConfig = result.rows[0];
    // Select gender-specific fee
    const fee = gender.toLowerCase() === 'male' ? feeConfig.male_monthly_fees : feeConfig.female_monthly_fees;
    logger.info('Fee configuration found', { requestId, membershipType, gender });
    res.json({ membership_type: membershipType, gender: gender.toLowerCase(), monthly_fees: fee, raw: feeConfig });
  } catch (error) {
    logger.requestError('GET', `/api/students/fee-config/${req.params.membershipType}/${req.params.gender}`, requestId, startTime, error);
    res.status(500).json({ error: 'Failed to fetch fee configuration', requestId: requestId, timestamp: new Date().toISOString() });
  }
});

// Backwards-compatible route: GET /api/students/fee-config/:gender
// Deprecated: maps to default membership_type 'full_time'
router.get('/fee-config/:gender', async (req, res) => {
  const requestId = `student-fee-config-legacy-${Date.now()}`;
  const startTime = Date.now();
  try {
    const { gender } = req.params;
    logger.warn('Deprecated endpoint /fee-config/:gender used; mapping to membership_type=full_time', { requestId, gender });
    // Reuse the new handler logic by querying membership_type='full_time'
    const result = await pool.query('SELECT * FROM student_fees_config WHERE membership_type = $1 AND is_active = TRUE', ['full_time']);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fee configuration not found for membership_type=full_time' });
    const feeConfig = result.rows[0];
    const fee = (gender && gender.toLowerCase() === 'male') ? feeConfig.male_monthly_fees : feeConfig.female_monthly_fees;
    res.json({ membership_type: 'full_time', gender: gender.toLowerCase(), monthly_fees: fee, raw: feeConfig });
  } catch (error) {
    logger.requestError('GET', `/api/students/fee-config/${req.params.gender}`, requestId, startTime, error);
    res.status(500).json({ error: 'Failed to fetch fee configuration (legacy)', requestId: requestId, timestamp: new Date().toISOString() });
  }
});

// GET /api/students/reports/expired - Download CSV report of all expired students
router.get('/reports/expired', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('GET /api/students/reports/expired start', { requestId });
  
  try {
    // Authorization: Only admins should be able to download reports
    if (!req.user || req.user.role !== 'admin') {
      logger.warn('Unauthorized expired students report download attempt', { requestId, user: req.user && req.user.userId });
      return res.status(403).json({ error: 'Admin privileges required to download reports', timestamp: new Date().toISOString() });
    }

    logger.info('Fetching expired students data for report', { requestId });
    
    const query = `
      SELECT 
        s.name as student_name,
        s.father_name,
        s.contact_number as mobile_number,
        s.sex as gender,
        s.seat_number,
        s.membership_type,
        s.membership_date,
        s.membership_till,
        s.membership_status,
        s.created_at as registration_date,
        COALESCE(payment_summary.total_paid, 0) as total_paid,
        payment_summary.last_payment_date,
        CASE 
          WHEN s.membership_till < CURRENT_DATE THEN EXTRACT(DAY FROM (CURRENT_DATE - s.membership_till))
          ELSE 0
        END as days_expired
      FROM students s
      LEFT JOIN (
        SELECT 
          student_id,
          SUM(amount) as total_paid,
          MAX(payment_date) as last_payment_date
        FROM payments 
        GROUP BY student_id
      ) payment_summary ON s.id = payment_summary.student_id
      WHERE s.membership_status = 'expired' 
         OR (s.membership_till < CURRENT_DATE AND s.membership_status != 'inactive')
      ORDER BY s.membership_till ASC, s.name ASC
    `;
    
    logger.queryStart('expired students report', query);
    const result = await pool.query(query);
    logger.querySuccess('expired students report', null, result, false);

    if (result.rows.length === 0) {
      logger.info('No expired students found for report', { requestId });
      return res.status(404).json({ 
        error: 'No expired students found', 
        message: 'There are currently no expired students to report',
        timestamp: new Date().toISOString() 
      });
    }

    // Generate CSV content
    logger.info('Generating CSV content for expired students report', { requestId, count: result.rows.length });
    
    const csvHeaders = [
      'Student Name', 
      'Father Name',
      'Mobile Number',
      'Gender',
      'Seat Number',
      'Membership Type',
      'Membership Date',
      'Membership Till',
      'Membership Status',
      'Registration Date',
      'Total Paid',
      'Last Payment Date',
      'Days Expired'
    ];

    // Helper function to escape CSV values
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Helper function to format date
    const formatDate = (date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-GB'); // DD/MM/YYYY format
    };

    const csvRows = [
      csvHeaders.join(','),
      ...result.rows.map(student => [
        escapeCsvValue(student.student_name),
        escapeCsvValue(student.father_name),
        escapeCsvValue(student.mobile_number),
        escapeCsvValue(student.gender),
        escapeCsvValue(student.seat_number),
        escapeCsvValue(student.membership_type),
        escapeCsvValue(formatDate(student.membership_date)),
        escapeCsvValue(formatDate(student.membership_till)),
        escapeCsvValue(student.membership_status),
        escapeCsvValue(formatDate(student.registration_date)),
        escapeCsvValue(student.total_paid),
        escapeCsvValue(formatDate(student.last_payment_date)),
        escapeCsvValue(student.days_expired)
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    
    // Generate filename with current date
    const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `expired_students_report_${currentDate}.csv`;

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    const executionTime = Date.now() - startTime;
    logger.info('GET /api/students/reports/expired success', { 
      requestId, 
      executionTime, 
      count: result.rows.length,
      filename 
    });

    // Send CSV content
    res.send(csvContent);

  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.requestError('GET', '/api/students/reports/expired', requestId, startTime, error);
    res.status(500).json({ 
      error: 'Failed to generate expired students report', 
      details: error.message, 
      timestamp: new Date().toISOString() 
    });
  }
});

// GET /api/students/reports/expired/preview - Preview expired students data (JSON format)
router.get('/reports/expired/preview', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || `req-${Date.now()}`;
  logger.info('GET /api/students/reports/expired/preview start', { requestId });
  
  try {
    // Authorization: Only admins should be able to preview reports
    if (!req.user || req.user.role !== 'admin') {
      logger.warn('Unauthorized expired students report preview attempt', { requestId, user: req.user && req.user.userId });
      return res.status(403).json({ error: 'Admin privileges required to preview reports', timestamp: new Date().toISOString() });
    }

    logger.info('Fetching expired students data for preview', { requestId });
    
    const query = `
      SELECT 
        s.name as student_name,
        s.father_name,
        s.contact_number as mobile_number,
        s.sex as gender,
        s.seat_number,
        s.membership_type,
        s.membership_date,
        s.membership_till,
        s.membership_status,
        s.created_at as registration_date,
        COALESCE(payment_summary.total_paid, 0) as total_paid,
        payment_summary.last_payment_date,
        CASE 
          WHEN s.membership_till < CURRENT_DATE THEN EXTRACT(DAY FROM (CURRENT_DATE - s.membership_till))
          ELSE 0
        END as days_expired
      FROM students s
      LEFT JOIN (
        SELECT 
          student_id,
          SUM(amount) as total_paid,
          MAX(payment_date) as last_payment_date
        FROM payments 
        GROUP BY student_id
      ) payment_summary ON s.id = payment_summary.student_id
      WHERE s.membership_status = 'expired' 
         OR (s.membership_till < CURRENT_DATE AND s.membership_status != 'inactive')
      ORDER BY s.membership_till ASC, s.name ASC
      LIMIT 100
    `;
    
    logger.queryStart('expired students preview', query);
    const result = await pool.query(query);
    logger.querySuccess('expired students preview', null, result, false);

    const executionTime = Date.now() - startTime;
    logger.info('GET /api/students/reports/expired/preview success', { 
      requestId, 
      executionTime, 
      count: result.rows.length 
    });

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      message: result.rows.length === 0 ? 'No expired students found' : `Found ${result.rows.length} expired students`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.requestError('GET', '/api/students/reports/expired/preview', requestId, startTime, error);
    res.status(500).json({ 
      error: 'Failed to preview expired students report', 
      details: error.message, 
      timestamp: new Date().toISOString() 
    });
  }
});

module.exports = router;
