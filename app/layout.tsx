import type { Metadata, Viewport } from 'next'
import { Bangers, Epilogue, Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from './context/AuthContext'

const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display'
})

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-heading'
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body'
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-label'
})

export const metadata: Metadata = {
  title: 'FITMANIA - Tu Pasion. Tu Fuerza.',
  description: 'Gimnasio con estilo de superheroes. Planes de membresia, suplementos, snacks y ropa fitness.',
  icons: {
    icon: '/Imagenes/Avatares/FitmanNEW.png',
    apple: '/Imagenes/Avatares/FitmanNEW.png',
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
      </body>
    </html>
  )
}
