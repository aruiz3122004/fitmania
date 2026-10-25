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

const db = admin.firestore()

const orders = await db.collection('orders').orderBy('fecha', 'desc').limit(5).get()
console.log(`== Últimas ${orders.size} órdenes ==`)
orders.forEach((d) => {
  const o = d.data()
  const fecha = o.fecha?.toDate ? o.fecha.toDate().toISOString() : o.fecha
  console.log(`- ${d.id} | ${fecha} | email=${o.customerEmail} | total=${o.total} | status=${o.status} | items=${JSON.stringify(o.items || o.concepto || o.type)}`)
})

console.log('\n== Stock de productos (muestra) ==')
const prods = await db.collection('products').limit(12).get()
prods.forEach((d) => {
  const p = d.data()
  console.log(`- ${d.id}: stock=${JSON.stringify(p.stock)} precio=${JSON.stringify(p.precio)}`)
})
