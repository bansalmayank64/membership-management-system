// Test to debug seat ordering at database level
const { pool } = require('./backend/config/database');

async function testDatabaseOrdering() {
  try {
    console.log('🔍 Testing direct database seat ordering...\n');

    const query = `
      SELECT 
        s.seat_number,
        s.status,
        s.occupant_sex,
        st.id as student_id,
        st.name as student_name,
        st.sex as student_sex
      FROM seats s
      LEFT JOIN students st ON s.student_id = st.id
      WHERE s.status != 'removed'
      ORDER BY 
        CASE 
          WHEN s.seat_number ~ '^[0-9]+$' THEN CAST(s.seat_number AS INTEGER)
          ELSE 999999 
        END ASC,
        s.seat_number ASC
      LIMIT 20
    `;
    
    const result = await pool.query(query);
    
    console.log('Database query results (first 20):');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. Seat ${row.seat_number} - ${row.student_name || 'Empty'}`);
    });

    console.log('\nSeat number sequence from database:');
    const seatNumbers = result.rows.map(r => r.seat_number);
    console.log(seatNumbers.join(', '));

    await pool.end();
  } catch (error) {
    console.error('Database test error:', error);
  }
}

testDatabaseOrdering();
