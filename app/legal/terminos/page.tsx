import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { LEGAL_ENTITY, PROJECT_NOTICE } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Condiciones de uso de FITMANIA: membresías, compras, pagos, retracto y normas del foro.',
  alternates: { canonical: '/legal/terminos' },
}

export default function TerminosPage() {
  const e = LEGAL_ENTITY
  return (
    <LegalPage title="Términos y condiciones">
      <p>Estos términos regulan el uso de la plataforma de {e.nombre} ({e.razonSocial}, NIT {e.nit}) y la compra de
        membresías y productos. Al crear una cuenta o comprar, declaras haberlos leído y aceptado (Ley 527 de 1999).</p>

      <h2>Aviso: proyecto demostrativo y contenido asistido por IA</h2>
      <ul>
        <li>{PROJECT_NOTICE.fictional}</li>
        <li>Por eso, {e.nombre} no vende membresías ni productos reales. Ningún pago de este sitio constituye una compra ni
          genera obligaciones comerciales, y no se debe usar con datos de pago reales.</li>
        <li>{PROJECT_NOTICE.ai} Ese contenido puede contener errores. No reemplaza la asesoría médica, nutricional, legal ni
          profesional.</li>
        <li>Los nombres y perfiles de entrenadores, testimonios y noticias del gimnasio son ilustrativos.</li>
      </ul>

      <h2>1. Cuenta</h2>
      <ul>
        <li>La cuenta es personal e intransferible. Eres responsable de la confidencialidad de tu contraseña.</li>
        <li>El pase de acceso (código QR) es personal: prestarlo o compartirlo puede causar la suspensión del plan.</li>
        <li>Para pagar y publicar en el foro debes verificar tu correo electrónico.</li>
      </ul>

      <h2>2. Membresías</h2>
      <ul>
        <li>Cada plan indica su precio (impuestos incluidos) y su duración en días, visibles antes del pago.</li>
        <li>La vigencia inicia en la fecha de pago. Si renuevas antes del vencimiento, los días se suman al plan vigente.</li>
        <li>El ingreso a la sede requiere un plan vigente y la validación de recepción.</li>
      </ul>

      <h2>3. Compras y pagos</h2>
      <ul>
        <li>Los precios se expresan en pesos colombianos (COP) e incluyen los impuestos aplicables.</li>
        <li>El pago se procesa en Mercado Pago (tarjeta, PSE, Efecty o saldo); {e.nombre} no recibe ni almacena datos de tarjetas ni de cuentas.</li>
        <li>Recibirás la confirmación y el soporte de pago en tu correo.</li>
      </ul>

      <h2>4. Derecho de retracto (art. 47, Ley 1480 de 2011)</h2>
      <p>En compras a distancia puedes retractarte dentro de los cinco (5) días hábiles siguientes a la entrega del
        producto o a la celebración del contrato del servicio, siempre que el servicio no haya comenzado a ejecutarse con
        tu consentimiento (por ejemplo, si ya registraste un ingreso con el plan). Los productos deben devolverse en el
        mismo estado en que se recibieron. El reintegro se hará dentro de los treinta (30) días calendario siguientes.</p>
      <p>Por su naturaleza, no aplica el retracto a alimentos y suplementos abiertos o perecederos.</p>

      <h2>5. Reversión del pago (art. 51, Ley 1480 de 2011)</h2>
      <p>Si fuiste objeto de fraude, la operación no fue solicitada, el producto no se recibió o no corresponde a lo
        solicitado, puedes solicitar la reversión del pago dentro de los cinco (5) días hábiles siguientes a que tuviste
        conocimiento, a través de PQRS y ante el emisor de tu medio de pago.</p>

      <h2>6. Normas del foro</h2>
      <ul>
        <li>Prohibido publicar contenido ilegal, ofensivo, discriminatorio, sexual, publicidad no autorizada o datos de terceros.</li>
        <li>Puedes reportar publicaciones. {e.nombre} puede retirar contenido y suspender cuentas que incumplan estas normas.</li>
        <li>Conservas los derechos sobre tu contenido y autorizas su visualización pública dentro de la plataforma.</li>
      </ul>

      <h2>7. Responsabilidad</h2>
      <p>Debes seguir las indicaciones del personal y declarar cualquier condición de salud relevante antes de
        entrenar. La información del foro no reemplaza la asesoría médica o profesional.</p>

      <h2>8. PQRS</h2>
      <p>Puedes presentar peticiones, quejas, reclamos y sugerencias en la sección PQRS. Las respuestas se envían a tu
        correo dentro de los términos legales.</p>

      <h2>9. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República de Colombia.</p>
    </LegalPage>
  )
}
