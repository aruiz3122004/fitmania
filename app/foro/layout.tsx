import type { Metadata } from 'next'

// F3-18: metadata de la ruta (la página es un componente cliente y no puede exportarla).
export const metadata: Metadata = {
  title: 'Foro de la comunidad',
  description: 'Noticias, logros y conversación de la comunidad FITMANIA en Barranquilla.',
  alternates: { canonical: '/foro' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
