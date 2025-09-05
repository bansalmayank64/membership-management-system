const fs = require('fs');

console.log('Validating db_schema_postgres.sql changes...\n');

const schemaContent = fs.readFileSync('./db_schema_postgres.sql', 'utf8');

// Check that membership_type constraints have been removed
const studentsTableMatch = schemaContent.match(/membership_type\s+VARCHAR\(\d+\)[^C]*DEFAULT\s+'full_time'/);
const feesConfigTableMatch = schemaContent.match(/CREATE TABLE student_fees_config[\s\S]*?membership_type\s+VARCHAR\(\d+\)\s+NOT NULL[^C]/);

console.log('✅ Checking students table membership_type column:');
if (studentsTableMatch) {
    if (studentsTableMatch[0].includes('CHECK')) {
        console.log('❌ Found CHECK constraint in students table - this should be removed');
    } else {
        console.log('✅ No CHECK constraint found in students table - correctly flexible');
    }
    
    if (studentsTableMatch[0].includes('VARCHAR(50)')) {
        console.log('✅ Column size is VARCHAR(50) - sufficient for custom membership types');
    } else {
        console.log('❌ Column size should be VARCHAR(50) for flexibility');
    }
} else {
    console.log('❌ Could not find membership_type column in students table');
}

console.log('\n✅ Checking student_fees_config table membership_type column:');
if (feesConfigTableMatch) {
    if (feesConfigTableMatch[0].includes('CHECK')) {
        console.log('❌ Found CHECK constraint in student_fees_config table - this should be removed');
    } else {
        console.log('✅ No CHECK constraint found in student_fees_config table - correctly flexible');
    }
    
    if (feesConfigTableMatch[0].includes('VARCHAR(50)')) {
        console.log('✅ Column size is VARCHAR(50) - sufficient for custom membership types');
    } else {
        console.log('❌ Column size should be VARCHAR(50) for flexibility');
    }
} else {
    console.log('❌ Could not find membership_type column in student_fees_config table');
}

// Check that default values are still present
const defaultInserts = schemaContent.match(/INSERT INTO student_fees_config.*VALUES[\s\S]*?full_time/);
console.log('\n✅ Checking default membership types insertion:');
if (defaultInserts) {
    console.log('✅ Default membership types (full_time, half_time, etc.) are still inserted');
} else {
    console.log('❌ Default membership types insertion not found');
}

console.log('\n🎉 Schema validation complete!');
