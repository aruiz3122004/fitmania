import { NextRequest, NextResponse, after } from 'next/server'
import Stripe from 'stripe'
import { 
  sendPaymentSuccessEmail, 
  sendPaymentFailedEmail, 
  sendOrderReceiptEmail 
} from '@/services/mail'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { formatInAppTz } from '@/lib/datetime'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

// Los correos se envían en segundo plano para responder rápido a Stripe (2xx).
// Sin esto, un envío lento supera el límite de la función serverless y se pierde.
export const maxDuration = 30

/** Ejecuta el envío de correo después de responder, registrando el fallo sin romper el webhook. */
function sendEmailInBackground(task: () => Promise<unknown>, context: string) {
  after(() =>
    task().catch((emailErr: any) => {
      console.error(
        `[webhook] No se pudo enviar el correo (${context}) tras los reintentos:`,
        emailErr?.message || emailErr
      )
    })
  )
}

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
      const dateStr = formatInAppTz(new Date(paymentIntent.created * 1000), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      const bancoNombre = BANCOS_PSE.find((b) => b.codigo === meta.bank)?.nombre || meta.bank || 'Tarjeta/Otro'

      // B4: si algo falla se responde 5xx para que Stripe REINTENTE el evento.
      // Antes el error se registraba y se respondía 200: la orden se perdía.
      let processingFailed = false

      // --- PROCESAMIENTO DE ITEMS (PRODUCTOS) — idempotente ---
      if (meta.items && meta.type !== 'plan') {
        try {
          const itemEntries = meta.items.split(',') // Formato "id:qty,id:qty"
          const orderRef = db.collection('orders').doc(paymentIntent.id)
          let itemsToProcess: { id: string; nombre: string; precio: number; cantidad: number }[] = []
          let alreadyProcessed = false

          // Firestore exige TODAS las lecturas antes de TODAS las escrituras.
          await db.runTransaction(async (transaction) => {
            // Idempotencia: si la orden ya existe, Stripe está reintentando un evento
            // ya procesado → no volver a descontar stock ni duplicar notificaciones.
            const orderSnap = await transaction.get(orderRef)
            if (orderSnap.exists) {
              alreadyProcessed = true
              return
            }

            const parsed = itemEntries
              .map((entry) => {
                const [id, qty] = entry.split(':')
                return { id: String(id).trim().toLowerCase(), cantidad: parseInt(qty, 10) }
              })
              .filter((it) => it.id && Number.isInteger(it.cantidad) && it.cantidad > 0)

            const productRefs = parsed.map((item) => db.collection('products').doc(item.id))
            const productSnaps: FirebaseFirestore.DocumentSnapshot[] = []
            for (const ref of productRefs) {
              productSnaps.push(await transaction.get(ref))
            }

            // Se reconstruye en cada intento (la transacción puede reintentarse).
            itemsToProcess = []
            for (let i = 0; i < parsed.length; i++) {
              const item = parsed[i]
              const pSnap = productSnaps[i]
              if (!pSnap.exists) continue
              const pData = pSnap.data()!
              itemsToProcess.push({
                id: item.id,
                nombre: pData.nombre,
                precio: Number(pData.precio ?? pData.price) || 0,
                cantidad: item.cantidad,
              })

              const currentStock = Number(pData.stock) || 0
              if (currentStock < item.cantidad) {
                // TODO(F1-20): reembolso automático cuando no alcanza el stock.
                transaction.set(db.collection('notifications').doc(), {
                  tipo: 'oversell',
                  mensaje: `¡Revisar! Se vendieron ${item.cantidad} de ${pData.nombre} con solo ${currentStock} en stock (orden ${paymentIntent.id}).`,
                  id_producto: item.id,
                  id_orden: paymentIntent.id,
                  leido: false,
                  fecha: new Date(),
                })
              }
              const newStock = Math.max(0, currentStock - item.cantidad)
              transaction.update(productRefs[i], { stock: newStock })

              // Notificar si el stock es bajo (< 5)
              if (newStock < 5) {
                transaction.set(db.collection('notifications').doc(), {
                  tipo: 'low_stock',
                  mensaje: `¡Alerta! El producto ${pData.nombre} tiene stock crítico: ${newStock} unidades.`,
                  id_producto: item.id,
                  leido: false,
                  fecha: new Date()
                })
              }
            }

            // Crear el documento de la orden (id = PaymentIntent → idempotente)
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
            transaction.set(db.collection('notifications').doc(), {
              tipo: 'purchase',
              mensaje: `${meta.customerName} ha realizado una compra por ${new Intl.NumberFormat('es-CO', {style:'currency', currency:'COP'}).format(paymentIntent.amount/100)}`,
              id_orden: paymentIntent.id,
              leido: false,
              fecha: new Date()
            })
          })

          // Enviar recibo detallado (en segundo plano, sin bloquear la respuesta a Stripe).
          if (!alreadyProcessed) {
            sendEmailInBackground(
              () =>
                sendOrderReceiptEmail({
                  to: meta.customerEmail,
                  customerName: meta.customerName,
                  items: itemsToProcess,
                  total: paymentIntent.amount / 100,
                  bank: bancoNombre,
                  date: dateStr,
                  transactionId: paymentIntent.id,
                }),
              'recibo-orden'
            )
          }
        } catch (error) {
          console.error('Error procesando productos en webhook:', error)
          processingFailed = true
        }
      }

      // --- PROCESAMIENTO DE PLANES (idempotente — T-09, auditoría A-8) ---
      // B3: se decide por `type`/`planId` (metadata puesta por el servidor), no por si
      // el nombre contiene "plan". El criterio por nombre queda SOLO para PaymentIntents
      // creados antes de este cambio (sin `type` en la metadata).
      const conceptLower = (meta.concept || '').toLowerCase()
      const isPlanPayment = meta.type
        ? meta.type === 'plan'
        : conceptLower.includes('plan') || conceptLower.includes('mensualidad')

      if (meta.uid && isPlanPayment) {
        const now = new Date()
        const orderRef = db.collection('orders').doc(paymentIntent.id)
        let alreadyProcessed = false
        let dias = 0

        try {
          // Duración: la define el plan (`days`, editable en el panel admin).
          if (meta.planId) {
            const planSnap = await db.collection('planes').doc(meta.planId).get()
            dias = Number(planSnap.data()?.days) || 0
          }
          if (!dias) {
            // Respaldo para planes sin `days` (datos antiguos).
            dias = 30
            if (conceptLower.includes('parejas')) dias = 40
            else if (conceptLower.includes('dos en uno')) dias = 60
          }

          await db.runTransaction(async (transaction) => {
            // Idempotencia: si esta orden ya existe (Stripe reintentó el evento),
            // el plan ya se activó — no procesar de nuevo.
            const orderSnap = await transaction.get(orderRef)
            if (orderSnap.exists) {
              alreadyProcessed = true
              return
            }

            const userRef = db.collection('users').doc(meta.uid)
            const userSnap = await transaction.get(userRef)
            const existingPlan = userSnap.data()?.plan
            const existingExpira: Date | null = existingPlan?.expira?.toDate
              ? existingPlan.expira.toDate()
              : existingPlan?.expira
                ? new Date(existingPlan.expira)
                : null

            // Renovación: sumar los días al vencimiento vigente si no venció; si ya venció, desde hoy
            const base = existingExpira && existingExpira.getTime() > now.getTime()
              ? existingExpira
              : new Date()
            const expira = new Date(base)
            expira.setDate(base.getDate() + dias)

            // `set` con merge: no falla si el documento del usuario no existe.
            transaction.set(userRef, {
              plan: {
                nombre: meta.concept,
                planId: meta.planId || null,
                precio: paymentIntent.amount / 100,
                dias_total: dias,
                inicio: now,
                expira: expira,
              },
            }, { merge: true })

            // Marcar el PaymentIntent como procesado (id determinista) para tolerar reintentos
            transaction.set(orderRef, {
              uid: meta.uid || 'anonimo',
              customerName: meta.customerName,
              customerEmail: meta.customerEmail,
              type: 'plan',
              planId: meta.planId || null,
              concepto: meta.concept,
              total: paymentIntent.amount / 100,
              fecha: new Date(),
              status: 'paid',
            })
          })

          // Confirmación de plan (en segundo plano; el plan ya quedó activado arriba).
          if (!alreadyProcessed) {
            sendEmailInBackground(
              () =>
                sendPaymentSuccessEmail({
                  to: meta.customerEmail,
                  customerName: meta.customerName,
                  amount: paymentIntent.amount / 100,
                  concept: meta.concept,
                  bank: bancoNombre,
                  date: dateStr,
                  transactionId: paymentIntent.id,
                }),
              'confirmacion-plan'
            )
            console.log(`Plan activado para ${meta.uid} (${dias} días)`)
          }
        } catch (dbErr: any) {
          console.error('Error actualizando plan en Firestore:', dbErr.message)
          processingFailed = true
        }
      }

      if (processingFailed) {
        return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 })
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const meta = paymentIntent.metadata
      if (meta.customerEmail) {
        sendEmailInBackground(
          () =>
            sendPaymentFailedEmail({
              to: meta.customerEmail,
              customerName: meta.customerName,
            }),
          'pago-rechazado'
        )
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}