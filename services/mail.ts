import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // App Password de Google, NO tu contraseña normal
  },
})

interface PaymentEmailData {
  to: string
  customerName: string
  amount: number
  concept: string
  bank: string
  date: string
  transactionId: string
}

interface OrderItem {
  nombre: string
  cantidad: number
  precio: number
}

interface OrderReceiptData {
  to: string
  customerName: string
  items: OrderItem[]
  total: number
  bank: string
  date: string
  transactionId: string
}

export async function sendPaymentSuccessEmail(data: PaymentEmailData) {
  const formattedAmount = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
  }).format(data.amount)

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Pago Exitoso - Fitmania</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;border-top:6px solid #D32F2F;">
              <!-- Header -->
              <tr>
                <td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#D32F2F;font-size:28px;letter-spacing:3px;font-weight:900;">FIT<span style="color:#f5c518;">MANIA</span></h1>
                  <p style="margin:4px 0 0;color:#ffffff99;font-size:12px;letter-spacing:2px;">TU PASIÓN. TU FUERZA.</p>
                </td>
              </tr>
              <!-- Success Banner -->
              <tr>
                <td style="background:#2e7d32;padding:24px 40px;text-align:center;">
                  <p style="margin:0;font-size:36px;">✅</p>
                  <h2 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">¡PAGO EXITOSO!</h2>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <p style="color:#333;font-size:16px;line-height:1.6;margin-top:0;">
                    Hola <strong>${data.customerName}</strong>,<br/>
                    gracias por hacer parte de nuestros servicios en <strong>Fitmania</strong>. Tu pago ha sido procesado correctamente.
                  </p>

                  <!-- Receipt -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:2px solid #e0e0e0;border-radius:4px;margin:24px 0;">
                    <tr>
                      <td style="padding:20px 24px;">
                        <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#999;text-transform:uppercase;">Extracto del pago</p>
                        <h3 style="margin:0 0 20px;color:#1a1a2e;font-size:16px;">Resumen de transacción</h3>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#666;font-size:14px;">Concepto</td>
                            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#333;font-size:14px;text-align:right;font-weight:600;">${data.concept}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#666;font-size:14px;">Banco</td>
                            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#333;font-size:14px;text-align:right;">${data.bank}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#666;font-size:14px;">Fecha</td>
                            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#333;font-size:14px;text-align:right;">${data.date}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#666;font-size:14px;">ID Transacción</td>
                            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#333;font-size:12px;text-align:right;font-family:monospace;">${data.transactionId}</td>
                          </tr>
                          <tr>
                            <td style="padding:16px 0 8px;color:#1a1a2e;font-size:16px;font-weight:700;">TOTAL PAGADO</td>
                            <td style="padding:16px 0 8px;color:#D32F2F;font-size:20px;font-weight:900;text-align:right;">${formattedAmount}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <p style="color:#555;font-size:14px;line-height:1.6;">
                    Si tienes alguna pregunta sobre tu pago, puedes contactarnos a través de la sección <strong>PQRS</strong> en nuestra página web.
                  </p>
                  <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:0;">
                    Atentamente,<br/>
                    <strong>La administración de Fitmania</strong>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#1a1a2e;padding:20px 40px;text-align:center;">
                  <p style="margin:0;color:#ffffff55;font-size:12px;">© 2026 Fitmania — Tu Pasión. Tu Fuerza.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  await transporter.sendMail({
    from: `"Fitmania" <${process.env.GMAIL_USER}>`,
    to: data.to,
    subject: '✅ ¡Pago Exitoso! - Fitmania',
    html,
  })
}

export async function sendPaymentFailedEmail(data: Pick<PaymentEmailData, 'to' | 'customerName'>) {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Pago Rechazado - Fitmania</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;border-top:6px solid #D32F2F;">
              <!-- Header -->
              <tr>
                <td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#D32F2F;font-size:28px;letter-spacing:3px;font-weight:900;">FIT<span style="color:#f5c518;">MANIA</span></h1>
                  <p style="margin:4px 0 0;color:#ffffff99;font-size:12px;letter-spacing:2px;">TU PASIÓN. TU FUERZA.</p>
                </td>
              </tr>
              <!-- Failed Banner -->
              <tr>
                <td style="background:#c62828;padding:24px 40px;text-align:center;">
                  <p style="margin:0;font-size:36px;">❌</p>
                  <h2 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">¡PAGO RECHAZADO!</h2>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <p style="color:#333;font-size:16px;line-height:1.6;margin-top:0;">
                    Hola <strong>${data.customerName}</strong>,
                  </p>
                  <p style="color:#555;font-size:15px;line-height:1.8;">
                    No hemos detectado el movimiento mediante su cuenta bancaria. Si considera que se trata de un error, por favor diríjase a la página principal de Fitmania en la sección de <strong>PQRS</strong> ubicada en la página principal y háganos saber su inconformidad, o si lo desea, diríjase al punto físico de la tienda.
                  </p>
                  <div style="background:#fff3f3;border-left:4px solid #D32F2F;padding:16px 20px;margin:24px 0;border-radius:0 4px 4px 0;">
                    <p style="margin:0;color:#c62828;font-size:14px;font-weight:600;">¿Qué puedes hacer?</p>
                    <ul style="margin:8px 0 0;color:#555;font-size:14px;line-height:1.8;padding-left:20px;">
                      <li>Verificar que tienes fondos suficientes en tu cuenta</li>
                      <li>Intentar el pago nuevamente</li>
                      <li>Contactarnos a través de PQRS</li>
                      <li>Visitar nuestro punto físico</li>
                    </ul>
                  </div>
                  <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:0;">
                    Atentamente,<br/>
                    <strong>La administración de Fitmania</strong>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#1a1a2e;padding:20px 40px;text-align:center;">
                  <p style="margin:0;color:#ffffff55;font-size:12px;">© 2026 Fitmania — Tu Pasión. Tu Fuerza.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  await transporter.sendMail({
    from: `"Fitmania" <${process.env.GMAIL_USER}>`,
    to: data.to,
    subject: '❌ Pago Rechazado - Fitmania',
    html,
  })
}

