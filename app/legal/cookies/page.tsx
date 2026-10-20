import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Cookies y almacenamiento local',
  description: 'Qué cookies y almacenamiento local usa FITMANIA y para qué.',
  alternates: { canonical: '/legal/cookies' },
}

export default function CookiesPage() {
  return (
    <LegalPage title="Cookies y almacenamiento local">
      <p>FITMANIA usa únicamente almacenamiento <strong>técnico</strong>, necesario para que el servicio funcione. No
        usamos cookies publicitarias ni de seguimiento de terceros.</p>

      <h2>Qué usamos</h2>
      <ul>
        <li><strong>Sesión de tu cuenta</strong> (Firebase Authentication, almacenamiento del navegador): mantiene tu sesión iniciada.</li>
        <li><strong>Carrito de compras</strong> (almacenamiento local): recuerda los productos que agregaste.</li>
        <li><strong>Cookies de los paneles internos</strong> (solo personal autorizado): sesión segura del panel de administración y de recepción.</li>
        <li><strong>Aplicación instalable (PWA)</strong>: guarda archivos estáticos para que la app cargue más rápido.</li>
        <li><strong>Analítica agregada</strong> (Vercel Analytics): mide visitas de forma anónima, sin cookies.</li>
      </ul>

      <h2>Cómo controlarlo</h2>
      <p>Puedes borrar el almacenamiento desde la configuración de tu navegador. Si lo haces, se cerrará tu sesión y se
        vaciará tu carrito. Si en el futuro se incorporan cookies no esenciales, se pedirá tu consentimiento previo.</p>
    </LegalPage>
  )
}
