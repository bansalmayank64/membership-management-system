const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Running AI query frequency migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', '..', 'migrations', 'add_ai_query_frequency.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ AI query frequency table created successfully!');
    console.log('📊 Features now available:');
    console.log('   - Persistent query frequency tracking');
    console.log('   - Personalized suggestions based on usage history');
    console.log('   - Query analytics and statistics');
    console.log('   - Automatic cleanup of old query patterns');
    
    // Test the table by checking its structure
    const testQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'ai_query_frequency' 
      ORDER BY ordinal_position
    `;
    
    const result = await pool.query(testQuery);
    console.log('\n📋 Table structure:');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;