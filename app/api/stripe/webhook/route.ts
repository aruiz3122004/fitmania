import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { sendPaymentSuccessEmail, sendPaymentFailedEmail } from '@/services/mail'
 
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})
 
// IMPORTANTE: Esta ruta necesita el body crudo (raw), no parseado
export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!
 
  let event: Stripe.Event
 
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature inválida:', err.message)
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
  }
 
  const paymentIntent = event.data.object as Stripe.PaymentIntent
 
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const meta = paymentIntent.metadata
      const date = new Date(paymentIntent.created * 1000).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
 
      // Nombre del banco según el código guardado en metadata
      const bancoNombre = BANCOS_PSE.find((b) => b.codigo === meta.bank)?.nombre || meta.bank
 
      await sendPaymentSuccessEmail({
        to: meta.customerEmail,
        customerName: meta.customerName,
        amount: paymentIntent.amount,
        concept: meta.concept,
        bank: bancoNombre,
        date,
        transactionId: paymentIntent.id,
      })
      break
    }
 
    case 'payment_intent.payment_failed': {
      const meta = paymentIntent.metadata
      if (meta.customerEmail) {
        await sendPaymentFailedEmail({
          to: meta.customerEmail,
          customerName: meta.customerName,
        })
      }
      break
    }
 
    default:
      // Ignorar otros eventos
      break
  }
 
  return NextResponse.json({ received: true })
}
 
// Lista de bancos PSE Colombia (misma que en el frontend)
const BANCOS_PSE = [
  { codigo: '1007', nombre: 'Bancolombia' },
  { codigo: '1051', nombre: 'Davivienda' },
  { codigo: '1013', nombre: 'BBVA Colombia' },
  { codigo: '1006', nombre: 'Banco de Bogotá' },
  { codigo: '1002', nombre: 'Banco Popular' },
  { codigo: '1032', nombre: 'Banco Caja Social' },
  { codigo: '1019', nombre: 'Scotiabank Colpatria' },
  { codigo: '1023', nombre: 'Banco de Occidente' },
  { codigo: '1040', nombre: 'Banco Agrario' },
  { codigo: '1009', nombre: 'Citibank Colombia' },
  { codigo: '1062', nombre: 'Banco Falabella' },
  { codigo: '1069', nombre: 'Banco Finandina' },
  { codigo: '1058', nombre: 'Banco Procredit' },
  { codigo: '1060', nombre: 'Banco Pichincha' },
  { codigo: '1303', nombre: 'Nequi' },
]