/**
 * 🔑 Gestión de CLAIMS (roles) de FITMANIA.
 *
 * Asigna o retira los custom claims `admin` y `receptionist` de un usuario de
 * Firebase Auth. Implementa T-16 (auditoría A-5): los roles se gestionan de
 * forma centralizada y revocable, NO se auto-otorgan en el login.
 *
 * Uso (desde la carpeta del proyecto, la que tiene package.json):
 *   node scripts/manage-claims.js <email|uid> admin on
 *   node scripts/manage-claims.js <email|uid> admin off
 *   node scripts/manage-claims.js <email|uid> receptionist on
 *   node scripts/manage-claims.js <email|uid> receptionist off
 *
 * Al retirar un rol (`off`) se revocan los refresh tokens del usuario, de modo
 * que las sesiones vigentes (`verifySessionCookie(..., true)`) se invalidan de
 * inmediato.
 *
 * Lee las credenciales de Firebase Admin desde .env.local
 * (FIREBASE_PRIVATE_KEY[_B64], FIREBASE_CLIENT_EMAIL, NEXT_PUBLIC_FIREBASE_PROJECT_ID).
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
const role = process.argv[3];
const action = process.argv[4];

const VALID_ROLES = ['admin', 'receptionist'];

if (!target || !role || !action) {
  console.error('Uso: node scripts/manage-claims.js <email|uid> <admin|receptionist> <on|off>');
  process.exit(1);
}
if (!VALID_ROLES.includes(role)) {
  console.error(`Rol inválido: "${role}". Usa: ${VALID_ROLES.join(' | ')}`);
  process.exit(1);
}
if (action !== 'on' && action !== 'off') {
  console.error(`Acción inválida: "${action}". Usa: on | off`);
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

    // Fusionar con los claims actuales para no borrar el otro rol.
    const currentClaims = user.customClaims || {};
    const claims = { ...currentClaims };

    if (action === 'on') {
      claims[role] = true;
    } else {
      delete claims[role];
    }

    await auth.setCustomUserClaims(user.uid, claims);

    if (action === 'off') {
      await auth.revokeRefreshTokens(user.uid);
      console.log(`🔒 Refresh tokens revocados (sesiones vigentes invalidadas).`);
    }

    console.log(`✅ Claim ${role} = ${action === 'on' ? 'true' : 'false'} para: ${user.email} (${user.uid})`);
    console.log(`   Claims resultantes: ${JSON.stringify(claims)}`);
    console.log(`ℹ️  El usuario debe iniciar sesión de nuevo para que el claim surta efecto.`);
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    console.error('Si el usuario no existe, créalo primero en Firestore/Auth (registro normal).');
    process.exit(1);
  }
})();
