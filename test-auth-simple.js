const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testAuth() {
  try {
    console.log('Testing backend health...');
    const healthOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET'
    };
    const healthResult = await makeRequest(healthOptions);
    console.log('✅ Health check:', healthResult);

    console.log('\nTesting database connection...');
    const dbOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/db-test',
      method: 'GET'
    };
    const dbResult = await makeRequest(dbOptions);
    console.log('✅ Database test:', dbResult);

    console.log('\nTesting login with admin credentials...');
    const loginOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const loginData = JSON.stringify({
      username: 'admin',
      password: 'admin123'
    });

    const loginResult = await makeRequest(loginOptions, loginData);
    console.log('✅ Login response:', loginResult);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

testAuth();
