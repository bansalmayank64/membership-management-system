const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const logger = require('./utils/logger');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_nYbqRxpE4B3j@ep-purple-smoke-a1d6n7w6-pooler.ap-southeast-1.aws.neon.tech/gogaji?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupDatabase() {
  try {
    logger.info('🔧 Setting up database schema...');

    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '..', 'db_schema_postgres.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Connect to database
    const client = await pool.connect();
    logger.info('✅ Connected to Neon PostgreSQL database');

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
    await pool.end();
  }
}

setupDatabase();
