const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nYbqRxpE4B3j@ep-purple-smoke-a1d6n7w6-pooler.ap-southeast-1.aws.neon.tech/gogaji?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupStudentFees() {
  try {
    console.log('🔧 Setting up student fees configuration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'create_student_fees_config.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Connect to database
    const client = await pool.connect();
    console.log('✅ Connected to Neon PostgreSQL database');
    
    // Execute SQL statements one by one
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement && !trimmedStatement.startsWith('--')) {
        console.log(`📝 Executing: ${trimmedStatement.substring(0, 50)}...`);
        await client.query(trimmedStatement);
      }
    }
    
    console.log('✅ Student fees configuration created successfully');
    
    // Verify the data
    const result = await client.query('SELECT * FROM student_fees_config ORDER BY gender');
    console.log('📊 Fee configuration:');
    result.rows.forEach(row => {
      console.log(`   ${row.gender}: ₹${row.monthly_fees}`);
    });
    
    client.release();
    
    console.log('\n🎉 Student fees setup completed!');
    console.log('The membership extension feature is now ready to use.');
    
  } catch (error) {
    console.error('❌ Error setting up student fees:', error);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Table might already exist. Trying to insert data only...');
      try {
        const client = await pool.connect();
        await client.query(`
          INSERT INTO student_fees_config (gender, monthly_fees) VALUES 
          ('male', 600.00),
          ('female', 550.00)
          ON CONFLICT (gender) DO UPDATE SET monthly_fees = EXCLUDED.monthly_fees;
        `);
        console.log('✅ Fee configuration updated successfully');
        client.release();
      } catch (insertError) {
        console.error('❌ Error inserting fee data:', insertError);
      }
    }
  } finally {
    await pool.end();
  }
}

setupStudentFees();
