'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Search } from 'lucide-react'
import type { FaqBlock, FaqCategory } from '@/lib/faq'

const blockText = (b: FaqBlock) => (Array.isArray(b) ? b.join(' ') : b)

// Sin tildes ni mayúsculas, para que "contrasena" encuentre "contraseña".
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Buscador y acordeón de /preguntas-frecuentes. Sin JS, los <details> siguen funcionando. */
export function FaqBrowser({ categories }: { categories: FaqCategory[] }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    return categories
      .filter((c) => !active || c.id === active)
      .map((c) => ({
        ...c,
        items: q ? c.items.filter((i) => normalize(`${i.q} ${i.a.map(blockText).join(' ')}`).includes(q)) : c.items,
      }))
      .filter((c) => c.items.length > 0)
  }, [categories, query, active])

  const total = visible.reduce((n, c) => n + c.items.length, 0)

  return (
    <div>
      <div className="relative mb-4">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          id="faq-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca tu duda: pago, código, QR, congelar..."
          aria-label="Buscar en las preguntas frecuentes"
          className="w-full pl-12 pr-4 py-4 border-4 border-secondary font-body text-base outline-none focus:border-primary shadow-comic-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filtrar por tema">
        <button
          type="button"
          onClick={() => setActive(null)}
          aria-pressed={active === null}
          className={`font-label text-xs font-black uppercase tracking-wider px-3 py-2 border-2 border-secondary transition-colors ${active === null ? 'bg-secondary text-white' : 'bg-white hover:bg-yellow-100'}`}
        >
          Todo
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(active === c.id ? null : c.id)}
            aria-pressed={active === c.id}
            className={`font-label text-xs font-black uppercase tracking-wider px-3 py-2 border-2 border-secondary transition-colors ${active === c.id ? 'bg-primary text-white' : 'bg-white hover:bg-yellow-100'}`}
          >
            {c.title}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div className="border-4 border-dashed border-gray-300 p-8 text-center font-body text-gray-600">
          <p className="font-display text-2xl text-secondary mb-2">SIN RESULTADOS</p>
          <p>
            No encontramos esa pregunta. Escríbenos por{' '}
            <Link href="/pqrs" className="underline font-bold text-primary">PQRS</Link> y te respondemos al correo.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {visible.map((c) => (
            <section key={c.id} aria-labelledby={`faq-${c.id}`}>
              <h2 id={`faq-${c.id}`} className="font-display text-2xl text-secondary tracking-wider mb-3">
                {c.title.toUpperCase()}
              </h2>
              <div className="space-y-3">
                {c.items.map((item) => (
                  <details
                    key={item.id}
                    id={item.id}
                    open={!!query.trim()}
                    className="group bg-white border-3 border-secondary shadow-comic-sm open:shadow-[5px_5px_0_0_var(--red-primary)] transition-shadow"
                  >
                    <summary className="flex items-start justify-between gap-4 cursor-pointer list-none p-4 font-label font-bold text-secondary [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent">
                      <span>{item.q}</span>
                      <ChevronDown className="w-5 h-5 shrink-0 mt-0.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="px-4 pb-4 font-body text-sm text-gray-700 leading-relaxed space-y-2 border-t-2 border-dashed border-gray-200 pt-3">
                      {item.a.map((b, i) =>
                        Array.isArray(b) ? (
                          <ul key={i} className="list-disc pl-5 space-y-1">
                            {b.map((li) => <li key={li}>{li}</li>)}
                          </ul>
                        ) : (
                          <p key={i}>{b}</p>
                        )
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
