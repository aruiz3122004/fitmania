import type { Metadata } from 'next'
import { Topbar } from '@/components/layout/topbar'
import { Planes } from '@/components/home/planes'
import { Footer } from '@/components/layout/footer'
import { getPublicPlanes } from '@/lib/public-catalog'

export const metadata: Metadata = {
  title: 'Planes de membresía',
  description: 'Planes de gimnasio FITMANIA en Barranquilla: mensualidad, parejas y más. Paga en línea y entrena hoy.',
  alternates: { canonical: '/planes' },
}

export default async function PlanesPage() {
  const planes = await getPublicPlanes()
  return (
    <main>
      <Topbar />
      <div className="mt-[72px]">
        <Planes initialPlanes={planes} />
      </div>
      <Footer />
    </main>
  )
}
