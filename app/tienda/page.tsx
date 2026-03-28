import { Topbar } from '@/components/layout/topbar'
import { Productos } from '@/components/home/productos'
import { Footer } from '@/components/layout/footer'

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
