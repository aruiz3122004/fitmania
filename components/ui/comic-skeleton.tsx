/**
 * Skeletons con trama de cómic y brillo (clase `fm-skeleton` en globals.css). Ocupan el
 * mismo espacio que el contenido real para que la página no salte al cargar.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`fm-skeleton ${className}`} />
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border-3 border-secondary shadow-comic ${className}`}>{children}</div>
}

/** Anuncio para lectores de pantalla; lo visual son los bloques. */
function Status({ label }: { label: string }) {
  return <span role="status" className="sr-only">{label}</span>
}

export function PlanCardSkeleton() {
  return (
    <Card className="p-8 flex flex-col gap-4">
      <Skeleton className="h-6 w-24 self-end" />
      <Skeleton className="h-14 w-14 rounded-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-10 w-1/2" />
      <div className="flex flex-col gap-2 py-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <Skeleton className="h-12 w-full mt-auto" />
    </Card>
  )
}

export function PlanesSkeleton() {
  return (
    <section className="bg-muted py-20">
      <Status label="Cargando planes" />
      <div className="max-w-[1300px] mx-auto px-8">
        <div className="flex flex-col items-center gap-3 mb-12">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <PlanCardSkeleton />
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </div>
      </div>
    </section>
  )
}

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-4 flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-full mt-2" />
      </div>
    </Card>
  )
}

export function ProductosSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section className="py-20">
      <Status label="Cargando la tienda" />
      <div className="max-w-[1300px] mx-auto px-8">
        <div className="flex flex-col items-center gap-3 mb-10">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9 w-24" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    </section>
  )
}

export function PostSkeleton() {
  return (
    <Card className="mb-6 shadow-comic-sm">
      <div className="flex items-center gap-3 p-4 border-b-2 border-gray-200">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-48 w-full mt-2" />
      </div>
      <div className="flex gap-4 p-4 border-t-2 border-gray-200">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
      </div>
    </Card>
  )
}

export function ForoSkeleton() {
  return (
    <div className="max-w-[700px] mx-auto px-4 py-10">
      <Status label="Cargando el foro" />
      <Card className="p-4 mb-8 flex gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 flex-1" />
      </Card>
      <PostSkeleton />
      <PostSkeleton />
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-[900px] mx-auto px-8 py-16">
      <Status label="Cargando tu perfil" />
      <div className="flex flex-col items-center gap-3 mb-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-72 max-w-full" />
      </div>
      <Card className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-8 mb-8 pb-8 border-b-2 border-dashed border-gray-100">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 w-full flex flex-col gap-3 items-center md:items-start">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-56" />
            <div className="flex gap-3"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-32" /></div>
          </div>
          <Skeleton className="h-36 w-36" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-full" /></div>
          ))}
        </div>
      </Card>
      <Skeleton className="h-48 w-full mt-8 border-3 border-black" />
    </div>
  )
}

export function ListSkeleton({ rows = 5, label = 'Cargando' }: { rows?: number; label?: string }) {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-16">
      <Status label={label} />
      <Skeleton className="h-12 w-64 max-w-full mb-8" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <Card key={i} className="p-5 flex items-center gap-4 shadow-comic-sm">
            <Skeleton className="h-12 w-12" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-24" />
          </Card>
        ))}
      </div>
    </div>
  )
}
