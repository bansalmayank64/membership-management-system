const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/finance/monthly?months=6&offset=0
// Returns an array of months starting from current month-offset, one per month, ordered DESC (most recent first).
// Also returns hasMore=true if there are any payments or expenses older than the oldest month returned.
router.get('/monthly', async (req, res) => {
  try {
  const months = parseInt(req.query.months, 10) || 6;
  const offset = parseInt(req.query.offset, 10) || 0; // how many units to skip from current period
  const period = (req.query.period || 'month').toString().toLowerCase(); // 'month' or 'year'

    let query;
    let params;
    if (period === 'year') {
      // Yearly aggregation
      query = `
        WITH years AS (
          SELECT generate_series(
            date_trunc('year', CURRENT_DATE) - make_interval(years => $1),
            date_trunc('year', CURRENT_DATE) - make_interval(years => ($1 + $2 - 1)),
            '-1 year'::interval
          ) AS start
        ),
        agg AS (
          SELECT
            start,
            to_char(start, 'YYYY') as month_label,
            EXTRACT(YEAR FROM start)::int as year,
            COALESCE((SELECT SUM(amount) FROM payments WHERE payment_date >= start AND payment_date < start + INTERVAL '1 year'), 0) as income,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE expense_date >= start AND expense_date < start + INTERVAL '1 year'), 0) as expenses
          FROM years
        )
        SELECT
          a.month_label,
          a.year,
          NULL as month,
          a.income,
          a.expenses,
          (a.income - a.expenses) as net,
          (SELECT EXISTS(SELECT 1 FROM payments WHERE payment_date < (SELECT MIN(start) FROM years)) OR EXISTS(SELECT 1 FROM expenses WHERE expense_date < (SELECT MIN(start) FROM years))) AS has_more
        FROM agg a
        ORDER BY a.start DESC
      `;
      params = [offset, months];
    } else {
      // Monthly aggregation (existing behavior)
      query = `
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - make_interval(months => $1),
            date_trunc('month', CURRENT_DATE) - make_interval(months => ($1 + $2 - 1)),
            '-1 month'::interval
          ) AS month_start
        ),
        agg AS (
          SELECT
            month_start,
            to_char(month_start, 'Mon-YYYY') as month_label,
            EXTRACT(YEAR FROM month_start)::int as year,
            EXTRACT(MONTH FROM month_start)::int as month,
            COALESCE((SELECT SUM(amount) FROM payments WHERE payment_date >= month_start AND payment_date < month_start + INTERVAL '1 month'), 0) as income,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE expense_date >= month_start AND expense_date < month_start + INTERVAL '1 month'), 0) as expenses
          FROM months
        )
        SELECT
          a.month_label,
          a.year,
          a.month,
          a.income,
          a.expenses,
          (a.income - a.expenses) as net,
          (SELECT EXISTS(SELECT 1 FROM payments WHERE payment_date < (SELECT MIN(month_start) FROM months)) OR EXISTS(SELECT 1 FROM expenses WHERE expense_date < (SELECT MIN(month_start) FROM months))) AS has_more
        FROM agg a
        ORDER BY a.month_start DESC
      `;
      params = [offset, months];
    }

    const result = await pool.query(query, params);

    // Normalize numbers to floats and extract hasMore from first row (same for all rows)
    const rows = result.rows.map(r => ({
      monthLabel: r.month_label,
      year: r.year,
      month: r.month,
      income: parseFloat(r.income) || 0,
      expenses: parseFloat(r.expenses) || 0,
      net: parseFloat(r.net) || 0
    }));
    const hasMore = result.rows.length > 0 ? !!result.rows[0].has_more : false;

    res.json({ months: rows, hasMore });
  } catch (error) {
    logger.error('Error fetching monthly finance data', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch monthly finance data' });
  }
});

// GET /api/finance/detail?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns aggregated totals, payments and expenses within the requested date range,
// plus grouped breakdowns for frontend consumption.
router.get('/detail', async (req, res) => {
  try {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
  const groupPageSize = parseInt(req.query.groupPageSize, 10) || 10;

    // Validation: both dates required
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });

    // Normalize: treat endDate as inclusive end-of-day
    // Instead of loading all items, load grouped totals and only the first `groupPageSize` items per group.
    // Payments: get totals grouped by payment_type then fetch first N items per type
    const paymentsSummaryQ = `
      SELECT p.payment_type, COALESCE(SUM(amount),0) as amount, COUNT(*) as items_count
      FROM payments p
      WHERE p.payment_date >= $1::timestamp
        AND p.payment_date < ($2::timestamp + INTERVAL '1 day')
      GROUP BY p.payment_type
      ORDER BY COALESCE(SUM(amount),0) DESC
    `;
    const paymentsSummaryRes = await pool.query(paymentsSummaryQ, [startDate, endDate]);

    const payments = [];
    for (const row of paymentsSummaryRes.rows) {
      const type = row.payment_type || 'other';
      const itemsQ = `
        SELECT p.*, s.name as student_name, s.seat_number
        FROM payments p
        LEFT JOIN students s ON p.student_id = s.id
        WHERE p.payment_type = $1
          AND p.payment_date >= $2::timestamp
          AND p.payment_date < ($3::timestamp + INTERVAL '1 day')
        ORDER BY p.payment_date DESC
        LIMIT $4
      `;
      const itemsRes = await pool.query(itemsQ, [type, startDate, endDate, groupPageSize]);
      payments.push({ type, amount: parseFloat(row.amount) || 0, items: itemsRes.rows || [], total: parseInt(row.items_count, 10) || 0 });
    }

    // Expenses: group by category
    const expensesSummaryQ = `
      SELECT c.id as category_id, c.name as category_name, COALESCE(SUM(e.amount),0) as amount, COUNT(*) as items_count
      FROM expenses e
      LEFT JOIN expense_categories c ON e.expense_category_id = c.id
      WHERE e.expense_date >= $1::timestamp
        AND e.expense_date < ($2::timestamp + INTERVAL '1 day')
      GROUP BY c.id, c.name
      ORDER BY COALESCE(SUM(e.amount),0) DESC
    `;
    const expensesSummaryRes = await pool.query(expensesSummaryQ, [startDate, endDate]);

    const expenses = [];
    for (const row of expensesSummaryRes.rows) {
      const catId = row.category_id;
      const catName = row.category_name || 'Uncategorized';
      const itemsQ = `
        SELECT e.*, c.name as category_name
        FROM expenses e
        LEFT JOIN expense_categories c ON e.expense_category_id = c.id
        WHERE (e.expense_category_id = $1 OR c.name = $2)
          AND e.expense_date >= $3::timestamp
          AND e.expense_date < ($4::timestamp + INTERVAL '1 day')
        ORDER BY e.expense_date DESC
        LIMIT $5
      `;
      const itemsRes = await pool.query(itemsQ, [catId, catName, startDate, endDate, groupPageSize]);
      expenses.push({ category: catName, category_id: catId, amount: parseFloat(row.amount) || 0, items: itemsRes.rows || [], total: parseInt(row.items_count, 10) || 0 });
    }

  // Use server-side aggregate queries to compute totals using the same date range semantics
  const totalIncomeRes = await pool.query(`SELECT COALESCE(SUM(amount),0) as total_income FROM payments WHERE payment_date >= $1::timestamp AND payment_date < ($2::timestamp + INTERVAL '1 day')`, [startDate, endDate]);
  const totalExpensesRes = await pool.query(`SELECT COALESCE(SUM(amount),0) as total_expenses FROM expenses WHERE expense_date >= $1::timestamp AND expense_date < ($2::timestamp + INTERVAL '1 day')`, [startDate, endDate]);

  const totalIncome = parseFloat(totalIncomeRes.rows[0].total_income) || 0;
  const totalExpenses = parseFloat(totalExpensesRes.rows[0].total_expenses) || 0;

    // We already prepared grouped arrays 'payments' and 'expenses' where each group contains "items" limited to groupPageSize and a "total" count.
    res.json({
      // Keep top-level payments/expenses arrays empty to avoid sending all rows
      payments: [],
      expenses: [],
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      expenseByCategory: expenses,
      paymentsByType: payments
    });
  } catch (error) {
    logger.error('Error fetching finance detail', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch finance detail' });
  }
});

