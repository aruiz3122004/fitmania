import type { Metadata } from 'next'
import { Topbar } from '@/components/layout/topbar'
import { Productos } from '@/components/home/productos'
import { Footer } from '@/components/layout/footer'
import { getPublicProducts } from '@/lib/public-catalog'

export const metadata: Metadata = {
  title: 'Tienda fitness',
  description: 'Suplementos, snacks saludables y ropa deportiva FITMANIA. Compra en línea.',
  alternates: { canonical: '/tienda' },
}

export default async function TiendaPage() {
  const products = await getPublicProducts()
  return (
    <main>
      <Topbar />
      <div className="mt-[72px]">
        <Productos initialProducts={products as any} />
      </div>
      <Footer />
    </main>
  )
}
