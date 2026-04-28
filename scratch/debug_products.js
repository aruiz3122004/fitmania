const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function debugProducts() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const getEnv = (k) => (env.match(new RegExp(`${k}="([^"]+)"`)) || [])[1];
  
  const privateKeyB64 = getEnv('FIREBASE_PRIVATE_KEY_B64');
  const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
      clientEmail: getEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: privateKey,
    }),
  });

  const db = admin.firestore();
  const ids = ['creatina', 'tostadas'];
  
  for (const id of ids) {
    const doc = await db.collection('products').doc(id).get();
    if (doc.exists) {
      console.log(`✅ ENCONTRADO: "${id}" | Nombre: ${doc.data().nombre} | Precio: ${doc.data().precio}`);
    } else {
      console.log(`❌ NO ENCONTRADO: "${id}"`);
    }
  }
}

debugProducts();
