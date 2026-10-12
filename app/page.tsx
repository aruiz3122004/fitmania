import { Topbar } from '@/components/layout/topbar'
import { Hero } from '@/components/home/hero'
import { Footer } from '@/components/layout/footer'
import dynamic from 'next/dynamic'

const Planes = dynamic(() => import('@/components/home/planes').then(m => m.Planes))
const Productos = dynamic(() => import('@/components/home/productos').then(m => m.Productos))
const Entrenadores = dynamic(() => import('@/components/home/entrenadores').then(m => m.Entrenadores))

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
