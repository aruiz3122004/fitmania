import type { Metadata } from 'next'

// F3-18: metadata de la ruta (la página es un componente cliente y no puede exportarla).
export const metadata: Metadata = {
  title: 'Panel',
  description: 'Panel interno.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
