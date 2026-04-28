const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function listProducts() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const getEnv = (k) => (env.match(new RegExp(`${k}="([^"]+)"`)) || [])[1];
  
  const privateKeyB64 = getEnv('FIREBASE_PRIVATE_KEY_B64');
  const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
        clientEmail: getEnv('FIREBASE_CLIENT_EMAIL'),
        privateKey: privateKey,
      }),
    });
  }

  const db = admin.firestore();
  const snapshot = await db.collection('products').get();
  
  console.log('--- PRODUCTOS EN FIREBASE ---');
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Nombre: ${data.nombre} | Precio: ${data.precio}`);
  });
}

listProducts();
