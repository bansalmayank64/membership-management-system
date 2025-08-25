// Test script to check if the student API endpoints are working
const http = require('http');

const API_BASE = 'http://localhost:3001/api';

// Test function to make HTTP requests
function makeRequest(url, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testStudentAPI() {
  console.log('🧑‍🎓 Testing Student API...\n');

  // Test 1: Login to get token
  console.log('1. Logging in to get authentication token:');
  let token = null;
  try {
    const result = await makeRequest(`${API_BASE}/auth/login`, 'POST', {
      username: 'admin',
      password: 'admin123'
    });
    console.log(`   Status: ${result.status}`);
    
    if (result.status === 200 && result.data.token) {
      token = result.data.token;
      console.log('   ✅ PASS - Successfully authenticated');
      console.log(`   Token: ${token.substring(0, 20)}...\n`);
    } else {
      console.log(`   Response: ${JSON.stringify(result.data)}`);
      console.log('   ❌ FAIL - Could not authenticate\n');
      return;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
    return;
  }

  // Test 2: Check GET /api/students endpoint
  console.log('2. Testing GET /api/students:');
  try {
    const result = await makeRequest(`${API_BASE}/students`, 'GET', null, {
      'Authorization': `Bearer ${token}`
    });
    console.log(`   Status: ${result.status}`);
    
    if (result.status === 200) {
      console.log('   ✅ PASS - GET students endpoint working');
      console.log(`   Students found: ${Array.isArray(result.data) ? result.data.length : 'N/A'}\n`);
    } else {
      console.log(`   Response: ${JSON.stringify(result.data)}`);
      console.log('   ❌ FAIL - GET students endpoint failed\n');
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  // Test 3: Test POST /api/students endpoint
  console.log('3. Testing POST /api/students (creating a test student):');
  try {
    const testStudent = {
      name: 'Test Student',
      father_name: 'Test Father',
      contact_number: '1234567890',
      sex: 'male',
      seat_number: '1',
      membership_till: '2025-12-31',
      modified_by: 1
    };

    const result = await makeRequest(`${API_BASE}/students`, 'POST', testStudent, {
      'Authorization': `Bearer ${token}`
    });
    
    console.log(`   Status: ${result.status}`);
    
    if (result.status === 201) {
      console.log('   ✅ PASS - POST students endpoint working');
      console.log(`   Created student: ${result.data.name} (ID: ${result.data.id})\n`);
    } else {
      console.log(`   Response: ${JSON.stringify(result.data)}`);
      console.log('   ❌ FAIL - POST students endpoint failed\n');
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}\n`);
  }

  console.log('🏁 Student API test completed!');
}

// Run the test
testStudentAPI().catch(console.error);
