import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: { index: false, follow: false },
}

// También es lo que ven quienes intentan abrir los paneles internos sin acceso.
export default function NotFound() {
  return (
    <main className="min-h-screen bg-muted flex items-center justify-center p-6">
      <div className="max-w-md bg-white border-4 border-secondary shadow-comic p-8 text-center">
        <p className="font-display text-6xl text-primary mb-2">404</p>
        <h1 className="font-display text-2xl text-secondary uppercase mb-3">Página no encontrada</h1>
        <p className="font-body text-gray-600 mb-6">La página que buscas no existe o fue movida.</p>
        <Link href="/" className="inline-block font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary">
          IR AL INICIO
        </Link>
      </div>
    </main>
  )
}
