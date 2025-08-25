// Simple script to check seat availability
const { pool } = require('./config/database');

async function checkSeats() {
  try {
    const client = await pool.connect();
    
    // Check first 5 seats
    const result = await client.query(`
      SELECT seat_number, status, occupant_sex, student_id 
      FROM seats 
      ORDER BY 
        CASE WHEN seat_number ~ '^[0-9]+$' THEN CAST(seat_number AS INTEGER) ELSE 999999 END ASC,
        seat_number ASC
      LIMIT 5
    `);
    
    console.log('First 5 seats:');
    result.rows.forEach(seat => {
      console.log(`Seat ${seat.seat_number}: status=${seat.status}, gender=${seat.occupant_sex}, student_id=${seat.student_id}`);
    });
    
    // Test the specific query used in student creation
    const testQuery = `
      SELECT * FROM seats 
      WHERE seat_number = $1 AND status = 'available' 
      AND (occupant_sex IS NULL OR occupant_sex = $2)
    `;
    
    const testResult = await client.query(testQuery, ['1', 'male']);
    console.log('\nSeat 1 availability for male student:');
    console.log('Found seats:', testResult.rows.length);
    if (testResult.rows.length > 0) {
      console.log('Seat details:', testResult.rows[0]);
    }
    
    client.release();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSeats();
