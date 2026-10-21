import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

/** App de Firebase del cliente (la usa Cloud Messaging para las notificaciones push). */
export const firebaseApp = app

// F1-11: App Check con reCAPTCHA Enterprise. Solo se activa si existe la clave del
// sitio; después se exige ("enforce") en la consola de Firebase para Firestore y Auth,
// así solo esta app (no scripts externos con la API key pública) puede usarlos.
const APP_CHECK_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY
if (typeof window !== 'undefined' && APP_CHECK_SITE_KEY) {
  import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      })
    })
    .catch((err) => console.error('No se pudo iniciar App Check:', err))
}

export const auth = getAuth(app)
export const db = getFirestore(app)