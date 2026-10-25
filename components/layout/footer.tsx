import { Instagram, Facebook, MessageCircle, Info, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { IS_FICTIONAL, LEGAL_ENTITY, OPENING_HOURS, PROJECT_NOTICE } from '@/lib/legal'

export function Footer() {
  return (
    <footer className="bg-primary text-white relative overflow-hidden border-t-[5px] border-secondary">
      {/* Halftone pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)',
        backgroundSize: '8px 8px'
      }} />

      <div className="max-w-[1300px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 px-8 py-16 relative z-10">
        {/* Brand */}
        <div>
          <div className="flex flex-col mb-4">
            <span className="font-display text-[2.5rem] text-white tracking-[3px] leading-none [text-shadow:3px_3px_0_var(--navy)]">
              FIT<span className="text-accent">MANIA</span>
            </span>
            <span className="font-label text-[0.75rem] text-white/80 tracking-[2px] uppercase">
              Tu Pasion. Tu Fuerza.
            </span>
          </div>
          <p className="font-body text-[0.9rem] text-white/85 leading-relaxed">
            El gimnasio donde los heroes se forjan. Con estilo de comic, tecnologia de punta y entrenadores que te llevaran al siguiente nivel.
          </p>
        </div>

        {/* Address */}
        <div>
          <h4 className="font-display text-xl text-accent tracking-[2px] mb-4 pb-2 border-b-3 border-white/20 [text-shadow:1px_1px_0_var(--navy)]">
            DIRECCION
          </h4>
          <p className="font-body text-[0.9rem] text-white/90 mb-3 leading-relaxed">
            Cra. 54 # 66-12, Nte. Centro Histórico<br />Barranquilla, Atlantico, Colombia
          </p>
          <p className="font-body text-[0.9rem] text-white/90 leading-relaxed">
            {OPENING_HOURS.map((h) => (
              <span key={h.corto} className="block">{h.corto}: {h.horas}</span>
            ))}
          </p>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-display text-xl text-accent tracking-[2px] mb-4 pb-2 border-b-3 border-white/20 [text-shadow:1px_1px_0_var(--navy)]">
            CONTACTO
          </h4>
          <p className="font-body text-[0.9rem] text-white/90 mb-3">
            {LEGAL_ENTITY.telefono}
          </p>
          <p className="font-body text-[0.9rem] text-white/90 break-all">
            {LEGAL_ENTITY.correoDatos}
          </p>
        </div>

        {/* Social */}
        <div>
          <h4 className="font-display text-xl text-accent tracking-[2px] mb-4 pb-2 border-b-3 border-white/20 [text-shadow:1px_1px_0_var(--navy)]">
            REDES SOCIALES
          </h4>
          <div className="flex gap-4">
            <Link
              href="https://instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 flex items-center justify-center bg-black/20 border-2 border-white/30 text-white transition-all hover:bg-accent hover:text-secondary hover:border-secondary hover:-translate-y-[3px] hover:-rotate-5 hover:shadow-[3px_3px_0_var(--navy)]"
              aria-label="Instagram"
            >
              <Instagram className="w-5 h-5" />
            </Link>
            <Link
              href="https://facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 flex items-center justify-center bg-black/20 border-2 border-white/30 text-white transition-all hover:bg-accent hover:text-secondary hover:border-secondary hover:-translate-y-[3px] hover:-rotate-5 hover:shadow-[3px_3px_0_var(--navy)]"
              aria-label="Facebook"
            >
              <Facebook className="w-5 h-5" />
            </Link>
            <Link
              href="https://api.whatsapp.com/send?phone=573001234567"
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 flex items-center justify-center bg-black/20 border-2 border-white/30 text-white transition-all hover:bg-accent hover:text-secondary hover:border-secondary hover:-translate-y-[3px] hover:-rotate-5 hover:shadow-[3px_3px_0_var(--navy)]"
              aria-label="WhatsApp"
            >
              <MessageCircle className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t-3 border-black/20 text-center py-6 px-8 relative z-10">
        {/* F3-09: enlaces legales obligatorios (Ley 1581 / Ley 1480). */}
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-3 font-label text-[0.75rem] text-white/90 underline">
          <Link href="/legal/privacidad">Tratamiento de datos</Link>
          <Link href="/legal/terminos">Términos y condiciones</Link>
          <Link href="/legal/cookies">Cookies</Link>
          <Link href="/pqrs">PQRS</Link>
          <Link href="/preguntas-frecuentes">Preguntas frecuentes</Link>
        </nav>
        <p className="font-label text-[0.8rem] text-white/80 tracking-[1px]">
          &copy; 2026 FITMANIA. Todos los derechos reservados. Tu Pasion. Tu Fuerza.
        </p>
        {/* Aviso del proyecto como recuadro de cómic: legible sin competir con el resto del pie. */}
        <aside aria-label="Aviso del proyecto" className="relative max-w-[820px] mx-auto mt-7 bg-secondary border-[3px] border-white/90 shadow-[5px_5px_0_rgba(0,0,0,0.35)] px-4 sm:px-6 pt-6 pb-4 text-left">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 -rotate-2 bg-accent text-secondary font-display text-sm tracking-[2px] px-3 py-0.5 border-2 border-secondary shadow-[2px_2px_0_var(--navy)] whitespace-nowrap">
            ¡OJO, ES UNA DEMO!
          </span>
          <div className={`grid gap-4 ${IS_FICTIONAL ? 'sm:grid-cols-2 sm:divide-x sm:divide-white/15' : ''}`}>
            {IS_FICTIONAL && (
              <div className="flex gap-3">
                <span className="shrink-0 w-8 h-8 grid place-items-center bg-primary border-2 border-white/80 rounded-full" aria-hidden>
                  <Info className="w-4 h-4" />
                </span>
                <div>
                  <p className="font-display text-[0.95rem] tracking-[1.5px] text-accent leading-none mb-1">PROYECTO DE PORTAFOLIO</p>
                  <p className="font-body text-[0.72rem] text-white/80 leading-relaxed">{PROJECT_NOTICE.fictional}</p>
                </div>
              </div>
            )}
            <div className={`flex gap-3 ${IS_FICTIONAL ? 'sm:pl-4' : ''}`}>
              <span className="shrink-0 w-8 h-8 grid place-items-center bg-accent text-secondary border-2 border-white/80 rounded-full" aria-hidden>
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <p className="font-display text-[0.95rem] tracking-[1.5px] text-accent leading-none mb-1">HECHO CON AYUDA DE IA</p>
                <p className="font-body text-[0.72rem] text-white/80 leading-relaxed">{PROJECT_NOTICE.ai}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </footer>
  )
}
