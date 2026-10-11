import { Topbar } from '@/components/layout/topbar'
import { Hero } from '@/components/home/hero'
import { Planes } from '@/components/home/planes'
import { Productos } from '@/components/home/productos'
import { Entrenadores } from '@/components/home/entrenadores'
import { Footer } from '@/components/layout/footer'

export default function HomePage() {
  return (
    <main>
      <Topbar />
      <Hero />
      <Planes />
      <Productos />
      <Entrenadores />
      <Footer />
    </main>
  )
}
