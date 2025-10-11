const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api'; // Adjust port as needed
const STUDENT_ID = 1; // Replace with actual student ID for testing

// Test function for Resume reactivation
async function testResumeReactivation() {
  try {
    console.log('Testing Resume Reactivation...');
    
    const response = await axios.patch(`${BASE_URL}/students/${STUDENT_ID}/activate`, {
      reactivationType: 'resume'
    });
    
    console.log('Resume Reactivation Response:', JSON.stringify(response.data, null, 2));
    console.log('✅ Resume reactivation test passed');
  } catch (error) {
    console.error('❌ Resume reactivation test failed:', error.response?.data || error.message);
  }
}

// Test function for Fresh reactivation
async function testFreshReactivation() {
  try {
    console.log('\nTesting Fresh Reactivation...');
    
    const response = await axios.patch(`${BASE_URL}/students/${STUDENT_ID}/activate`, {
      reactivationType: 'fresh'
    });
    
    console.log('Fresh Reactivation Response:', JSON.stringify(response.data, null, 2));
    console.log('✅ Fresh reactivation test passed');
  } catch (error) {
    console.error('❌ Fresh reactivation test failed:', error.response?.data || error.message);
  }
}

// Test invalid reactivation type
async function testInvalidReactivationType() {
  try {
    console.log('\nTesting Invalid Reactivation Type...');
    
    const response = await axios.patch(`${BASE_URL}/students/${STUDENT_ID}/activate`, {
      reactivationType: 'invalid'
    });
    
    console.log('This should not succeed');
  } catch (error) {
    console.log('Expected error for invalid type:', error.response?.data?.error);
    console.log('✅ Invalid type validation test passed');
  }
}

// Run all tests
async function runTests() {
  console.log('Student Reactivation API Tests\n');
  console.log('=' + '='.repeat(40) + '\n');
  
  await testResumeReactivation();
  await testFreshReactivation();
  await testInvalidReactivationType();
  
  console.log('\n' + '=' + '='.repeat(40));
  console.log('Tests completed!');
}

// Execute tests if this file is run directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testResumeReactivation,
  testFreshReactivation,
  testInvalidReactivationType,
  runTests
};