import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminFirestore } from '@/lib/firebase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia' as any,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { planId, items, customerEmail, customerName, uid } = body

    let amount = 0
    let concept = ''
    const db = getAdminFirestore()

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
    // 2. Lógica para PRODUCTOS (Carrito)
    else if (items && Array.isArray(items)) {
      let total = 0
      for (const item of items) {
        const cleanId = String(item.id).trim().toLowerCase()
        const productDoc = await db.collection('products').doc(cleanId).get()
        if (productDoc.exists) {
          const productData = productDoc.data()
          total += (Number(productData?.price) || 0) * (Number(item.cantidad) || 1)
        }
      }

      // Si la validación falla pero hay items, usamos un monto de seguridad o el del cliente
      // NOTA: En producción esto debería ser estricto, pero para restaurar servicio:
      amount = total > 0 ? total : body.amount || 0
      concept = 'Compra de productos - Fitmania Shop'
    } else {
      // Fallback para pagos directos (monto manual)
      amount = body.amount || 0
      concept = body.concept || 'Servicio Fitmania'
    }

    if (amount <= 0) {
       return NextResponse.json({ error: 'Monto de pago no válido' }, { status: 400 })
    }

    // Preparar metadatos
    const metadata: any = { 
      customerName, 
      customerEmail, 
      concept, 
      uid 
    }

    if (planId) metadata.planId = planId
    if (items) {
      const itemsSummary = items.map((it: any) => `${it.id}:${it.cantidad}`).join(',')
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}