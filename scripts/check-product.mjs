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
const ids = process.argv.slice(2)
if (ids.length === 0) {
  const snap = await db.collection('products').limit(10).get()
  snap.forEach((d) => {
    const p = d.data()
    console.log(`${d.id}: precio=${JSON.stringify(p.precio)} price=${JSON.stringify(p.price)} stock=${JSON.stringify(p.stock)}`)
  })
} else {
  for (const id of ids) {
    const d = await db.collection('products').doc(id).get()
    if (!d.exists) {
      console.log(`${id}: NO EXISTE`)
    } else {
      const p = d.data()
      console.log(`${id}: precio=${JSON.stringify(p.precio)} price=${JSON.stringify(p.price)} stock=${JSON.stringify(p.stock)} nombre=${JSON.stringify(p.nombre)}`)
    }
  }
}
