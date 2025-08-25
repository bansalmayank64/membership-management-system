const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nYbqRxpE4B3j@ep-purple-smoke-a1d6n7w6-pooler.ap-southeast-1.aws.neon.tech/gogaji?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkAdmin() {
  try {
    const client = await pool.connect();
    
    // Check if users table exists
    const tableCheck = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')");
    console.log('Users table exists:', tableCheck.rows[0].exists);
    
    // Check admin user
    const result = await client.query('SELECT id, username, role, permissions FROM users WHERE username = $1', ['admin']);
    console.log('Admin user found:', result.rows.length > 0);
    if (result.rows.length > 0) {
      console.log('Admin user data:', result.rows[0]);
    }
    
    // Check all users
    const allUsers = await client.query('SELECT id, username, role FROM users');
    console.log('All users:', allUsers.rows);
    
    client.release();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAdmin();
