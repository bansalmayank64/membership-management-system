const { Pool } = require('pg');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

// Switching logic:
// Set DB_MODE=dev (or USE_DEV_DB=1 / true) before starting the server to point to DEV_DATABASE_URL.
// Fallback order when dev mode requested: DEV_DATABASE_URL -> DATABASE_URL_DEV -> DATABASE_URL
// Default (no dev flag) uses DATABASE_URL.
const devRequested = ['dev','development'].includes((process.env.DB_MODE || '').toLowerCase()) || /^(1|true|yes)$/i.test(process.env.USE_DEV_DB || '');
const primaryUrl = process.env.DATABASE_URL;
const devUrl = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL_DEV;
const connectionString = devRequested ? (devUrl || primaryUrl) : primaryUrl;

if (!connectionString) {
  logger.error('No database connection string provided. Set DATABASE_URL or DEV_DATABASE_URL.');
  throw new Error('DATABASE_URL not configured');
}

// Enable SSL if explicitly production OR if the URL appears to be a managed cloud host (e.g., neon.tech) unless disabled.
const autoSsl = /neon\.tech|\.rds\.amazonaws\.com|\.azure\.com|\.gcp\.cloudsql/.test(connectionString);
const forceNoSsl = /^(0|false|off)$/i.test(process.env.DB_SSL_DISABLE || '');
const useSsl = forceNoSsl ? false : (process.env.NODE_ENV === 'production' || autoSsl)
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString,
  ssl: useSsl
});

try {
  const parsed = new URL(connectionString);
  const masked = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':'+parsed.port : ''}${parsed.pathname}`;
  logger.info(`DB init: mode=${devRequested ? 'dev' : 'default'} ssl=${useSsl ? 'on' : 'off'} host=${parsed.hostname} url=${masked}`);
} catch (_) {
  logger.info(`DB init: mode=${devRequested ? 'dev' : 'default'} ssl=${useSsl ? 'on' : 'off'}`);
}
 
// Test database connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});
 
pool.on('error', (err) => {
  logger.warn('Unexpected error on idle client', { error: err.message });
  process.exit(-1);
});
 
module.exports = { pool };
