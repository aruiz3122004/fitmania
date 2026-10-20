import type { Metadata, Viewport } from 'next'
import { Bangers, Epilogue, Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from './context/AuthContext'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { SITE_NAME, SITE_URL } from '@/lib/site'

// T-17: la CSP usa nonces por request (middleware). Los nonces exigen renderizado
// dinámico: una página estática se genera en build, sin request, y sus <script>
// quedarían sin nonce (y el navegador los bloquea). Por eso forzamos dinámico
// en el segmento raíz (aplica a todas las rutas hijas). NO quitar.
export const dynamic = 'force-dynamic'

const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display'
})

const epilogue = Epilogue({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading'
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body'
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-label'
})

export const metadata: Metadata = {
  // F3-18: base para URLs absolutas (Open Graph, canonical) y plantilla de títulos por página.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'FITMANIA - Gimnasio en Barranquilla | Tu Pasión. Tu Fuerza.',
    template: '%s | FITMANIA',
  },
  description: 'Gimnasio en Barranquilla con estilo de superhéroes. Planes de membresía, entrenadores, suplementos, snacks y ropa fitness.',
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: SITE_NAME,
    title: 'FITMANIA - Gimnasio en Barranquilla',
    description: 'Planes de membresía, entrenadores y tienda fitness. Tu Pasión. Tu Fuerza.',
    images: [{ url: '/Imagenes/Fitmania%20Gym.jpeg', alt: 'Gimnasio FITMANIA' }],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/Imagenes/Avatares/FitmanNEW.png',
    apple: '/Imagenes/Avatares/FitmanNEW.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FITMANIA',
  },
}

export const viewport: Viewport = {
  themeColor: '#DC2626',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${bangers.variable} ${epilogue.variable} ${plusJakarta.variable} ${spaceGrotesk.variable}`}>
      <body className="font-body antialiased">
        {/*  AuthProvider envuelve toda la app  Para manejar el estado de autenticacion de Firebase */}
        <AuthProvider>
          {children}
          <Analytics />
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
