import type { Metadata } from 'next'
import { Topbar } from '@/components/layout/topbar'
import { Entrenadores } from '@/components/home/entrenadores'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Entrenadores',
  description: 'Conoce al equipo de entrenadores de FITMANIA en Barranquilla.',
  alternates: { canonical: '/entrenadores' },
}

export default function EntrenadoresPage() {
  return (
    <main>
      <Topbar />
      <div className="mt-[72px]">
        <Entrenadores />
      </div>
      <Footer />
    </main>
  )
}
