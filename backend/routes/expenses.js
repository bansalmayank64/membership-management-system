const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { toISTDateString } = require('../utils/dateUtils');

const router = express.Router();

// GET /api/expenses - paginated list, supports filters and CSV export
router.get('/', async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/expenses', req);
  try {
    rl.businessLogic('Preparing database query for paginated/filtered expenses');

    const page = parseInt(req.query.page, 10) || 0; // zero-based
    const pageSize = parseInt(req.query.pageSize, 10) || 25;
    const category = req.query.category || null;
    const startDate = req.query.startDate || null; // expected YYYY-MM-DD or 'YYYY-MM-DD HH:MM:SS'
    const endDate = req.query.endDate || null; // expected YYYY-MM-DD or 'YYYY-MM-DD HH:MM:SS'
    const exportCsv = req.query.export === 'csv';

    const whereClauses = [];
    const params = [];
    let idx = 1;

    if (category) {
      whereClauses.push(`e.expense_category_id = $${idx++}`);
      params.push(category);
    }
    // Accept start/end date as either epoch-ms (number) or ISO/date strings.
    const isNumeric = (v) => v !== null && v !== undefined && !isNaN(Number(v));
    if (startDate) {
      if (isNumeric(startDate)) {
        // frontend may send Date.UTC(...) (ms since epoch). Use to_timestamp(ms/1000)
        whereClauses.push(`e.expense_date >= to_timestamp($${idx}::double precision / 1000)`);
        params.push(Number(startDate));
        idx++;
      } else {
        // treat as timestamp or date string
        whereClauses.push(`e.expense_date >= $${idx}::timestamp`);
        params.push(startDate);
        idx++;
      }
    }
    if (endDate) {
      if (isNumeric(endDate)) {
        whereClauses.push(`e.expense_date <= to_timestamp($${idx}::double precision / 1000)`);
        params.push(Number(endDate));
        idx++;
      } else {
        // If user passed plain YYYY-MM-DD, treat endDate as end-of-day by using exclusive upper bound < (date + 1 day)
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
          whereClauses.push(`e.expense_date < ($${idx}::timestamp + INTERVAL '1 day')`);
          params.push(endDate);
          idx++;
        } else {
          whereClauses.push(`e.expense_date <= $${idx}::timestamp`);
          params.push(endDate);
          idx++;
        }
      }
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // If CSV export requested, stream full result as CSV
    if (exportCsv) {
      const csvQuery = `
        SELECT e.*, c.name as category_name
        FROM expenses e
        LEFT JOIN expense_categories c ON e.expense_category_id = c.id
        ${whereSQL}
        ORDER BY e.expense_date DESC
      `;
      rl.queryStart('Export expenses CSV', csvQuery, params);
      const result = await pool.query(csvQuery, params);
      rl.querySuccess('Export expenses CSV', null, result, true);

      // Build CSV
      const header = ['id', 'expense_category_id', 'category_name', 'description', 'amount', 'expense_date', 'created_at', 'updated_at'];
      const rows = result.rows.map(r => header.map(h => (r[h] !== undefined && r[h] !== null) ? String(r[h]).replace(/"/g, '""') : '').join(','));
      const csv = `${header.join(',')}\n${rows.join('\n')}`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="expenses_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    // Count total rows
  const countQuery = `SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) as total_amount FROM expenses e ${whereSQL}`;
    rl.queryStart('Count expenses', countQuery, params);
    const countStart = Date.now();
    const countResult = await pool.query(countQuery, params);
    rl.querySuccess('Count expenses', countStart, countResult, true);
    const total = parseInt(countResult.rows[0].total, 10) || 0;
    const totalAmount = parseFloat(countResult.rows[0].total_amount) || 0;

    // Fetch page
    const offset = page * pageSize;
    const dataQuery = `
      SELECT e.*, c.name as category_name
      FROM expenses e
      LEFT JOIN expense_categories c ON e.expense_category_id = c.id
      ${whereSQL}
      ORDER BY e.expense_date DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(pageSize, offset);
    rl.queryStart('Fetch expenses page', dataQuery, params);
    const dataStart = Date.now();
    const dataResult = await pool.query(dataQuery, params);
    rl.querySuccess('Fetch expenses page', dataStart, dataResult, true);

    rl.success({ expenses: dataResult.rows, total, total_amount: totalAmount });
    res.json({ expenses: dataResult.rows, total, total_amount: totalAmount });
  } catch (error) {
    rl.error(error);
    res.status(500).json({ error: 'Failed to fetch expenses', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

// POST /api/expenses - Create expense
router.post('/', async (req, res) => {
  const rl = logger.createRequestLogger('POST', '/api/expenses', req);
  try {
    const { expense_category_id, description = '', amount, expense_date } = req.body;

    const validationErrors = [];
    if (!expense_category_id || isNaN(expense_category_id)) validationErrors.push('Valid expense_category_id is required');
    if (amount === undefined || isNaN(amount)) validationErrors.push('Valid amount is required');
    if (!expense_date) validationErrors.push('expense_date is required');

    if (validationErrors.length > 0) {
      rl.validationError('expense', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }

    const insertQuery = `
      INSERT INTO expenses (expense_category_id, description, amount, expense_date, created_at, updated_at, modified_by)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5)
      RETURNING *
    `;
    const actorId = req.user && req.user.userId ? req.user.userId : null;
    const values = [expense_category_id, description, amount, expense_date, actorId];
    rl.queryStart('Insert expense', insertQuery, values);
    const result = await pool.query(insertQuery, values);
    rl.querySuccess('Insert expense', null, result, true);
    // Log activity for admin panel (include category_name in metadata)
    try {
      const eid = result.rows[0].id;
      const enrichedQ = `SELECT e.*, c.name as category_name FROM expenses e LEFT JOIN expense_categories c ON e.expense_category_id = c.id WHERE e.id = $1`;
      const enrichedRes = await pool.query(enrichedQ, [eid]);
      const metadataRow = enrichedRes.rows[0] || result.rows[0];
      await pool.query(`
        INSERT INTO activity_logs (actor_user_id, actor_username, action_type, action_description, subject_type, subject_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        actorId,
        req.user && req.user.username ? req.user.username : null,
        'expense_create',
        `Created expense ${eid}`,
        'expense',
        eid,
        JSON.stringify(metadataRow)
      ]);
    } catch (logErr) {
      rl.error(logErr, 'Failed to write activity log for expense create');
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    rl.error(error);
    res.status(500).json({ error: 'Failed to create expense', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', async (req, res) => {
  const rl = logger.createRequestLogger('PUT', '/api/expenses/:id', req);
  try {
    const { id } = req.params;
    const { expense_category_id, description, amount, expense_date } = req.body;

    if (!id || isNaN(id)) return res.status(400).json({ error: 'Valid id is required' });

    // Fetch existing
    const existing = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });

    const setClauses = [];
    const params = [];
    let idx = 1;
    if (expense_category_id !== undefined) { setClauses.push(`expense_category_id = $${idx++}`); params.push(expense_category_id); }
    if (description !== undefined) { setClauses.push(`description = $${idx++}`); params.push(description); }
    if (amount !== undefined) { setClauses.push(`amount = $${idx++}`); params.push(amount); }
    if (expense_date !== undefined) { setClauses.push(`expense_date = $${idx++}`); params.push(expense_date); }

    if (setClauses.length === 0) return res.json(existing.rows[0]);

  // Ensure we record who modified the expense
  const actorId = req.user && req.user.userId ? req.user.userId : null;
  const updateQuery = `UPDATE expenses SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP, modified_by = $${idx++} WHERE id = $${idx++} RETURNING *`;
  params.push(actorId);
  params.push(id);
    rl.queryStart('Update expense', updateQuery, params);
    const result = await pool.query(updateQuery, params);
    rl.querySuccess('Update expense', null, result, true);
    // Log activity for admin panel (include category_name in metadata)
    try {
      const eid = result.rows[0].id;
      const enrichedQ = `SELECT e.*, c.name as category_name FROM expenses e LEFT JOIN expense_categories c ON e.expense_category_id = c.id WHERE e.id = $1`;
      const enrichedRes = await pool.query(enrichedQ, [eid]);
      const metadataRow = enrichedRes.rows[0] || result.rows[0];
      await pool.query(`
        INSERT INTO activity_logs (actor_user_id, actor_username, action_type, action_description, subject_type, subject_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        actorId,
        req.user && req.user.username ? req.user.username : null,
        'expense_update',
        `Updated expense ${eid}`,
        'expense',
        eid,
        JSON.stringify(metadataRow)
      ]);
    } catch (logErr) {
      rl.error(logErr, 'Failed to write activity log for expense update');
    }

    res.json(result.rows[0]);
  } catch (error) {
    rl.error(error);
    res.status(500).json({ error: 'Failed to update expense', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', async (req, res) => {
  const rl = logger.createRequestLogger('DELETE', '/api/expenses/:id', req);
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) return res.status(400).json({ error: 'Valid id is required' });

    // Fetch enriched row (with category_name) before deleting so we can log it
    const existingRes = await pool.query('SELECT e.*, c.name as category_name FROM expenses e LEFT JOIN expense_categories c ON e.expense_category_id = c.id WHERE e.id = $1', [id]);
    const existingRow = existingRes.rows[0] || null;
    const del = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
    if (del.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    // Log deletion in activity logs using enrichedRow when available
    try {
      const metadataRow = existingRow || del.rows[0];
      await pool.query(`
        INSERT INTO activity_logs (actor_user_id, actor_username, action_type, action_description, subject_type, subject_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user && req.user.userId ? req.user.userId : null,
        req.user && req.user.username ? req.user.username : null,
        'expense_delete',
        `Deleted expense ${del.rows[0].id}`,
        'expense',
        del.rows[0].id,
        JSON.stringify(metadataRow)
      ]);
    } catch (logErr) {
      logger.error('Failed to write activity log for expense delete', { error: logErr.message });
    }

    res.json({ message: 'Expense deleted', expense: del.rows[0] });
  } catch (error) {
    rl.error(error);
    res.status(500).json({ error: 'Failed to delete expense', requestId: rl.requestId, timestamp: new Date().toISOString() });
  }
});

// GET /api/expenses/summary/stats - simple 30-day summary
router.get('/summary/stats', async (req, res) => {
  try {
    const query = `
      SELECT
        COALESCE(SUM(amount),0) as total,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE expense_date >= CURRENT_DATE - INTERVAL '60 days' AND expense_date < CURRENT_DATE - INTERVAL '30 days'),0) as prev_month
      FROM expenses
      WHERE expense_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching expense summary', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch expense summary' });
  }
});

module.exports = router;
