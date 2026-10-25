/**
 * 🔑 Bootstrap de ADMINISTRADOR para FITMANIA.
 *
 * Asigna el custom claim `admin:true` a un usuario de Firebase Auth.
 * Sin este claim, /api/admin/login rechaza cualquier inicio de sesión
 * (la app no tiene forma de otorgar el PRIMER admin desde la UI).
 *
 * Uso (desde la carpeta del proyecto, la que tiene package.json):
 *   node scripts/grant-admin.js <email>
 *   node scripts/grant-admin.js <uid>
 *
 * Lee las credenciales de Firebase Admin desde .env.local
 * (FIREBASE_PRIVATE_KEY[_B64], FIREBASE_CLIENT_EMAIL, NEXT_PUBLIC_FIREBASE_PROJECT_ID).
 * El usuario debe cerrar sesión y volver a entrar para recibir el claim.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('No se encontró .env.local en la raíz del proyecto.');
  process.exit(1);
}
const env = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const quoted = env.match(new RegExp(`${key}="([^"]*)"`));
  if (quoted) return quoted[1];
  const plain = env.match(new RegExp(`${key}=([^\\r\\n]+)`));
  return plain ? plain[1].trim() : null;
}

const target = process.argv[2];
if (!target) {
  console.error('Uso: node scripts/grant-admin.js <email|uid>');
  process.exit(1);
}

if (!admin.apps.length) {
  const b64 = getEnv('FIREBASE_PRIVATE_KEY_B64');
  const raw = getEnv('FIREBASE_PRIVATE_KEY');
  const privateKey = b64
    ? Buffer.from(b64, 'base64').toString('utf8')
    : raw
      ? raw.replace(/\\n/g, '\n')
      : '';

  if (!privateKey || !getEnv('FIREBASE_CLIENT_EMAIL')) {
    console.error('Faltan FIREBASE_PRIVATE_KEY(_B64) o FIREBASE_CLIENT_EMAIL en .env.local');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID') || getEnv('FIREBASE_PROJECT_ID'),
      clientEmail: getEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey,
    }),
  });
}

(async () => {
  try {
    const auth = admin.auth();
    const isEmail = target.includes('@');
    const user = isEmail ? await auth.getUserByEmail(target) : await auth.getUser(target);
    // Fusionar con los claims actuales para no borrar otros roles (p. ej. receptionist).
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
    console.log(`✅ Claim admin:true asignado a: ${user.email} (${user.uid})`);
    console.log(`ℹ️  Para que surta efecto, el usuario debe volver a iniciar sesión (o el token debe refrescarse).`);
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    console.error('Si el usuario no existe, créalo primero en Firestore/Auth (registro normal).');
    process.exit(1);
  }
})();