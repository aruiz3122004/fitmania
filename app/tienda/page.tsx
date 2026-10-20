import type { Metadata } from 'next'
import { Topbar } from '@/components/layout/topbar'
import { Productos } from '@/components/home/productos'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Tienda fitness',
  description: 'Suplementos, snacks saludables y ropa deportiva FITMANIA. Compra en línea.',
  alternates: { canonical: '/tienda' },
}

export default function TiendaPage() {
  return (
    <main>
      <Topbar />
      <div className="mt-[72px]">
        <Productos />
      </div>
      <Footer />
    </main>
  )
}
