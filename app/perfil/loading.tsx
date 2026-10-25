import { Topbar } from '@/components/layout/topbar'
import { ProfileSkeleton } from '@/components/ui/comic-skeleton'

export default function Loading() {
  return (
    <main>
      <Topbar />
      <div className="mt-[72px] min-h-screen bg-muted">
        <ProfileSkeleton />
      </div>
    </main>
  )
}
