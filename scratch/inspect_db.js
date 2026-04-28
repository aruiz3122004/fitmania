const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function inspectDatabase() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = fs.readFileSync(envPath, 'utf8');

  const getEnv = (key) => {
    const match = env.match(new RegExp(`${key}="([^"]+)"`));
    return match ? match[1] : null;
  };

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

  try {
    const db = admin.firestore();
    const collections = await db.listCollections();
    
    console.log('--- ESTRUCTURA DE FIREBASE ---');
    if (collections.length === 0) {
      console.log('No se encontraron colecciones.');
    }

    for (const col of collections) {
      const snapshot = await col.limit(1).get();
      console.log(`Colección: [${col.id}] - Documentos: ${snapshot.size > 0 ? 'Existen datos' : 'Vacía'}`);
    }
    console.log('------------------------------');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

inspectDatabase();
