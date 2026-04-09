import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, concept, customerEmail, customerName, uid, items } = body

    // Preparar metadatos. Si hay items, los serializamos.
    // Stripe metadata tiene un límite de 500 caracteres por valor.
    const metadata: any = { 
      customerName, 
      customerEmail, 
      concept, 
      uid 
    }

    if (items && Array.isArray(items)) {
      // Guardamos un resumen simple de los items (id y cantidad)
      const itemsSummary = items.map((it: any) => `${it.id}:${it.cantidad}`).join(',')
      metadata.items = itemsSummary.substring(0, 500) // Truncar si es excesivo, aunque raro en este caso
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