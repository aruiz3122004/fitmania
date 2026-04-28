const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function testFirestore() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = fs.readFileSync(envPath, 'utf8');
  
  const getEnv = (key) => {
    const match = env.match(new RegExp(`${key}="([^"]+)"`));
    return match ? match[1] : process.env[key];
  };

  const projectId = getEnv('FIREBASE_PROJECT_ID');
  const clientEmail = getEnv('FIREBASE_CLIENT_EMAIL');
  const b64Key = getEnv('FIREBASE_PRIVATE_KEY_B64');

  if (!projectId || !clientEmail || !b64Key) {
    console.error('Missing env vars');
    return;
  }

  const privateKey = Buffer.from(b64Key, 'base64').toString('utf8');

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    const db = admin.firestore();
    console.log('Testing Firestore access...');
    const collections = await db.listCollections();
    console.log('Collections found:', collections.map(c => c.id));
    
    // Try to write to audit_logs
    console.log('Trying to write to audit_logs...');
    await db.collection('audit_logs').add({
      action: 'TEST_PERMISSIONS',
      category: 'DEBUG',
      details: 'Testing if Admin SDK has permissions',
      timestamp: new Date()
    });
    console.log('Successfully wrote to audit_logs');

  } catch (error) {
    console.error('Firestore Error:', error);
  }
}

testFirestore();
