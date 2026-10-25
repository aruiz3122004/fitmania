import type { Metadata } from 'next'

// F3-18: metadata de la ruta (la página es un componente cliente y no puede exportarla).
export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Ingresa a tu cuenta FITMANIA para ver tu plan y tu pase de acceso.',
  alternates: { canonical: '/login' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
