import { Topbar } from '@/components/layout/topbar'
import { ProductosSkeleton } from '@/components/ui/comic-skeleton'

export default function Loading() {
  return (
    <main>
      <Topbar />
      <div className="mt-[72px]">
        <ProductosSkeleton />
      </div>
    </main>
  )
}
