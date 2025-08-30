const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nYbqRxpE4B3j@ep-purple-smoke-a1d6n7w6-pooler.ap-southeast-1.aws.neon.tech/gogaji?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database schema...');
    
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '..', 'db_schema_postgres.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Connect to database
    const client = await pool.connect();
    console.log('✅ Connected to Neon PostgreSQL database');
    
    // Execute schema
    await client.query(schemaSql);
    console.log('✅ Database schema created successfully');
    
    client.release();
    
    console.log('\n🎉 Database setup completed!');
    console.log('You can now:');
    console.log('1. Restart the backend server');
    console.log('2. Login with username: admin, password: admin123');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();
