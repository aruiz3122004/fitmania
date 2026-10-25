import { Topbar } from '@/components/layout/topbar'
import { ForoSkeleton } from '@/components/ui/comic-skeleton'

export default function Loading() {
  return (
    <main>
      <Topbar />
      <div className="mt-[72px] min-h-screen bg-muted">
        <ForoSkeleton />
      </div>
    </main>
  )
}
