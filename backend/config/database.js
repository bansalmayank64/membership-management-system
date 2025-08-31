const { Pool } = require('pg');
const dotenv = require('dotenv');
const logger = require('../utils/logger');
 
dotenv.config();
 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
 
// Test database connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});
 
pool.on('error', (err) => {
  logger.warn('Unexpected error on idle client', { error: err.message });
  process.exit(-1);
});
 
module.exports = { pool };
