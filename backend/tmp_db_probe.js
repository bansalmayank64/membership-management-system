const { pool } = require('./config/database');
(async ()=>{
  try {
    const cols = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='expenses'");
    console.log('COLUMNS:'); cols.rows.forEach(r=>console.log(JSON.stringify(r)));
    const cnt = await pool.query('SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) as total_amount FROM expenses');
    console.log('COUNT:',cnt.rows[0]);
    const sample = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 5');
    console.log('SAMPLE:', JSON.stringify(sample.rows, null, 2));
    const cats = await pool.query('SELECT id, name FROM expense_categories ORDER BY id');
    console.log('CATEGORIES:'); cats.rows.forEach(r=>console.log(JSON.stringify(r)));
  } catch(e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    try{ await pool.end(); } catch(_){}
  }
})();
