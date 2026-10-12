import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'

export async function GET() {
  try {
    const db = getAdminFirestore()
    const snap = await db.collection('products').where('stock', '>', 0).orderBy('stock', 'desc').orderBy('created_at', 'desc').get()
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return NextResponse.json(products, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}