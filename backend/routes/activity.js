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

  const { userId, start, end, type, excludeType, search, page = 0, pageSize = 100 } = req.query;

  try {
    // Create union of history sources (no per-table WHERE) and apply filters in outer query for performance
    const snippets = [];
    // Raw history sources
    // Base student history events, excluding the specific UPDATE rows that transition to inactive (those are replaced by synthetic 'deactivated' events)
    snippets.push(`SELECT action_timestamp as ts,
             action as action_type,
             modified_by,
             id as subject_id,
             'student' as subject_type,
             to_jsonb(json_build_object('name', name, 'aadhaar', aadhaar_number, 'contact', contact_number, 'seat', seat_number, 'membership_status', membership_status)) as details
      FROM (
        SELECT sh.*,
               lag(membership_status) over (partition by id order by action_timestamp) as prev_status,
               lag(name) over (partition by id order by action_timestamp) as prev_name,
               lag(aadhaar_number) over (partition by id order by action_timestamp) as prev_aadhaar,
               lag(contact_number) over (partition by id order by action_timestamp) as prev_contact,
               lag(seat_number) over (partition by id order by action_timestamp) as prev_seat
        FROM students_history sh
      ) sh
      WHERE NOT (
          -- Exclude deactivation transition (handled by synthetic 'deactivated')
          action = 'UPDATE' AND membership_status = 'inactive' AND COALESCE(prev_status,'') <> 'inactive'
        )
        AND NOT (
          -- Exclude no-op UPDATEs where none of the key fields changed
          action = 'UPDATE'
          AND COALESCE(name,'') = COALESCE(prev_name,'')
          AND COALESCE(aadhaar_number,'') = COALESCE(prev_aadhaar,'')
          AND COALESCE(contact_number,'') = COALESCE(prev_contact,'')
          AND COALESCE(seat_number,'') = COALESCE(prev_seat,'')
          AND (membership_status = COALESCE(prev_status, membership_status))
        )`);
    // Seat history: exclude rows whose assignment already ended (end_date NOT NULL) because we emit a synthetic 'unassigned' event for those
    snippets.push(`SELECT action_timestamp as ts, action as action_type, modified_by, student_id as subject_id, 'seat' as subject_type, to_jsonb(json_build_object('seat_number', seat_number, 'student_name', student_name, 'occupant_sex', occupant_sex, 'active_assignment', (end_date IS NULL))) as details FROM seats_history WHERE end_date IS NULL`);
    snippets.push(`SELECT p.created_at as ts, p.payment_type as action_type, p.modified_by, p.student_id as subject_id, 'payment' as subject_type, to_jsonb(json_build_object('amount', p.amount, 'payment_date', p.payment_date, 'remarks', p.remarks, 'student_name', s.name)) as details FROM payments p LEFT JOIN students s ON p.student_id = s.id`);
    // activity_logs (including expenses) with category enrichment
    snippets.push(`SELECT al.created_at as ts, al.action_type as action_type, al.actor_user_id as modified_by, al.subject_id as subject_id, al.subject_type as subject_type, (
      CASE WHEN al.subject_type = 'expense' THEN (
        (to_jsonb(al.metadata) || COALESCE(to_jsonb(json_build_object('category_name', c.name)), '{}'::jsonb))
      ) ELSE al.metadata END
    ) as details FROM activity_logs al LEFT JOIN LATERAL (
      SELECT name FROM expense_categories c WHERE c.id = (CASE WHEN (al.metadata->>'expense_category_id') IS NOT NULL THEN (al.metadata->>'expense_category_id')::int WHEN (al.metadata->>'category_id') IS NOT NULL THEN (al.metadata->>'category_id')::int WHEN (al.metadata->>'expenseCategory') IS NOT NULL THEN (al.metadata->>'expenseCategory')::int ELSE NULL END)
    ) c ON true`);
    // Synthetic DEACTIVATE event: only on transition to inactive (exclude already inactive to inactive)
    snippets.push(`SELECT sh.action_timestamp as ts, 'deactivated' as action_type, sh.modified_by, sh.id as subject_id, 'student' as subject_type,
      to_jsonb(json_build_object(
        'name', sh.name,
        'membership_status', sh.membership_status,
        'seat_number_before', sh.prev_seat_number,
        'seat_number_after', sh.seat_number
      )) as details
      FROM (
        SELECT sh.*,
               lag(sh.membership_status) over (partition by sh.id order by sh.action_timestamp) as prev_status,
               lag(sh.seat_number) over (partition by sh.id order by sh.action_timestamp) as prev_seat_number
        FROM students_history sh
      ) sh
      WHERE sh.membership_status = 'inactive' AND sh.action = 'UPDATE' AND COALESCE(sh.prev_status,'') <> 'inactive'`);
    // Synthetic UNASSIGN event: seat assignment concluded (seat history row ended)
    snippets.push(`SELECT sh.end_date as ts, 'unassigned' as action_type, sh.modified_by, sh.student_id as subject_id, 'seat' as subject_type,
      to_jsonb(json_build_object('seat_number', sh.seat_number, 'student_name', sh.student_name)) as details
      FROM seats_history sh
      WHERE sh.end_date IS NOT NULL AND sh.action = 'ASSIGN'`);
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
      const allowedSubjects = ['student','seat','payment','expense','activity'];
      let typeFilter = type;
      const tl = type.toString().toLowerCase();
  if (tl === 'deactivated' || tl === 'deactivate') typeFilter = 'deactivated';
  if (tl === 'unassigned' || tl === 'unassign') typeFilter = 'unassigned';
      if (allowedSubjects.includes(typeFilter)) {
        outerClauses.push(`t.subject_type = $${pidx++}`);
        outerParams.push(typeFilter);
      } else {
        outerClauses.push(`t.action_type = $${pidx++}`);
        outerParams.push(typeFilter);
      }
    }

    // Add excludeType filter (primarily for excluding ai_chat_query)
    if (excludeType) {
      outerClauses.push(`t.action_type != $${pidx++}`);
      outerParams.push(excludeType);
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
        // use the main expenses table for previous state lookups (expenses has updated_at)
        table = 'expenses'; idCol = 'id'; timestampCol = 'updated_at'; break;
      case 'payment':
        // payments table contains full payment history; subjectId is student_id in activity union
        table = 'payments'; idCol = 'student_id'; timestampCol = 'updated_at'; break;
      default:
        return res.status(400).json({ error: 'unsupported subjectType' });
    }

  let q;
  if (table === 'students_history') {
    // Treat naive value as UTC wall-clock, so convert incoming timestamptz to UTC local timestamp
    q = `SELECT * FROM ${table} WHERE ${idCol} = $1 AND ${timestampCol} < ($2::timestamptz AT TIME ZONE 'UTC') ORDER BY ${timestampCol} DESC LIMIT 1`;
  } else {
    // Default: naive column stored as IST wall-clock
    q = `SELECT * FROM ${table} WHERE ${idCol} = $1 AND ${timestampCol} < ($2::timestamptz AT TIME ZONE 'Asia/Kolkata') ORDER BY ${timestampCol} DESC LIMIT 1`;
  }
    const params = [subjectId, before];
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
