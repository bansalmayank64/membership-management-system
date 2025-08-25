const fetch = require('node-fetch');

async function testLogin() {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      }),
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);

    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('Token received:', !!data.token);
      console.log('User data:', data.user);
    } else {
      console.log('❌ Login failed:', data.error);
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testLogin();
