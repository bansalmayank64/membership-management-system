const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function resetAdminPassword() {
  console.log('🔐 === ADMIN PASSWORD RESET UTILITY ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  
  try {
    // Default password
    const newPassword = 'admin123';
    const username = 'admin';
    
    console.log(`👤 Resetting password for user: ${username}`);
    console.log(`🔑 New password will be: ${newPassword}`);
    
    // Hash the new password
    console.log('🔧 Generating password hash...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    console.log('✅ Password hash generated successfully');
    console.log(`🔐 Hash: ${hashedPassword}`);
    
    // Check if admin user exists
    console.log('🔍 Checking if admin user exists...');
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE username = $1', [username]);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ Admin user not found. Creating new admin user...');
      
      // Create admin user
      const insertQuery = `
        INSERT INTO users (username, password_hash, role, permissions, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, username, role
      `;
      
      const permissions = {
        canManageUsers: true,
        canImportData: true,
        canExportData: true,
        canDeleteData: true,
        canManageSeats: true,
        canManageStudents: true,
        canManagePayments: true,
        canManageExpenses: true
      };
      
      const result = await pool.query(insertQuery, [
        username,
        hashedPassword,
        'admin',
        JSON.stringify(permissions)
      ]);
      
      console.log('✅ Admin user created successfully:', result.rows[0]);
    } else {
      console.log('✅ Admin user found:', userCheck.rows[0]);
      console.log('🔧 Updating password...');
      
      // Update password
      const updateQuery = `
        UPDATE users 
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE username = $2
        RETURNING id, username, role
      `;
      
      const result = await pool.query(updateQuery, [hashedPassword, username]);
      console.log('✅ Password updated successfully:', result.rows[0]);
    }
    
    // Verify the password works
    console.log('🧪 Verifying new password...');
    const verifyQuery = await pool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
    const storedHash = verifyQuery.rows[0].password_hash;
    
    const isValid = await bcrypt.compare(newPassword, storedHash);
    
    if (isValid) {
      console.log('✅ Password verification successful!');
      console.log('');
      console.log('🎉 === RESET COMPLETE ===');
      console.log(`👤 Username: ${username}`);
      console.log(`🔑 Password: ${newPassword}`);
      console.log('📝 You can now log in with these credentials');
    } else {
      console.log('❌ Password verification failed!');
      throw new Error('Password verification failed after update');
    }
    
  } catch (error) {
    console.error('💥 === ERROR OCCURRED ===');
    console.error('📄 Error message:', error.message);
    console.error('📍 Error stack:', error.stack);
    process.exit(1);
  } finally {
    console.log('🔌 Closing database connection...');
    await pool.end();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

// Run the reset
resetAdminPassword().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
