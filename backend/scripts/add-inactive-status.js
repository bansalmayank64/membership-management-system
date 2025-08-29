const { pool } = require('../config/database');

async function addInactiveStatus() {
  console.log('🔄 Starting migration to add inactive membership status...');
  
  try {
    // Drop the existing constraint
    console.log('🔧 Dropping existing constraint...');
    await pool.query('ALTER TABLE students DROP CONSTRAINT IF EXISTS students_membership_status_check');
    
    // Add the new constraint with 'inactive' included
    console.log('🔧 Adding new constraint with inactive status...');
    await pool.query(`
      ALTER TABLE students ADD CONSTRAINT students_membership_status_check 
      CHECK (membership_status IN ('active','expired','suspended','inactive'))
    `);
    
    // Verify the constraint was added
    console.log('🔍 Verifying constraint...');
    const result = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'students'::regclass 
        AND conname = 'students_membership_status_check'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Constraint added successfully:', result.rows[0].definition);
    } else {
      console.log('❌ Constraint not found after addition');
    }
    
    // Show current membership statuses
    console.log('📊 Current membership statuses in database:');
    const statusResult = await pool.query(`
      SELECT DISTINCT membership_status, COUNT(*) as count
      FROM students 
      GROUP BY membership_status
      ORDER BY membership_status
    `);
    
    console.table(statusResult.rows);
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addInactiveStatus();
