import * as admin from 'firebase-admin';

/**
 * Función centralizada para obtener la app administrativa de Firebase.
 * Implementa un patrón "Lazy" para evitar que el módulo se estrelle al importar si
 * las variables de entorno aún no están listas o tienen errores de formato.
 */
function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const b64Key = process.env.FIREBASE_PRIVATE_KEY_B64 || '';
  
  let privateKey = '';

  if (b64Key) {
    // MÉTODO 1: Base64 (El más robusto para Windows)
    try {
      privateKey = Buffer.from(b64Key, 'base64').toString('utf8');
    } catch (e) {
      console.error('Error al decodificar FIREBASE_PRIVATE_KEY_B64');
    }
  } 
  
  if (!privateKey && rawKey) {
    // MÉTODO 2: Texto plano (Fallback de compatibilidad)
    let cleanedKey = rawKey.trim();
    if (cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) {
      cleanedKey = cleanedKey.substring(1, cleanedKey.length - 1);
    } else if (cleanedKey.startsWith("'") && cleanedKey.endsWith("'")) {
      cleanedKey = cleanedKey.substring(1, cleanedKey.length - 1);
    }
    cleanedKey = cleanedKey.replace(/\\n/g, '\n');
    const pemLines = cleanedKey.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    privateKey = pemLines.join('\n');
  }

  // Asegurar cabeceras correctas
  if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan credenciales de Firebase Admin en .env.local');
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error) {
    console.error('Error crítico al inicializar Firebase Admin SDK:', error);
    throw error;
  }
}

// Exportamos funciones "getter" en lugar de constantes fijas para asegurar
// que la inicialización ocurra dentro del flujo de la petición (SSR/API).
export const getAdminAuth = () => getAdminApp().auth();
export const getAdminFirestore = () => getAdminApp().firestore();
