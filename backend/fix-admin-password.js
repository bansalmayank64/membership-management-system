const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nYbqRxpE4B3j@ep-purple-smoke-a1d6n7w6-pooler.ap-southeast-1.aws.neon.tech/gogaji?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixAdminPassword() {
  try {
    const client = await pool.connect();
    
    // Check current password hash
    const currentUser = await client.query('SELECT password_hash FROM users WHERE username = $1', ['admin']);
    console.log('Current password hash exists:', !!currentUser.rows[0]?.password_hash);
    
    // Test password verification
    const testPassword = 'admin123';
    if (currentUser.rows[0]?.password_hash) {
      const isValid = await bcrypt.compare(testPassword, currentUser.rows[0].password_hash);
      console.log('Password verification result:', isValid);
    }
    
    // Create new password hash
    const newPasswordHash = await bcrypt.hash('admin123', 12);
    console.log('Generated new password hash');
    
    // Update the admin user password
    const updateResult = await client.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username',
      [newPasswordHash, 'admin']
    );
    
    console.log('Password updated for user:', updateResult.rows[0]);
    
    // Test the new password
    const updatedUser = await client.query('SELECT password_hash FROM users WHERE username = $1', ['admin']);
    const isNewPasswordValid = await bcrypt.compare('admin123', updatedUser.rows[0].password_hash);
    console.log('New password verification result:', isNewPasswordValid);
    
    client.release();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixAdminPassword();
