const fs = require('fs');
const path = require('path');

async function simulateLogin() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = fs.readFileSync(envPath, 'utf8');

  const getEnv = (key) => {
    const match = env.match(new RegExp(`${key}="([^"]+)"`));
    return match ? match[1] : null;
  };

  const firebaseConfig = {
    apiKey: getEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: getEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  };

  console.log('Firebase Config loaded for:', firebaseConfig.projectId);

  // Email and Password provided by the user
  const email = "andreselgameroscuro@gmail.com";
  const password = "pipurro0607";

  try {
    // 1. Authenticate with Firebase Auth REST API (simulating client-side sign-in)
    console.log('Attempting Firebase Auth sign-in for:', email);
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const authData = await authRes.json();
    if (authData.error) {
      console.error('Firebase Auth Error:', authData.error.message);
      return;
    }

    const idToken = authData.idToken;
    console.log('Firebase Auth Success. ID Token obtained.');

    // 2. Call local Admin Login API
    console.log('Calling local /api/admin/login...');
    const loginRes = await fetch('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    const loginData = await loginRes.json();
    console.log('Server Status:', loginRes.status);
    console.log('Server Response:', JSON.stringify(loginData, null, 2));
    
    if (loginRes.ok) {
      console.log('LOGIN SUCCESSFUL!');
      const cookies = loginRes.headers.get('set-cookie');
      console.log('Session Cookie set:', cookies ? 'YES' : 'NO');
    } else {
      console.error('LOGIN FAILED at server level.');
    }

  } catch (error) {
    console.error('Simulation Error:', error);
  }
}

simulateLogin();
