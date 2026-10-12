import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'

export async function GET() {
  try {
    const db = getAdminFirestore()
    // Filtramos por stock en Firestore (índice de un solo campo, no requiere
    // índice compuesto) y ordenamos en memoria para evitar el error
    // FAILED_PRECONDITION "The query requires an index".
    const snap = await db.collection('products').where('stock', '>', 0).get()
    const products = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Record<string, any>))
      .sort((a, b) => {
        const stockDiff = (b.stock ?? 0) - (a.stock ?? 0)
        if (stockDiff !== 0) return stockDiff
        const at = a.created_at?.toMillis?.() ?? a.created_at?.seconds ?? 0
        const bt = b.created_at?.toMillis?.() ?? b.created_at?.seconds ?? 0
        return bt - at
      })
    return NextResponse.json(products, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}