export async function sendOrderReceiptEmail(data: OrderReceiptData) {
  const formattedTotal = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
  }).format(data.total)

  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#333;font-size:14px;">${item.nombre} x${item.cantidad}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#333;font-size:14px;text-align:right;">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(item.precio * item.cantidad)}</td>
    </tr>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-top: 6px solid #D32F2F; }
        .header { background: #1a1a2e; color: #fff; padding: 30px; text-align: center; }
        .content { padding: 40px; }
        .receipt-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .total-row { font-weight: 900; font-size: 18px; color: #D32F2F; border-top: 2px solid #1a1a2e; }
        .footer { background: #1a1a2e; color: #ffffff55; padding: 20px; text-align: center; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">FIT<span style="color:#f5c518;">MANIA</span></h1>
          <p style="margin:5px 0 0;font-size:12px;opacity:0.8;">DETALLE DE TU COMPRA</p>
        </div>
        <div class="content">
          <p>Hola <strong>${data.customerName}</strong>,</p>
          <p>Tu pedido ha sido procesado con éxito. Aquí tienes el detalle de tus productos:</p>
          
          <table class="receipt-table">
            <thead>
              <tr style="text-align:left;color:#999;font-size:11px;text-transform:uppercase;">
                <th style="padding-bottom:10px;">Producto</th>
                <th style="padding-bottom:10px;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td style="padding:20px 0;">TOTAL</td>
                <td style="padding:20px 0;text-align:right;">${formattedTotal}</td>
              </tr>
            </tbody>
          </table>

          <div style="background:#f9f9f9;padding:20px;border-radius:4px;font-size:13px;color:#666;">
            <p style="margin:0;"><strong>Banco:</strong> ${data.bank}</p>
            <p style="margin:5px 0;"><strong>Fecha:</strong> ${data.date}</p>
            <p style="margin:5px 0;"><strong>ID Transacción:</strong> ${data.transactionId}</p>
          </div>
        </div>
        <div class="footer">
          © 2026 Fitmania — Tu Pasión. Tu Fuerza.
        </div>
      </div>
    </body>
    </html>
  `

  await transporter.sendMail({
    from: `"Fitmania" <${process.env.GMAIL_USER}>`,
    to: data.to,
    subject: '🛍️ Recibo de Compra - Fitmania',
    html,
  })
}

interface PqrsReplyData {
  to: string
  customerName: string
  originalMessage: string
  adminResponse: string
}

export async function sendPqrsReplyEmail(data: PqrsReplyData) {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; }
        .header { background: #1a1a2e; color: #fff; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .quote { background: #f9f9f9; border-left: 4px solid #D32F2F; padding: 15px; margin: 20px 0; font-style: italic; }
        .response { background: #f0f7ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
        .footer { font-size: 12px; color: #999; text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;color:#D32F2F;">FIT<span style="color:#f5c518;">MANIA</span></h1>
          <p style="margin:5px 0 0;font-size:12px;opacity:0.8;">RESPUESTA A TU SOLICITUD</p>
        </div>
        <div class="content">
          <p>Hola <strong>${data.customerName}</strong>,</p>
          <p>Hemos recibido tu PQRS y un administrador de Fitmania ha revisado tu caso. Aquí tienes nuestra respuesta:</p>
          
          <div class="quote">
            <strong>Tu comentario original:</strong><br/>
            "${data.originalMessage}"
          </div>

          <div class="response">
            <strong>Respuesta del Administrador:</strong><br/>
            ${data.adminResponse}
          </div>

          <p>Esperamos que esta respuesta sea satisfactoria. Hemos marcado tu solicitud como <strong>RESUELTA</strong>.</p>
          <p>Atentamente,<br/><strong>El equipo de Fitmania</strong></p>
        </div>
        <div class="footer">
          © 2026 Fitmania. Por favor no respondas a este correo.
        </div>
      </div>
    </body>
    </html>
  `

  await transporter.sendMail({
    from: `"Fitmania" <${process.env.GMAIL_USER}>`,
    to: data.to,
    subject: '📝 Respuesta a tu PQRS - Fitmania',
    html,
  })
}