import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin'
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { priceCheckout, CheckoutError } from '@/lib/payments/pricing'

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
    // El ID token puede ser anterior a la verificación: ante un "no", se consulta el estado real.
    if (!decoded.email_verified && !(await getAdminAuth().getUser(decoded.uid)).emailVerified) {
      return NextResponse.json(
        { error: 'Verifica tu correo antes de pagar. Revisa tu bandeja o reenvía el enlace desde tu perfil.', code: 'email_not_verified' },
        { status: 403 }
      )
    }

    // F1-10: límite por usuario (10 intentos de pago cada 10 minutos).
    const rl = await limitAction(`pay:${decoded.uid}`, 10, 600)
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Demasiados intentos de pago. Espera unos minutos.')

    const body = await req.json()
    const { planId, items } = body
    const uid = decoded.uid
    const customerEmail = decoded.email
    const db = getAdminFirestore()

    const userSnap = await db.collection('users').doc(uid).get()
    const customerName = String(userSnap.data()?.username || decoded.name || customerEmail.split('@')[0]).slice(0, 100)

    // Precio calculado en el servidor (compartido con Mercado Pago).
    let snapshot
    try {
      snapshot = await priceCheckout(db, { planId, items })
    } catch (err) {
      if (err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status })
      throw err
    }
    const { amount, concept } = snapshot

    // Preparar metadatos
    const metadata: any = {
      customerName,
      customerEmail,
      concept,
      uid,
      // B3: el webhook decide por el TIPO y el planId, no por el texto del concepto.
      type: snapshot.type,
    }

    if (snapshot.planId) metadata.planId = snapshot.planId
    // Solo compras de productos llevan ítems: antes un pago de plan con carrito lleno
    // hacía que el webhook descontara stock de productos que no se cobraron.
    if (snapshot.type === 'products') {
      const itemsSummary = snapshot.items.map((it) => `${it.id}:${it.cantidad}`).join(',')
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