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

module.exports = router;
