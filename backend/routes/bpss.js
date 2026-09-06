const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

const GRACE_PERIOD_DAYS = 2;

// Build a human-readable justification from PBS metrics
function generateJustification(row) {
  if (row.score_status === 'NO_DATA') {
    return 'No applicable payment cycles in the last 12 months. Score defaults to 100.';
  }

  const latePct   = parseFloat(row.late_percentage);
  const streak    = parseInt(row.current_consecutive_late_cycles, 10);
  const confPct   = parseInt(row.confidence_pct, 10);
  const recent3m  = parseFloat(row.recent_3_month_late_pct);
  const parts     = [];

  if (latePct === 0) {
    parts.push('all payments on time');
  } else {
    parts.push(`${latePct.toFixed(1)}% of payments were late`);
  }

  if (streak >= 2) parts.push(`${streak} payments late in a row`);

  if (recent3m > latePct + 15) {
    parts.push(`getting worse recently (${recent3m.toFixed(0)}% late in last 3 months)`);
  } else if (recent3m < latePct - 15 && latePct > 20) {
    parts.push(`improving recently (${recent3m.toFixed(0)}% late in last 3 months)`);
  }

  if (confPct < 100) {
    parts.push(`only ${confPct}% of 12 month's data available`);
  }

  return `Rating is ${row.risk_level} — ${parts.join(', ')}.`;
}

// Per-student payment timeline query (recursive, mirrors the app's getMembershipBaseDate logic).
// Returns individual payment rows with computed delay_days for the last 12 months.
const PAYMENT_TIMELINE_QUERY = `
WITH RECURSIVE
numbered_payments AS (
  SELECT
    p.id,
    p.payment_date::DATE                                             AS payment_date,
    p.amount,
    FLOOR((p.amount / $3::NUMERIC) * 30)::INTEGER                   AS ext_days,
    ROW_NUMBER() OVER (ORDER BY p.payment_date, p.id)               AS rn
  FROM payments p
  WHERE p.student_id   = $1
    AND p.payment_type  = 'monthly_fee'
    AND p.payment_date >= $2::DATE
),
timeline(
  id, payment_date, amount, ext_days, rn,
  expected_due, simulated_till, delay_raw, is_inactive_return
) AS (
  SELECT
    np.id, np.payment_date, np.amount, np.ext_days, np.rn,
    $2::DATE,
    GREATEST($2::DATE, np.payment_date) + np.ext_days,
    GREATEST(0, (np.payment_date - $2::DATE)),
    FALSE
  FROM numbered_payments np
  WHERE np.rn = 1

  UNION ALL

  SELECT
    np.id, np.payment_date, np.amount, np.ext_days, np.rn,
    tl.simulated_till,
    GREATEST(tl.simulated_till, np.payment_date) + np.ext_days,
    GREATEST(0, (np.payment_date - tl.simulated_till)),
    EXISTS (
      SELECT 1 FROM students_history sh
      WHERE sh.id                     = $1
        AND sh.membership_status      = 'inactive'
        AND sh.action_timestamp::DATE > tl.simulated_till
        AND sh.action_timestamp::DATE <= np.payment_date
    )
  FROM timeline tl
  JOIN numbered_payments np ON np.rn = tl.rn + 1
)
SELECT
  tl.id,
  tl.payment_date,
  tl.expected_due                                                    AS due_date,
  tl.amount,
  CASE WHEN tl.is_inactive_return THEN 0 ELSE tl.delay_raw END      AS delay_days,
  CASE
    WHEN tl.is_inactive_return                        THEN 'inactive_return'
    WHEN tl.delay_raw <= ${GRACE_PERIOD_DAYS}          THEN 'on_time'
    ELSE                                                   'late'
  END                                                                AS payment_status
FROM timeline tl
WHERE tl.payment_date >= CURRENT_DATE - INTERVAL '1 year'
ORDER BY tl.payment_date DESC
`;

