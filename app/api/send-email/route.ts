import { NextRequest, NextResponse } from 'next/server'
import { sendPaymentSuccessEmail, sendPaymentFailedEmail } from '@/services/mail'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, to, customerName, amount, concept, transactionId } = body

    if (type === 'success') {
      await sendPaymentSuccessEmail({
        to,
        customerName,
        amount,
        concept,
        bank: 'Tarjeta de crédito/débito',
        date: new Date().toLocaleDateString('es-CO', {
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        transactionId,
      })
    } else {
      await sendPaymentFailedEmail({ to, customerName })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error enviando correo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}