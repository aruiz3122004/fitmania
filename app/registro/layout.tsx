import type { Metadata } from 'next'

// F3-18: metadata de la ruta (la página es un componente cliente y no puede exportarla).
export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Regístrate en FITMANIA y adquiere tu plan de gimnasio en Barranquilla.',
  alternates: { canonical: '/registro' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
