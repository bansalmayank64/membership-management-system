const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();
const logger = require('../utils/logger');

// GET /api/expenses - Get all expenses
router.get('/', async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/expenses', req);
  try {
    rl.requestStart(req);
    rl.businessLogic('Preparing expenses query');
    const query = `
      SELECT *
      FROM expenses
      ORDER BY expense_date DESC
    `;
    const queryStart = rl.queryStart('expenses list', query);
    const result = await pool.query(query);
    rl.querySuccess('expenses list', queryStart, result, true);
    rl.success({ count: result.rows.length });
    res.json(result.rows);
  } catch (error) {
    rl.error(error);
    res.status(500).json({ error: 'Failed to fetch expenses', timestamp: new Date().toISOString() });
  }
});

// GET /api/expenses/:id - Get expense by ID
router.get('/:id', async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/expenses/:id', req);
  try {
    rl.requestStart(req);
    const { id } = req.params;
    rl.validationStart('Validating expense id');
    if (!id || isNaN(id)) {
      rl.validationError('id', ['Valid expense ID is required']);
      return res.status(400).json({ error: 'Valid expense ID is required', timestamp: new Date().toISOString() });
    }

    const query = 'SELECT * FROM expenses WHERE id = $1';
    const queryStart = rl.queryStart('expense lookup', query, [id]);
    const result = await pool.query(query, [id]);
    rl.querySuccess('expense lookup', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('Expense not found', { id });
      return res.status(404).json({ error: 'Expense not found', timestamp: new Date().toISOString() });
    }

    rl.success({ id });
    res.json(result.rows[0]);
  } catch (error) {
    rl.error(error, { expenseId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch expense', timestamp: new Date().toISOString() });
  }
});

// POST /api/expenses - Create a new expense
router.post('/', async (req, res) => {
  const rl = logger.createRequestLogger('POST', '/api/expenses', req);
  try {
    rl.requestStart(req);
    const { description, amount, expense_date, modified_by } = req.body;
    rl.validationStart('Validating expense payload');
    rl.info('Expense details', { description: description?.toString().slice(0, 100), amount, expense_date });
    
    // Enhanced validation with database schema constraints
    const validationErrors = [];

    // Description validation - TEXT NOT NULL
    if (!description || typeof description !== 'string' || description.trim() === '') {
      validationErrors.push('Expense description is required and must be a non-empty string');
    } else if (description.trim().length < 3) {
      validationErrors.push('Description must be at least 3 characters long');
    } else if (description.trim().length > 1000) {
      validationErrors.push('Description cannot exceed 1000 characters');
    }

    // Amount validation - NUMERIC(10,2) NOT NULL
    if (!amount) {
      validationErrors.push('Expense amount is required');
    } else if (isNaN(amount)) {
      validationErrors.push('Amount must be a valid number');
    } else {
      const numAmount = parseFloat(amount);
      if (numAmount <= 0) {
        validationErrors.push('Amount must be a positive number');
      } else if (numAmount > 99999999.99) {
        validationErrors.push('Amount exceeds maximum allowed value (99,999,999.99)');
      }
      // Check decimal places (NUMERIC(10,2) allows 2 decimal places)
      const decimalParts = amount.toString().split('.');
      if (decimalParts[1] && decimalParts[1].length > 2) {
        validationErrors.push('Amount can have maximum 2 decimal places');
      }
    }

    // Expense date validation - TIMESTAMP NOT NULL
    if (!expense_date) {
      validationErrors.push('Expense date is required');
    } else {
      const expenseDate = new Date(expense_date);
      if (isNaN(expenseDate.getTime())) {
        validationErrors.push('Expense date must be a valid date');
      }
    }

    // Modified by validation - REFERENCES users(id)
    if (modified_by && isNaN(modified_by)) {
      validationErrors.push('Modified by must be a valid user ID');
    }

    if (validationErrors.length > 0) {
      rl.validationError('expense', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, timestamp: new Date().toISOString() });
    }
    rl.businessLogic('Preparing expense creation query');
    const query = `
      INSERT INTO expenses (description, amount, expense_date, modified_by, category, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    // Default category if not provided (database requires category field)
    const category = req.body.category || 'General';
    
  const queryStart = rl.queryStart('create expense', query, [description, parseFloat(amount), expense_date, req.user?.userId || req.user?.id || 1, category]);
  const result = await pool.query(query, [description.trim(), parseFloat(amount), expense_date, req.user?.userId || req.user?.id || 1, category.trim()]);
  rl.querySuccess('create expense', queryStart, result, true);
  rl.success({ id: result.rows[0].id });
  res.status(201).json(result.rows[0]);
  } catch (error) {
  rl.error(error, { requestBody: req.body });
  res.status(500).json({ error: 'Failed to create expense', timestamp: new Date().toISOString() });
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', async (req, res) => {
  const rl = logger.createRequestLogger('PUT', '/api/expenses/:id', req);
  try {
    rl.requestStart(req);
    const { id } = req.params;
    const { description, amount, expense_date, category, modified_by } = req.body;
    rl.validationStart('Validating expense update payload');
    
    // Enhanced validation with database constraints
    const validationErrors = [];

    // ID validation
    if (!id || isNaN(id)) {
      validationErrors.push('Valid expense ID is required');
    }

    // Description validation - TEXT NOT NULL
    if (!description || typeof description !== 'string' || description.trim() === '') {
      validationErrors.push('Expense description is required and must be a non-empty string');
    } else if (description.trim().length < 3) {
      validationErrors.push('Description must be at least 3 characters long');
    } else if (description.trim().length > 1000) {
      validationErrors.push('Description cannot exceed 1000 characters');
    }

    // Amount validation - NUMERIC(10,2) NOT NULL
    if (!amount) {
      validationErrors.push('Expense amount is required');
    } else if (isNaN(amount)) {
      validationErrors.push('Amount must be a valid number');
    } else {
      const numAmount = parseFloat(amount);
      if (numAmount <= 0) {
        validationErrors.push('Amount must be a positive number');
      } else if (numAmount > 99999999.99) {
        validationErrors.push('Amount exceeds maximum allowed value (99,999,999.99)');
      }
    }

    // Expense date validation - TIMESTAMP NOT NULL
    if (!expense_date) {
      validationErrors.push('Expense date is required');
    } else {
      const expenseDate = new Date(expense_date);
      if (isNaN(expenseDate.getTime())) {
        validationErrors.push('Expense date must be a valid date');
      }
    }

    // Category validation - VARCHAR(50) NOT NULL
    if (!category || typeof category !== 'string' || category.trim() === '') {
      validationErrors.push('Category is required');
    } else if (category.trim().length > 50) {
      validationErrors.push('Category cannot exceed 50 characters');
    }

    if (validationErrors.length > 0) {
      rl.validationError('update', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors, timestamp: new Date().toISOString() });
    }
    rl.businessLogic('Preparing expense update query');
    const query = `
      UPDATE expenses 
      SET 
        description = $2,
        amount = $3,
        expense_date = $4,
        category = $5,
        modified_by = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const queryStart = rl.queryStart('update expense', query, [id, description.trim(), parseFloat(amount), expense_date, category.trim(), req.user?.userId || req.user?.id || 1]);
    const result = await pool.query(query, [id, description.trim(), parseFloat(amount), expense_date, category.trim(), req.user?.userId || req.user?.id || 1]);
    rl.querySuccess('update expense', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('Expense not found for update', { id });
      return res.status(404).json({ error: 'Expense not found', timestamp: new Date().toISOString() });
    }

    rl.success({ id });
    res.json(result.rows[0]);
  } catch (error) {
    rl.error(error, { expenseId: req.params.id, requestBody: req.body });
    res.status(500).json({ error: 'Failed to update expense', timestamp: new Date().toISOString() });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', async (req, res) => {
  const rl = logger.createRequestLogger('DELETE', '/api/expenses/:id', req);
  try {
    rl.requestStart(req);
    const { id } = req.params;
    rl.info('Delete expense requested', { id, requestedBy: req.user?.userId || req.user?.id || 'unknown' });
    if (!id || isNaN(id)) {
      rl.validationError('id', ['Valid expense ID is required']);
      return res.status(400).json({ error: 'Valid expense ID is required', timestamp: new Date().toISOString() });
    }

    const query = 'DELETE FROM expenses WHERE id = $1 RETURNING *';
    const queryStart = rl.queryStart('delete expense', query, [id]);
    const result = await pool.query(query, [id]);
    rl.querySuccess('delete expense', queryStart, result, true);

    if (result.rows.length === 0) {
      rl.warn('Expense not found', { id });
      return res.status(404).json({ error: 'Expense not found', timestamp: new Date().toISOString() });
    }

    rl.success({ id });
    res.json({ message: 'Expense deleted successfully', expense: result.rows[0], timestamp: new Date().toISOString() });
  } catch (error) {
    rl.error(error, { expenseId: req.params.id });
    res.status(500).json({ error: 'Failed to delete expense', timestamp: new Date().toISOString() });
  }
});

// GET /api/expenses/summary - Get expense summary/statistics
router.get('/summary/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_expenses,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM expenses
      WHERE expense_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching expense summary', { error: { message: error.message, stack: error.stack } });
    res.status(500).json({ error: 'Failed to fetch expense summary' });
  }
});

// GET /api/expenses/monthly - Get monthly expense breakdown
router.get('/monthly/breakdown', async (req, res) => {
  try {
    const query = `
      SELECT 
        DATE_TRUNC('month', expense_date) as month,
        COUNT(*) as expense_count,
        SUM(amount) as total_amount
      FROM expenses
      WHERE expense_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', expense_date)
      ORDER BY month DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching monthly expenses', { error: { message: error.message, stack: error.stack } });
    res.status(500).json({ error: 'Failed to fetch monthly expenses' });
  }
});

module.exports = router;
