import type { Metadata } from 'next'
import Link from 'next/link'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { FaqBrowser } from '@/components/legal/faq-browser'
import { FAQ } from '@/lib/faq'
import { PROJECT_NOTICE } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description: 'Respuestas sobre cuenta, verificación en dos pasos, planes, pagos con Mercado Pago, pase QR, foro, PQRS y privacidad en FITMANIA.',
  alternates: { canonical: '/preguntas-frecuentes' },
}

export default function PreguntasFrecuentesPage() {
  const total = FAQ.reduce((n, c) => n + c.items.length, 0)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.flatMap((c) =>
      c.items.map((i) => ({
        '@type': 'Question',
        name: i.q,
        acceptedAnswer: { '@type': 'Answer', text: i.a.map((b) => (Array.isArray(b) ? b.join(' ') : b)).join(' ') },
      }))
    ),
  }

  return (
    <main>
      <Topbar />
      <section className="mt-[72px] min-h-screen bg-muted py-16">
        <div className="max-w-[860px] mx-auto px-6">
          <header className="mb-8">
            <p className="font-label text-xs font-black uppercase tracking-[3px] text-primary mb-2">Soporte · {total} respuestas</p>
            <h1 className="font-display text-5xl md:text-6xl text-secondary uppercase leading-none mb-4">
              Preguntas <span className="text-primary">frecuentes</span>
            </h1>
            <p className="font-body text-gray-700 max-w-[62ch]">
              Lo que más nos preguntan sobre tu cuenta, tu plan, los pagos y el acceso a la sede. ¿No está tu duda?
              Escríbenos por <Link href="/pqrs" className="underline font-bold text-primary">PQRS</Link> y te respondemos al correo.
            </p>
          </header>

          <FaqBrowser categories={FAQ} />

          <aside className="mt-12 bg-yellow-200 border-2 border-black px-4 py-3 font-body text-xs text-gray-900">
            {PROJECT_NOTICE.fictional} {PROJECT_NOTICE.ai}
          </aside>

          <nav className="mt-6 flex flex-wrap gap-4 font-label text-sm font-bold">
            <Link href="/legal/privacidad" className="underline">Política de tratamiento de datos</Link>
            <Link href="/legal/terminos" className="underline">Términos y condiciones</Link>
            <Link href="/legal/cookies" className="underline">Cookies y almacenamiento</Link>
            <Link href="/pqrs" className="underline">PQRS</Link>
          </nav>
        </div>
      </section>
      <Footer />
      <script
        type="application/ld+json"
        // JSON-LD no se ejecuta; se escapa "<" para que el contenido no pueda cerrar la etiqueta.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </main>
  )
}
