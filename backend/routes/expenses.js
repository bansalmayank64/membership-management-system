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
    
    console.log(`🔍 Step 1: Validating input parameters...`);
    console.log(`📋 Expense details: description="${description}", amount="${amount}", date="${expense_date}", modified_by="${modified_by}"`);
    
    if (!description || description.trim() === '') {
      console.log(`❌ Validation failed: description is required`);
      return res.status(400).json({ 
        error: 'Expense description is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      console.log(`❌ Validation failed: invalid amount: ${amount}`);
      return res.status(400).json({ 
        error: 'Valid positive amount is required',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📝 Step 2: Preparing expense creation query...`);
    const query = `
      INSERT INTO expenses (description, amount, expense_date, modified_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    console.log(`🔧 Step 3: Executing expense creation...`);
    const queryStart = Date.now();
    const result = await pool.query(query, [
      description.trim(), parseFloat(amount), expense_date, modified_by
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
  try {
    const { id } = req.params;
    const {
      description,
      amount,
      expense_date,
      modified_by
    } = req.body;
    
    const query = `
      UPDATE expenses 
      SET 
        description = $2,
        amount = $3,
        expense_date = $4,
        modified_by = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      id, description, amount, expense_date, modified_by
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM expenses WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully', expense: result.rows[0] });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
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