module.exports = router;

// GET /api/finance/group-items?group=payments|expenses&key=<type or category>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&page=0&pageSize=10
// Returns paginated items for a specific group (payment type or expense category) within the date range
router.get('/group-items', async (req, res) => {
  try {
    const group = (req.query.group || '').toString().toLowerCase();
    const key = req.query.key;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const page = parseInt(req.query.page, 10) || 0;
    const pageSize = parseInt(req.query.pageSize, 10) || 10;

    if (!group || !key) return res.status(400).json({ error: 'group and key are required' });

    const offset = page * pageSize;

    if (group === 'payments') {
      // key is payment_type (e.g., monthly_fee)
      const where = [];
      const params = [];
      let idx = 1;
      where.push(`p.payment_type = $${idx++}`);
      params.push(key);
      if (startDate) {
        where.push(`p.payment_date >= $${idx++}::timestamp`);
        params.push(startDate + ' 00:00:00');
      }
      if (endDate) {
        where.push(`p.payment_date < ($${idx++}::timestamp + INTERVAL '1 day')`);
        params.push(endDate);
      }
      const whereSQL = `WHERE ${where.join(' AND ')}`;

      const countQ = `SELECT COUNT(*) AS total FROM payments p ${whereSQL}`;
      const countRes = await pool.query(countQ, params);
      const total = parseInt(countRes.rows[0].total, 10) || 0;

      const dataQ = `
        SELECT p.*, s.name as student_name, s.seat_number
        FROM payments p
        LEFT JOIN students s ON p.student_id = s.id
        ${whereSQL}
        ORDER BY p.payment_date DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(pageSize, offset);
      const dataRes = await pool.query(dataQ, params);

      return res.json({ items: dataRes.rows || [], total });
    }

    if (group === 'expenses') {
      // key may be category name or id
      const where = [];
      const params = [];
      let idx = 1;
      // join with categories and match name or id
      const catIsNum = !isNaN(Number(key));
      if (catIsNum) {
        where.push(`e.expense_category_id = $${idx++}`);
        params.push(Number(key));
      } else {
        where.push(`c.name = $${idx++}`);
        params.push(key);
      }
      if (startDate) {
        where.push(`e.expense_date >= $${idx++}::timestamp`);
        params.push(startDate + ' 00:00:00');
      }
      if (endDate) {
        where.push(`e.expense_date < ($${idx++}::timestamp + INTERVAL '1 day')`);
        params.push(endDate);
      }
      const whereSQL = `WHERE ${where.join(' AND ')}`;

      const countQ = `SELECT COUNT(*) AS total FROM expenses e LEFT JOIN expense_categories c ON e.expense_category_id = c.id ${whereSQL}`;
      const countRes = await pool.query(countQ, params);
      const total = parseInt(countRes.rows[0].total, 10) || 0;

      const dataQ = `
        SELECT e.*, c.name as category_name
        FROM expenses e
        LEFT JOIN expense_categories c ON e.expense_category_id = c.id
        ${whereSQL}
        ORDER BY e.expense_date DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(pageSize, offset);
      const dataRes = await pool.query(dataQ, params);

      return res.json({ items: dataRes.rows || [], total });
    }

    return res.status(400).json({ error: 'Unsupported group type' });
  } catch (error) {
    logger.error('Error fetching finance group items', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch group items' });
  }
});
