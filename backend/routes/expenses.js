const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/expenses - Get all expenses
router.get('/', async (req, res) => {
  const requestId = `expenses-get-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰 [${new Date().toISOString()}] Starting GET /api/expenses [${requestId}]`);
    console.log(`📊 Request details: IP=${req.ip}, User-Agent=${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`📝 Step 1: Preparing expenses query...`);
    const query = `
      SELECT *
      FROM expenses
      ORDER BY expense_date DESC
    `;
    
    console.log(`🔍 Step 2: Executing expenses query...`);
    const queryStart = Date.now();
    const result = await pool.query(query);
    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Query executed successfully in ${queryTime}ms, returned ${result.rows.length} expenses`);
    console.log(`📊 Expense summary:`, {
      total: result.rows.length,
      totalAmount: result.rows.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0),
      dateRange: result.rows.length > 0 ? {
        oldest: result.rows[result.rows.length - 1]?.expense_date,
        newest: result.rows[0]?.expense_date
      } : null
    });
    console.log(`🎯 [${new Date().toISOString()}] GET /api/expenses completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/expenses FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch expenses',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/expenses/:id - Get expense by ID
router.get('/:id', async (req, res) => {
  const requestId = `expenses-get-id-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰🔍 [${new Date().toISOString()}] Starting GET /api/expenses/:id [${requestId}]`);
    
    const { id } = req.params;
    console.log(`📊 Request params: id="${id}"`);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    console.log(`🔍 Step 1: Validating expense ID...`);
    if (!id || isNaN(id)) {
      console.log(`❌ Invalid expense ID: ${id}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] GET /api/expenses/:id completed with 400 in ${totalTime}ms [${requestId}]`);
      
      return res.status(400).json({ 
        error: 'Valid expense ID is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing expense lookup query...`);
    const query = 'SELECT * FROM expenses WHERE id = $1';
    
    console.log(`🔧 Step 3: Executing expense lookup...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [id]);
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Lookup query executed in ${queryTime}ms, found ${result.rows.length} records`);
    
    if (result.rows.length === 0) {
      console.log(`❌ Expense not found: ID=${id}`);
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${new Date().toISOString()}] GET /api/expenses/:id completed with 404 in ${totalTime}ms [${requestId}]`);
      
      return res.status(404).json({ 
        error: 'Expense not found',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`📊 Found expense:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] GET /api/expenses/:id completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows[0]);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] GET /api/expenses/:id FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      expenseId: req.params.id
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch expense',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/expenses - Create a new expense
router.post('/', async (req, res) => {
  const requestId = `expenses-post-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰➕ [${new Date().toISOString()}] Starting POST /api/expenses [${requestId}]`);
    console.log(`📊 Request body:`, req.body);
    console.log(`📝 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    const {
      description,
      amount,
      expense_date,
      modified_by
    } = req.body;
    
    console.log(`🔍 Step 1: Validating input parameters with database constraints...`);
    console.log(`📋 Expense details: description="${description}", amount="${amount}", date="${expense_date}", modified_by="${modified_by}"`);
    
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
      console.log(`❌ Validation failed:`, validationErrors);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors,
        received: { description, amount, expense_date, modified_by },
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing expense creation query...`);
    const query = `
      INSERT INTO expenses (description, amount, expense_date, modified_by, category, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    // Default category if not provided (database requires category field)
    const category = req.body.category || 'General';
    
    console.log(`🔧 Step 3: Executing expense creation...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [
      description.trim(), 
      parseFloat(amount), 
      expense_date, 
      req.user?.userId || req.user?.id || 1,
      category.trim()
    ]);
    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Expense created successfully in ${queryTime}ms`);
    console.log(`📊 New expense data:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] POST /api/expenses completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] POST /api/expenses FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      error: 'Failed to create expense',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', async (req, res) => {
  const requestId = `expenses-put-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰🔄 [${new Date().toISOString()}] Starting PUT /api/expenses/:id [${requestId}]`);
    
    const { id } = req.params;
    const {
      description,
      amount,
      expense_date,
      category,
      modified_by
    } = req.body;
    
    console.log(`📊 Request params: id="${id}"`);
    console.log(`📊 Request body:`, req.body);
    
    console.log(`🔍 Step 1: Validating input parameters...`);
    
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
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing expense update query...`);
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
    
    console.log(`🔧 Step 3: Executing expense update...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [
      id, description.trim(), parseFloat(amount), expense_date, category.trim(), req.user?.userId || req.user?.id || 1
    ]);
    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Update query executed in ${queryTime}ms`);
    
    if (result.rows.length === 0) {
      console.log(`❌ Expense not found: ID=${id}`);
      console.log(`🎯 [${new Date().toISOString()}] PUT /api/expenses/:id completed with 404 in ${totalTime}ms [${requestId}]`);
      
      return res.status(404).json({ 
        error: 'Expense not found',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📊 Updated expense data:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] PUT /api/expenses/:id completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json(result.rows[0]);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] PUT /api/expenses/:id FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      expenseId: req.params.id,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      error: 'Failed to update expense',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', async (req, res) => {
  const requestId = `expenses-delete-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    console.log(`💰🗑️ [${new Date().toISOString()}] Starting DELETE /api/expenses/:id [${requestId}]`);
    
    const { id } = req.params;
    console.log(`📊 Request params: id="${id}"`);
    console.log(`👤 User: ${req.user?.userId || req.user?.id || 'unknown'}`);
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Valid expense ID is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🔍 Step 1: Deleting expense record...`);
    const query = 'DELETE FROM expenses WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Expense not found: ID=${id}`);
      return res.status(404).json({ 
        error: 'Expense not found',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Expense deleted successfully in ${totalTime}ms`);
    console.log(`📊 Deleted expense:`, result.rows[0]);
    console.log(`🎯 [${new Date().toISOString()}] DELETE /api/expenses/:id completed successfully in ${totalTime}ms [${requestId}]`);
    
    res.json({ 
      message: 'Expense deleted successfully', 
      expense: result.rows[0],
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] DELETE /api/expenses/:id FAILED after ${totalTime}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      expenseId: req.params.id
    });
    
    res.status(500).json({ 
      error: 'Failed to delete expense',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
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
    console.error('Error fetching expense summary:', error);
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
    console.error('Error fetching monthly expenses:', error);
    res.status(500).json({ error: 'Failed to fetch monthly expenses' });
  }
});

module.exports = router;
