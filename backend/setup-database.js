const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const logger = require('./utils/logger');
// Use the central pool (respects DB_MODE / DEV_DATABASE_URL logic)
const { pool } = require('./config/database');

async function setupDatabase() {
  try {
    logger.info('🔧 Setting up database schema...');

    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '..', 'db_schema_postgres.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Connect to database
    const client = await pool.connect();
  logger.info('✅ Connected to PostgreSQL database (setup)');

    // Execute schema
    await client.query(schemaSql);
    logger.info('✅ Database schema created successfully');

    client.release();

    logger.info('\n🎉 Database setup completed!');
    logger.info('You can now:');
    logger.info('1. Restart the backend server');
    logger.info('2. Login with username: admin, password: admin123');

  } catch (error) {
    logger.warn('❌ Error setting up database', { error: error.message });
  } finally {
  // Do not end the shared pool forcibly; allow process exit if this is a standalone script
  try { await pool.end(); } catch (_) {}
  }
}

setupDatabase();