// GET /api/students/:id/pbs
router.get('/:id/pbs', async (req, res) => {
  const rl = logger.createRequestLogger
    ? logger.createRequestLogger('GET', `/api/students/${req.params.id}/pbs`, req)
    : null;

  try {
    const studentId = parseInt(req.params.id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    // 1. Refresh the materialized view so scores are always current when the dialog opens.
    // Errors here are non-fatal — the route continues and returns whatever data is available.
    try {
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY bpss_scores');
    } catch (refreshErr) {
      if (refreshErr.code !== '42P01') {
        logger.warn('Could not refresh bpss_scores before PBS fetch', { error: refreshErr.message });
      }
    }

    // 3. Verify student exists and get fee/membership info
    const studentRes = await pool.query(
      `SELECT s.id, s.name, s.sex, s.membership_date,
         CASE WHEN s.sex = 'male'
              THEN COALESCE(fc.male_monthly_fees, 0)
              ELSE COALESCE(fc.female_monthly_fees, 0)
         END AS monthly_fee
       FROM students s
       LEFT JOIN student_fees_config fc
         ON fc.membership_type = s.membership_type
       WHERE s.id = $1`,
      [studentId]
    );

    if (!studentRes.rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentRes.rows[0];

    // 4. Fetch aggregated PBS from materialized view.
    // If the view doesn't exist yet (migration not run), fall back to NO_DATA gracefully.
    let bpssRes = { rows: [] };
    try {
      bpssRes = await pool.query(
        'SELECT * FROM bpss_scores WHERE student_id = $1',
        [studentId]
      );
    } catch (viewErr) {
      // 42P01 = "undefined_table" — view not created yet
      if (viewErr.code !== '42P01') throw viewErr;
      logger.warn('bpss_scores view not found — run the migration to enable PBS scoring');
    }

    // 5. Build response: use view row if present, otherwise synthesize NO_DATA row
    let bpssRow;
    if (bpssRes.rows.length) {
      bpssRow = bpssRes.rows[0];
    } else {
      bpssRow = {
        student_id: studentId,
        student_name: student.name,
        bpss_score: 100,
        risk_level: 'Trusted',
        score_status: 'NO_DATA',
        total_applicable_cycles: 0,
        on_time_cycles: 0,
        late_cycles: 0,
        late_percentage: 0,
        average_delay_days: 0,
        maximum_delay_days: 0,
        confidence_pct: 0,
        raw_score: 100,
        recent_3_month_late_pct: 0,
        recent_4_6_month_late_pct: 0,
        recent_7_12_month_late_pct: 0,
        current_consecutive_late_cycles: 0,
        last_payment_date: null,
      };
    }

    // 6. Free members have no monthly fee — PBS is not applicable.
    const monthlyFee = parseFloat(student.monthly_fee);
    if (monthlyFee === 0) {
      return res.json({
        studentId: studentId,
        studentName: student.name,
        score: null,
        riskLevel: null,
        scoreStatus: 'FREE_MEMBER',
        metrics: null,
        scoreBreakdown: null,
        lastPaymentDate: null,
        justification: 'PBS is not applicable for free memberships.',
        paymentHistory: [],
      });
    }

    // 7. Fetch per-payment timeline for the detail view
    const histRes = await pool.query(PAYMENT_TIMELINE_QUERY, [
      studentId,
      student.membership_date,
      monthlyFee,
    ]);
    const paymentHistory = histRes.rows;

    // 8. New members have only their enrollment payment (rn=1 is excluded from scoring).
    // Detect this: NO_DATA from the view but at least one payment exists in the last year.
    // They haven't missed anything — PBS simply has no renewal cycles to judge yet.
    if (bpssRow.score_status === 'NO_DATA' && paymentHistory.length > 0) {
      return res.json({
        studentId: studentId,
        studentName: student.name,
        score: null,
        riskLevel: null,
        scoreStatus: 'NEW_MEMBER',
        metrics: null,
        scoreBreakdown: null,
        lastPaymentDate: paymentHistory[0]?.payment_date ?? null,
        gracePeriodDays: GRACE_PERIOD_DAYS,
        justification: 'No renewal cycles yet. PBS will be available after the first renewal payment.',
        paymentHistory: paymentHistory.map((row) => ({
          id: row.id,
          paymentDate: row.payment_date,
          dueDate: row.due_date,
          amount: parseFloat(row.amount),
          delayDays: parseInt(row.delay_days, 10),
          paymentStatus: row.payment_status,
        })),
      });
    }

    // 9. Build response object
    const response = {
      studentId: bpssRow.student_id,
      studentName: bpssRow.student_name,
      score: parseInt(bpssRow.bpss_score, 10),
      riskLevel: bpssRow.risk_level,
      scoreStatus: bpssRow.score_status,

      metrics: {
        totalApplicableCycles: parseInt(bpssRow.total_applicable_cycles, 10),
        onTimeCycles: parseInt(bpssRow.on_time_cycles, 10),
        lateCycles: parseInt(bpssRow.late_cycles, 10),
        latePercentage: parseFloat(bpssRow.late_percentage),
        averageDelayDays: parseFloat(bpssRow.average_delay_days),
        maximumDelayDays: parseInt(bpssRow.maximum_delay_days, 10),
        recent3MonthLatePercentage: parseFloat(bpssRow.recent_3_month_late_pct),
        recent4To6MonthLatePercentage: parseFloat(bpssRow.recent_4_6_month_late_pct),
        recent7To12MonthLatePercentage: parseFloat(bpssRow.recent_7_12_month_late_pct),
        currentConsecutiveLateCycles: parseInt(bpssRow.current_consecutive_late_cycles, 10),
      },

      confidencePct: parseInt(bpssRow.confidence_pct, 10),
      rawScore: parseFloat(bpssRow.raw_score),

      lastPaymentDate: bpssRow.last_payment_date,
      gracePeriodDays: GRACE_PERIOD_DAYS,
      justification: generateJustification(bpssRow),

      paymentHistory: paymentHistory.map((row) => ({
        id: row.id,
        paymentDate: row.payment_date,
        dueDate: row.due_date,
        amount: parseFloat(row.amount),
        delayDays: parseInt(row.delay_days, 10),
        paymentStatus: row.payment_status,
      })),
    };

    if (rl) rl.success(response);
    return res.json(response);
  } catch (err) {
    logger.error('Failed to fetch PBS data', { error: err.message, code: err.code, stack: err.stack });
    return res.status(500).json({ error: 'Failed to fetch PBS data', details: err.message });
  }
});

// POST /api/students/pbs/refresh  — manual refresh of the materialized view (admin-triggered)
router.post('/pbs/refresh', async (req, res) => {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY bpss_scores');
    logger.info('bpss_scores materialized view refreshed via API');
    return res.json({ success: true, message: 'PBS scores refreshed successfully' });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'PBS view not initialised — run the migration first' });
    }
    logger.error('Failed to refresh PBS scores', { error: err.message });
    return res.status(500).json({ error: 'Failed to refresh PBS scores', details: err.message });
  }
});

module.exports = router;
