// Simple test to check backend is working
const http = require('http');

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
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

async function quickTest() {
  try {
    console.log('Testing login...');
    const loginResult = await makeRequest('/api/auth/login', 'POST', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('Login status:', loginResult.status);
    
    if (loginResult.status === 200 && loginResult.data.token) {
      const token = loginResult.data.token;
      console.log('Got token, testing seats endpoint...');
      
      const seatsResult = await makeRequest('/api/seats', 'GET', null, {
        'Authorization': `Bearer ${token}`
      });
      
      console.log('Seats status:', seatsResult.status);
      if (seatsResult.status === 200) {
        console.log('First 5 seat numbers:', seatsResult.data.slice(0, 5).map(s => s.seatNumber));
      } else {
        console.log('Seats error:', seatsResult.data);
      }
    } else {
      console.log('Login failed:', loginResult.data);
    }
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

quickTest();
