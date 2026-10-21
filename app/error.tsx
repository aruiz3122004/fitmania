'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Error inesperado en una página. Muestra un mensaje genérico (sin detalles
 * internos) y el código de referencia (`digest`) para cruzarlo con los logs.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('[ui] Error en la página:', error.digest || error.message)
  }, [error])

  return (
    <main className="min-h-screen bg-muted flex items-center justify-center p-6">
      <div className="max-w-md bg-white border-4 border-secondary shadow-comic p-8 text-center">
        <h1 className="font-display text-3xl text-secondary uppercase mb-3">Algo salió mal</h1>
        <p className="font-body text-gray-600 mb-4">Tuvimos un problema al cargar esta página. Intenta de nuevo en unos segundos.</p>
        {error.digest && <p className="font-label text-[11px] text-gray-400 mb-4">Código de referencia: {error.digest}</p>}
        <div className="flex justify-center gap-3">
          <button onClick={() => retry()} className="font-label font-bold text-sm text-white bg-primary px-5 py-3 border-2 border-secondary">
            REINTENTAR
          </button>
          <Link href="/" className="font-label font-bold text-sm px-5 py-3 border-2 border-secondary">IR AL INICIO</Link>
        </div>
      </div>
    </main>
  )
}
