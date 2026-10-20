import Link from 'next/link'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { LEGAL_VERSION } from '@/lib/legal'

/** Contenedor común de las páginas legales (F3-09). */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main>
      <Topbar />
      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <article className="max-w-[860px] mx-auto px-6 bg-white border-4 border-secondary shadow-comic p-8 md:p-12 font-body text-gray-800 leading-relaxed [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-secondary [&_h2]:mt-8 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1 [&_p]:mb-3">
          <p className="mb-4 inline-block bg-yellow-200 border-2 border-black px-3 py-1 font-label text-xs font-bold uppercase">
            Borrador pendiente de revisión legal · versión {LEGAL_VERSION}
          </p>
          <h1 className="font-display text-4xl text-secondary uppercase mb-6">{title}</h1>
          {children}
          <nav className="mt-10 pt-6 border-t-2 border-gray-200 flex flex-wrap gap-4 font-label text-sm font-bold">
            <Link href="/legal/privacidad" className="underline">Política de tratamiento de datos</Link>
            <Link href="/legal/terminos" className="underline">Términos y condiciones</Link>
            <Link href="/legal/cookies" className="underline">Cookies y almacenamiento</Link>
          </nav>
        </article>
      </section>
      <Footer />
    </main>
  )
}
