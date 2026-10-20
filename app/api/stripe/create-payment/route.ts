import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia' as any,
})

export async function POST(req: NextRequest) {
  try {
    // F1-18 (parcial): el pago exige sesión. uid y correo salen del ID token verificado,
    // nunca del body (antes se podían enviar recibos a direcciones arbitrarias).
    const authHeader = req.headers.get('authorization')
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!idToken) {
      return NextResponse.json({ error: 'Debes iniciar sesión para pagar.' }, { status: 401 })
    }
    let decoded
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken)
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' }, { status: 401 })
    }
    if (!decoded.email) {
      return NextResponse.json({ error: 'Tu cuenta no tiene un correo asociado.' }, { status: 400 })
    }
    // F1-06: solo cuentas con correo verificado pueden pagar (recibos y facturas van a ese correo).
    if (!decoded.email_verified) {
      return NextResponse.json(
        { error: 'Verifica tu correo antes de pagar. Revisa tu bandeja o reenvía el enlace desde tu perfil.', code: 'email_not_verified' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { planId, items } = body
    const uid = decoded.uid
    const customerEmail = decoded.email

    let amount = 0
    let concept = ''
    const db = getAdminFirestore()

    const userSnap = await db.collection('users').doc(uid).get()
    const customerName = String(userSnap.data()?.username || decoded.name || customerEmail.split('@')[0]).slice(0, 100)

    // 1. Lógica para PLANES
    if (planId) {
      const planDoc = await db.collection('planes').doc(planId).get()
      if (!planDoc.exists) {
        return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
      }
      const planData = planDoc.data()
      amount = planData?.price || 0
      concept = planData?.name || 'Plan Fitmania'
    } 
    // 2. Lógica para PRODUCTOS (Carrito) — el precio lo decide SIEMPRE el servidor (T-07, auditoría C-5)
    else if (items && Array.isArray(items)) {
      let total = 0

      for (const item of items) {
        const cleanId = String(item.id).trim().toLowerCase()
        const cantidad = Number(item.cantidad)

        // Validar cantidad: entero >= 1 con tope razonable
        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
          return NextResponse.json({ error: 'Cantidad de producto no válida.' }, { status: 400 })
        }

        const productDoc = await db.collection('products').doc(cleanId).get()
        if (!productDoc.exists) {
          return NextResponse.json({ error: `Producto no encontrado: ${cleanId}` }, { status: 400 })
        }

        const productData = productDoc.data()
        // Los productos guardan el precio en `precio` (español); se admite `price`
        // como respaldo por si algún documento antiguo usó el campo en inglés.
        const rawPrice = productData?.precio ?? productData?.price
        const price = Number(rawPrice) || 0
        const stock = Number(productData?.stock) ?? 0

        if (price <= 0) {
          return NextResponse.json({ error: `Precio de producto no válido: ${cleanId}` }, { status: 400 })
        }
        if (stock < cantidad) {
          return NextResponse.json({ error: `Stock insuficiente para: ${productData?.nombre || cleanId}` }, { status: 400 })
        }

        total += price * cantidad
      }

      amount = total
      concept = 'Compra de productos - Fitmania Shop'
    } else {
      // Sin plan ni productos verificables: rechazar (el cliente nunca define montos)
      return NextResponse.json({ error: 'Solicitud de pago sin plan ni productos válidos.' }, { status: 400 })
    }

    if (amount <= 0) {
       return NextResponse.json({ error: 'Monto de pago no válido' }, { status: 400 })
    }

    // Preparar metadatos
    const metadata: any = {
      customerName,
      customerEmail,
      concept,
      uid,
      // B3: el webhook decide por el TIPO y el planId, no por el texto del concepto.
      type: planId ? 'plan' : 'products',
    }

    if (planId) metadata.planId = planId
    // Solo compras de productos llevan ítems: antes un pago de plan con carrito lleno
    // hacía que el webhook descontara stock de productos que no se cobraron.
    if (!planId && items) {
      const itemsSummary = items.map((it: any) => `${String(it.id).trim().toLowerCase()}:${Number(it.cantidad)}`).join(',')
      metadata.items = itemsSummary.substring(0, 500)
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'cop',
      payment_method_types: ['card'],
      description: concept,
      receipt_email: customerEmail,
      metadata
    })

    return NextResponse.json({ clientSecret: paymentIntent.client_secret })
  } catch (error: any) {
    console.error('Error creando PaymentIntent:', error)
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Intenta de nuevo.' }, { status: 500 })
  }
}