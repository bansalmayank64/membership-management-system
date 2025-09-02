const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken } = require('./auth');

// GET /api/admin/activity/users - list active users for dropdown
router.get('/users', authenticateToken, async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/admin/activity/users', req);
  rl.requestStart(req);
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const q = 'SELECT id, username FROM users WHERE status = \'active\' ORDER BY username ASC';
    rl.queryStart('list users', q);
    const result = await pool.query(q);
    rl.querySuccess('list users', null, result, true);
    res.json(result.rows);
  } catch (err) {
    rl.error(err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// GET /api/admin/activity?userId=...&start=YYYY-MM-DD&end=YYYY-MM-DD&type=students|payments|seats|all&search=...
router.get('/', authenticateToken, async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/admin/activity', req);
  rl.requestStart(req);
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { userId, start, end, type, search, page = 0, pageSize = 100 } = req.query;

  try {
    // Create union of history sources (no per-table WHERE) and apply filters in outer query for performance
    const snippets = [];
  snippets.push(`SELECT action_timestamp as ts, action as action_type, modified_by, id as subject_id, 'student' as subject_type, to_jsonb(json_build_object('name', name, 'aadhaar', aadhaar_number, 'contact', contact_number, 'seat', seat_number)) as details FROM students_history`);
  snippets.push(`SELECT action_timestamp as ts, action as action_type, modified_by, student_id as subject_id, 'seat' as subject_type, to_jsonb(json_build_object('seat_number', seat_number, 'student_name', student_name, 'occupant_sex', occupant_sex)) as details FROM seats_history`);
  snippets.push(`SELECT p.created_at as ts, p.payment_type as action_type, p.modified_by, p.student_id as subject_id, 'payment' as subject_type, to_jsonb(json_build_object('amount', p.amount, 'payment_date', p.payment_date, 'remarks', p.remarks)) as details FROM payments p`);
  snippets.push(`SELECT action_timestamp as ts, action as action_type, modified_by, id as subject_id, 'expense' as subject_type, to_jsonb(json_build_object('category', category, 'description', description, 'amount', amount)) as details FROM expenses_history`);
  snippets.push(`SELECT created_at as ts, action_type as action_type, actor_user_id as modified_by, subject_id as subject_id, subject_type as subject_type, metadata as details FROM activity_logs`);

    if (snippets.length === 0) return res.json({ activities: [], total: 0 });

    const union = snippets.join('\nUNION ALL\n');

    // Build outer WHERE clauses (apply to union result alias t)
    const outerClauses = [];
    const outerParams = [];
    let pidx = 1;

    if (userId) {
      outerClauses.push(`t.modified_by = $${pidx++}`);
      outerParams.push(userId);
    }
    if (start) {
      outerClauses.push(`t.ts >= $${pidx++}`);
      outerParams.push(start + ' 00:00:00');
    }
    if (end) {
      outerClauses.push(`t.ts <= $${pidx++}`);
      outerParams.push(end + ' 23:59:59');
    }

    if (type && type !== 'all') {
      const allowed = ['student','seat','payment','expense','activity'];
      if (allowed.includes(type)) {
        outerClauses.push(`t.subject_type = $${pidx++}`);
        outerParams.push(type);
      } else {
        outerClauses.push(`t.action_type = $${pidx++}`);
        outerParams.push(type);
      }
    }

    if (search) {
      outerClauses.push(`(COALESCE(t.details::text,'') ILIKE $${pidx++} OR COALESCE(t.action_type,'') ILIKE $${pidx++} OR COALESCE(t.subject_type,'') ILIKE $${pidx++})`);
      const sTerm = `%${search}%`;
      outerParams.push(sTerm, sTerm, sTerm);
    }

    const outerWhere = outerClauses.length > 0 ? `WHERE ${outerClauses.join(' AND ')}` : '';

    const limitParamIdx = pidx++;
    const offsetParamIdx = pidx++;

    const finalQ = `SELECT t.*, u.username as actor_username FROM ( ${union} ) t LEFT JOIN users u ON u.id = t.modified_by ${outerWhere} ORDER BY t.ts DESC LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;

    const finalParams = [...outerParams, Number(pageSize) || 100, (Number(page) || 0) * Number(pageSize || 100)];

  // Count total matching rows for pagination
  const countQ = `SELECT COUNT(*)::int as total FROM ( ${union} ) t ${outerWhere}`;
  rl.queryStart('activity count', countQ, outerParams);
  const c = await pool.query(countQ, outerParams);
  rl.querySuccess('activity count', null, c, false);

  rl.queryStart('activity query', finalQ, finalParams);
  const r = await pool.query(finalQ, finalParams);
  rl.querySuccess('activity query', null, r, false);

  const activities = r.rows.map(row => ({ timestamp: row.ts, type: row.action_type, userId: row.modified_by, actorUsername: row.actor_username, subjectId: row.subject_id, subjectType: row.subject_type, details: row.details }));

  const total = (c.rows && c.rows[0] && c.rows[0].total) ? c.rows[0].total : activities.length;
  res.json({ activities, total });
  } catch (err) {
    rl.error(err);
    res.status(500).json({ error: 'Failed to fetch activity', details: err.message });
  }
});

// GET /api/admin/activity/previous?subjectType=student|seat|expense&subjectId=...&before=TIMESTAMP
router.get('/previous', authenticateToken, async (req, res) => {
  const rl = logger.createRequestLogger('GET', '/api/admin/activity/previous', req);
  rl.requestStart(req);
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { subjectType, subjectId, before } = req.query;
  if (!subjectType || !subjectId || !before) return res.status(400).json({ error: 'subjectType, subjectId and before are required' });

  try {
    const beforeUtc = before;

    let table, idCol, timestampCol;
    switch ((subjectType || '').toString().toLowerCase()) {
      case 'student':
        table = 'students_history'; idCol = 'id'; timestampCol = 'action_timestamp'; break;
      case 'seat':
        table = 'seats_history'; idCol = 'student_id'; timestampCol = 'action_timestamp'; break;
      case 'expense':
        table = 'expenses_history'; idCol = 'id'; timestampCol = 'action_timestamp'; break;
      case 'payment':
        // payments table contains full payment history; subjectId is student_id in activity union
        table = 'payments'; idCol = 'student_id'; timestampCol = 'updated_at'; break;
      default:
        return res.status(400).json({ error: 'unsupported subjectType' });
    }

  // Compare timestamp column (TIMESTAMP without time zone) with the provided
  // 'before' value. Treat incoming value as timestamptz (ISO8601/UTC) and
  // convert to a timestamp without time zone in UTC for a correct comparison.
  // Convert incoming timestamptz to the same wall-clock timezone used by stored TIMESTAMPs.
  // The DB stores TIMESTAMP values in local IST (Asia/Kolkata), so convert to that timezone.
  const q = `SELECT * FROM ${table} WHERE ${idCol} = $1 AND ${timestampCol} < $2 ORDER BY ${timestampCol} DESC LIMIT 1`;
    const params = [subjectId, beforeUtc];
    // interpolate params for logging (safe-ish for debugging)
    try {
      let interp = q;
      params.forEach((p, idx) => {
        const val = (p === null || typeof p === 'undefined') ? 'NULL' : (typeof p === 'number' ? String(p) : `'${String(p).replace(/'/g, "''")}'`);
        interp = interp.replace(new RegExp('\\$' + (idx + 1) + '\\b', 'g'), val);
      });
      console.log('[activity.previous] SQL:', interp);
    } catch (e) {
      console.log('[activity.previous] SQL build error', e);
    }
  rl.queryStart('previous history', q, params);
  const r = await pool.query(q, params);
  rl.querySuccess('previous history', null, r, false);
  res.json({ previous: r.rows[0] || null });
  } catch (err) {
    rl.error(err);
    res.status(500).json({ error: 'Failed to fetch previous history', details: err.message });
  }
});

module.exports = router;
