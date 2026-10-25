// Limpieza de datos de prueba antes de la salida a producción.
//
//   node scripts/clean-test-data.mjs                       → solo muestra qué borraría (no toca nada)
//   node scripts/clean-test-data.mjs --scope=prelaunch     → muestra el reinicio completo previo a la salida
//   node scripts/clean-test-data.mjs [--scope=...] --apply --project=<id>
//
// Alcances:
//   fake      (por defecto) órdenes simuladas por scripts: sim_*, pi_mock_*, pi_lowstock_*
//   prelaunch todo lo transaccional generado en desarrollo (órdenes, pagos, ingresos, estadísticas,
//             notificaciones, correos, movimientos de inventario, cierres de caja, reportes del foro).
//             Conserva usuarios, planes, productos, noticias, posts, PQRS, consentimientos y auditoría.
//
// --project debe coincidir con FIREBASE_PROJECT_ID de .env.local: evita borrar el proyecto equivocado.
// Las cuentas de usuario de prueba se borran desde el panel admin (para que pase por account-deletion).
import env from '@next/env'

env.loadEnvConfig(process.cwd())
const admin = (await import('firebase-admin')).default

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)
const scope = args.scope || 'fake'
const apply = args.apply === true
const projectId = process.env.FIREBASE_PROJECT_ID

if (!['fake', 'prelaunch'].includes(scope)) {
  console.error(`Alcance desconocido: ${scope}. Usa fake o prelaunch.`)
  process.exit(1)
}
if (apply && args.project !== projectId) {
  console.error(`Para borrar, pasa --project=${projectId} (el proyecto de .env.local).`)
  process.exit(1)
}

const rawKey = process.env.FIREBASE_PRIVATE_KEY_B64
  ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, 'base64').toString('utf8')
  : process.env.FIREBASE_PRIVATE_KEY || ''
admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
  }),
})
const db = admin.firestore()

const FAKE_ORDER = /^(sim_|pi_mock_|pi_lowstock_)/
const PRELAUNCH_COLLECTIONS = [
  'orders',
  'payments',
  'payment_events',
  'entry_logs',
  'checkIns',
  'daily_stats',
  'monthly_stats',
  'notifications',
  'email_events',
  'inventory_movements',
  'inventory_counts',
  'cash_closures',
  'reportes',
]

const targets = []
if (scope === 'fake') {
  const orders = await db.collection('orders').get()
  for (const d of orders.docs) if (FAKE_ORDER.test(d.id)) targets.push({ label: `orders/${d.id}`, ref: d.ref })
} else {
  for (const name of PRELAUNCH_COLLECTIONS) {
    const n = (await db.collection(name).count().get()).data().count
    if (n) targets.push({ label: `${name} (${n} documentos)`, ref: db.collection(name) })
  }
}

console.log(`Proyecto: ${projectId} · alcance: ${scope} · ${apply ? 'BORRANDO' : 'simulación (no borra nada)'}`)
if (!targets.length) {
  console.log('No hay nada que borrar.')
  process.exit(0)
}
for (const t of targets) console.log(`  - ${t.label}`)

if (!apply) {
  console.log(`\nPara borrar: node scripts/clean-test-data.mjs --scope=${scope} --apply --project=${projectId}`)
  process.exit(0)
}

for (const t of targets) await db.recursiveDelete(t.ref)
console.log(`\nListo: ${targets.length} elemento(s) borrados.`)
if (scope === 'prelaunch') {
  console.log('Revisa el stock de productos en el panel admin: las ventas de prueba lo descontaron.')
}
process.exit(0)
