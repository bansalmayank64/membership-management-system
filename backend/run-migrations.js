const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_nYbqRxpE4B3j@ep-purple-smoke-a1d6n7w6-pooler.ap-southeast-1.aws.neon.tech/gogaji?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  const migrationPath = path.join(__dirname, '..', 'migrations', '20250901_add_membership_type_to_students.sql');
  if (!fs.existsSync(migrationPath)) {
    logger.warn('Migration file not found: ' + migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const client = await pool.connect();
  try {
    logger.info('Running migration: add membership_type to students');
    await client.query(sql);
    logger.info('Migration applied successfully');
  } catch (err) {
    logger.warn('Migration failed', { error: err.message });
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
