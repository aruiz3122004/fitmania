import type { Metadata } from 'next'
import { Topbar } from '@/components/layout/topbar'
import { Hero } from '@/components/home/hero'
import { Footer } from '@/components/layout/footer'
import dynamic from 'next/dynamic'
import { getPublicPlanes, getPublicProducts } from '@/lib/public-catalog'

const Planes = dynamic(() => import('@/components/home/planes').then(m => m.Planes))
const Productos = dynamic(() => import('@/components/home/productos').then(m => m.Productos))
const Entrenadores = dynamic(() => import('@/components/home/entrenadores').then(m => m.Entrenadores))

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  // F2-21: catálogo leído en el servidor (HTML indexable, sin listeners por visitante).
  const [planes, products] = await Promise.all([getPublicPlanes(), getPublicProducts()])
  return (
    <main>
      <Topbar />
      <Hero />
      <Planes initialPlanes={planes} />
      <Productos initialProducts={products as any} />
      <Entrenadores />
      <Footer />
    </main>
  )
}
