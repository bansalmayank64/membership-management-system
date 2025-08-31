const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');
const logger = require('./utils/logger');

async function resetAdminPassword() {
  logger.info('🔐 === ADMIN PASSWORD RESET UTILITY ===');
  logger.info('📅 Timestamp:', new Date().toISOString());
  
  try {
    // Default password
    const newPassword = process.env.ADMIN_RESET_PASSWORD || 'admin123';
    const username = 'admin';
    
    logger.info(`👤 Resetting password for user: ${username}`);
    logger.info('🔑 New password will be set (not logged for security)');
    
    // Hash the new password
    logger.info('🔧 Generating password hash...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    logger.info('✅ Password hash generated successfully');
    
    // Check if admin user exists
    logger.info('🔍 Checking if admin user exists...');
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE username = $1', [username]);
    
    if (userCheck.rows.length === 0) {
      logger.info('❌ Admin user not found. Creating new admin user...');
      
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
      
      logger.info('✅ Admin user created successfully', { user: { id: result.rows[0].id, username: result.rows[0].username } });
    } else {
      logger.info('✅ Admin user found', { user: userCheck.rows[0] });
      logger.info('🔧 Updating password...');
      
      // Update password
      const updateQuery = `
        UPDATE users 
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE username = $2
        RETURNING id, username, role
      `;
      
      const result = await pool.query(updateQuery, [hashedPassword, username]);
      logger.info('✅ Password updated successfully', { user: result.rows[0] });
    }
    
    // Verify the password works (verify by hashing comparison, do not log hashes)
    logger.info('🧪 Verifying new password...');
    const verifyQuery = await pool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
    const storedHash = verifyQuery.rows[0].password_hash;
    
    const isValid = await bcrypt.compare(newPassword, storedHash);
    
    if (isValid) {
      logger.info('✅ Password verification successful!');
      logger.info('🎉 === RESET COMPLETE ===');
      logger.info('👤 Username: ' + username);
      logger.info('🔑 Password has been set (not logged for security)');
    } else {
      logger.warn('❌ Password verification failed!');
      throw new Error('Password verification failed after update');
    }
    
  } catch (error) {
    logger.warn('💥 === ERROR OCCURRED ===', { message: error.message });
    logger.warn('📍 Error stack available in server logs');
    process.exit(1);
  } finally {
    logger.info('🔌 Closing database connection...');
    await pool.end();
    logger.info('✅ Database connection closed');
    process.exit(0);
  }
}

// Run the reset
resetAdminPassword().catch(error => {
  logger.warn('💥 Unhandled error during admin reset', { error: error.message });
  process.exit(1);
});
