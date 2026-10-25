import type { Metadata } from 'next'

// F3-18: metadata de la ruta (la página es un componente cliente y no puede exportarla).
export const metadata: Metadata = {
  title: 'PQRS',
  description: 'Peticiones, quejas, reclamos y sugerencias para FITMANIA. Respuesta por correo.',
  alternates: { canonical: '/pqrs' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
