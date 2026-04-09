import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { 
  sendPaymentSuccessEmail, 
  sendPaymentFailedEmail, 
  sendOrderReceiptEmail 
} from '@/services/mail'
import { getAdminFirestore } from '@/lib/firebase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

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
  const db = getAdminFirestore()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const meta = paymentIntent.metadata
      const dateStr = new Date(paymentIntent.created * 1000).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      const bancoNombre = BANCOS_PSE.find((b) => b.codigo === meta.bank)?.nombre || meta.bank || 'Tarjeta/Otro'

      // --- PROCESAMIENTO DE ITEMS (PRODUCTOS) ---
      if (meta.items) {
        try {
          const itemEntries = meta.items.split(',') // Formato "id:qty,id:qty"
          const itemsToProcess: { id: string; nombre: string; precio: number; cantidad: number }[] = []

          // Obtener detalles de productos desde Firestore para el recibo y para el stock
          for (const entry of itemEntries) {
            const [id, qty] = entry.split(':')
            const productDoc = await db.collection('products').doc(id).get()
            if (productDoc.exists) {
              const pData = productDoc.data()!
              itemsToProcess.push({
                id,
                nombre: pData.nombre,
                precio: pData.precio,
                cantidad: parseInt(qty)
              })
            }
          }

          // Ejecutar transacción para actualizar stock y crear orden
          await db.runTransaction(async (transaction) => {
            for (const item of itemsToProcess) {
              const productRef = db.collection('products').doc(item.id)
              const pSnap = await transaction.get(productRef)
              if (pSnap.exists) {
                const currentStock = pSnap.data()?.stock || 0
                const newStock = Math.max(0, currentStock - item.cantidad)
                transaction.update(productRef, { stock: newStock })

                // Notificar si el stock es bajo (< 5)
                if (newStock < 5) {
                  const notifRef = db.collection('notifications').doc()
                  transaction.set(notifRef, {
                    tipo: 'low_stock',
                    mensaje: `¡Alerta! El producto ${item.nombre} tiene stock crítico: ${newStock} unidades.`,
                    id_producto: item.id,
                    leido: false,
                    fecha: new Date()
                  })
                }
              }
            }

            // Crear el documento de la orden
            const orderRef = db.collection('orders').doc(paymentIntent.id)
            transaction.set(orderRef, {
              uid: meta.uid || 'anonimo',
              customerName: meta.customerName,
              customerEmail: meta.customerEmail,
              items: itemsToProcess,
              total: paymentIntent.amount / 100,
              banco: bancoNombre,
              fecha: new Date(),
              status: 'paid'
            })

            // Notificación de compra
            const buyNotifRef = db.collection('notifications').doc()
            transaction.set(buyNotifRef, {
              tipo: 'purchase',
              mensaje: `${meta.customerName} ha realizado una compra por ${new Intl.NumberFormat('es-CO', {style:'currency', currency:'COP'}).format(paymentIntent.amount/100)}`,
              id_orden: paymentIntent.id,
              leido: false,
              fecha: new Date()
            })
          })

          // Enviar recibo detallado
          await sendOrderReceiptEmail({
            to: meta.customerEmail,
            customerName: meta.customerName,
            items: itemsToProcess,
            total: paymentIntent.amount / 100,
            bank: bancoNombre,
            date: dateStr,
            transactionId: paymentIntent.id
          })

        } catch (error) {
          console.error('Error procesando productos en webhook:', error)
        }
      }

      // --- PROCESAMIENTO DE PLANES ---
      if (meta.uid && (meta.concept?.toLowerCase().includes('plan') || meta.concept?.toLowerCase().includes('mensualidad'))) {
        let dias = 30
        const concepto = meta.concept.toLowerCase()
        if (concepto.includes('parejas')) dias = 40
        else if (concepto.includes('dos en uno')) dias = 60

        const ahora = new Date()
        const expira = new Date()
        expira.setDate(ahora.getDate() + dias)

        try {
          await db.collection('users').doc(meta.uid).update({
            plan: {
              nombre: meta.concept,
              precio: paymentIntent.amount / 100,
              dias_total: dias,
              inicio: ahora,
              expira: expira
            }
          })
          
          await sendPaymentSuccessEmail({
            to: meta.customerEmail,
            customerName: meta.customerName,
            amount: paymentIntent.amount / 100,
            concept: meta.concept,
            bank: bancoNombre,
            date: dateStr,
            transactionId: paymentIntent.id,
          })

          console.log(`Plan activado para ${meta.uid}`)
        } catch (dbErr: any) {
          console.error('Error actualizando plan en Firestore:', dbErr.message)
        }
      }
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
      break
  }

  return NextResponse.json({ received: true })
}