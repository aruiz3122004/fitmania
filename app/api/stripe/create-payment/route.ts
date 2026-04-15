import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminFirestore } from '@/lib/firebase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
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
      const validatedItems = []

      for (const item of items) {
        const productDoc = await db.collection('products').doc(item.id).get()
        if (productDoc.exists) {
          const productData = productDoc.data()
          const itemPrice = productData?.price || 0
          total += itemPrice * (item.cantidad || 1)
          validatedItems.push(`${item.id}:${item.cantidad}`)
        }
      }

      if (total === 0) {
        return NextResponse.json({ error: 'No se encontraron productos válidos' }, { status: 400 })
      }

      amount = total
      concept = 'Compra de productos - Fitmania Shop'
    } else {
      return NextResponse.json({ error: 'Datos de pago incompletos' }, { status: 400 })
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