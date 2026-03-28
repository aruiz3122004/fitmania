import { Topbar } from '@/components/layout/topbar'
import { Planes } from '@/components/home/planes'
import { Footer } from '@/components/layout/footer'

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
