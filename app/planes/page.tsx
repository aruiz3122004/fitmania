import type { Metadata } from 'next'
import { Topbar } from '@/components/layout/topbar'
import { Planes } from '@/components/home/planes'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Planes de membresía',
  description: 'Planes de gimnasio FITMANIA en Barranquilla: mensualidad, parejas y más. Paga en línea y entrena hoy.',
  alternates: { canonical: '/planes' },
}

export default function PlanesPage() {
  return (
    <main>
      <Topbar />
      <div className="mt-[72px]">
        <Planes />
      </div>
      <Footer />
    </main>
  )
}
