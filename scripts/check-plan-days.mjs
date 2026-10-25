// F1-17: verifica que todos los planes de `planes` tengan `days` válido.
// Si falta, el checkout cobra el plan y le da 30 días (lib/payments/pricing.ts).
// Solo lectura: no modifica nada. Uso: node scripts/check-plan-days.mjs
import env from '@next/env'

const { loadEnvConfig } = env
loadEnvConfig(process.cwd())

const admin = (await import('firebase-admin')).default

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '')
        .replace(/^"|"$/g, '')
        .replace(/\\n/g, '\n'),
    }),
  })
}

const snap = await admin.firestore().collection('planes').get()
let missing = 0
snap.forEach((d) => {
  const p = d.data()
  const days = Number(p.days)
  const ok = Number.isInteger(days) && days > 0
  if (!ok) missing++
  console.log(`${ok ? 'OK   ' : 'FALTA'} ${d.id}: name=${JSON.stringify(p.name)} price=${JSON.stringify(p.price)} days=${JSON.stringify(p.days)}`)
})
console.log(`\n${snap.size} planes, ${missing} sin days válido${missing ? ' → edítalos en el panel (pestaña Planes) antes de vender.' : '.'}`)
process.exit(missing ? 1 : 0)
