import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { SandboxLanding } from '@/components/sandbox/sandbox-landing'
import { IS_SANDBOX, SANDBOX_URL } from '@/lib/sandbox'

export const metadata: Metadata = {
  title: 'Modo Sandbox',
  description: 'Prueba FITMANIA completo (socio, recepción y administración) con datos de ejemplo que se borran al salir.',
  robots: { index: false, follow: false },
}

export default function SandboxPage() {
  // En el sitio real el sandbox vive en otro despliegue (lib/sandbox.ts).
  if (!IS_SANDBOX) {
    if (SANDBOX_URL) redirect(`${SANDBOX_URL}/sandbox`)
    notFound()
  }
  return (
    <main>
      <Topbar />
      <Suspense>
        <SandboxLanding />
      </Suspense>
      <Footer />
    </main>
  )
}
