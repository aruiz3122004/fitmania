import { Topbar } from '@/components/layout/topbar'
import { Entrenadores } from '@/components/home/entrenadores'
import { Footer } from '@/components/layout/footer'

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
