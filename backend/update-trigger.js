const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '1234',
  host: 'localhost',
  port: 5432,
  database: 'study_room_db'
});

async function updateTrigger() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Updating trigger function to handle UNASSIGNED seats...');
    
    const triggerSQL = `
      CREATE OR REPLACE FUNCTION check_seat_sex_match() RETURNS TRIGGER AS $func$
      BEGIN
          -- Allow UNASSIGNED seats for any gender
          IF NEW.seat_number = 'UNASSIGNED' THEN
              RETURN NEW;
          END IF;
          
          -- For real seat numbers, check sex restriction
          IF NEW.seat_number IS NOT NULL THEN
              PERFORM 1 FROM seats WHERE seat_number = NEW.seat_number AND (occupant_sex = NEW.sex OR occupant_sex IS NULL);
              IF NOT FOUND THEN
                  RAISE EXCEPTION 'Student sex % does not match seat % restriction', NEW.sex, NEW.seat_number;
              END IF;
              
              -- Update seat occupant_sex when student is assigned
              UPDATE seats SET occupant_sex = NEW.sex, status = 'occupied' WHERE seat_number = NEW.seat_number;
          END IF;
          RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql;
    `;
    
    await client.query(triggerSQL);
    console.log('✅ Successfully updated check_seat_sex_match trigger');
    
  } catch (error) {
    console.error('❌ Error updating trigger:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateTrigger();
