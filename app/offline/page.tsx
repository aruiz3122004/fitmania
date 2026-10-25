import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sin conexión',
  robots: { index: false, follow: false },
}

// F2-09: página de respaldo que el service worker muestra cuando no hay red.
export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-muted flex items-center justify-center p-6">
      <div className="max-w-md bg-white border-4 border-secondary shadow-comic p-8 text-center">
        <h1 className="font-display text-3xl text-secondary uppercase mb-3">Sin conexión</h1>
        <p className="font-body text-gray-600 mb-4">
          No hay internet en este momento. Tu <strong>pase de acceso</strong> sigue disponible en tu perfil si lo abriste
          con conexión en las últimas 24 horas.
        </p>
        <Link href="/perfil" className="inline-block font-label font-bold text-sm text-white bg-primary px-6 py-3 border-2 border-secondary">
          IR A MI PASE
        </Link>
      </div>
    </main>
  )
}
