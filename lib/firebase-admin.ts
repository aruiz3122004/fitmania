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

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan credenciales de Firebase Admin en .env.local');
  }

  // Limpiar la llave: remover comillas si existen y procesar saltos de línea
  // Esto soluciona el error "Invalid PEM formatted message"
  privateKey = privateKey
    .trim()
    .replace(/^["']|["']$/g, '') // Elimina comillas al inicio y al final
    .replace(/\\n/g, '\n');       // Convierte \n literales en saltos de línea reales

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
