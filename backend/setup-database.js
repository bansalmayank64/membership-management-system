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
    
    // Create first admin user with role and permissions
    const passwordHash = await bcrypt.hash('admin123', 12);
    
    const createAdminQuery = `
      INSERT INTO users (username, password_hash, role, permissions)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username;
    `;
    
    const adminPermissions = {
      canManageUsers: true,
      canImportData: true,
      canExportData: true,
      canDeleteData: true,
      canManageSeats: true,
      canManageStudents: true,
      canManagePayments: true,
      canManageExpenses: true
    };
    
    const result = await client.query(createAdminQuery, [
      'admin', 
      passwordHash, 
      'admin',
      JSON.stringify(adminPermissions)
    ]);
    
    if (result.rows.length > 0) {
      console.log('✅ Admin user created successfully');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('ℹ️  Admin user already exists');
    }
    
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
