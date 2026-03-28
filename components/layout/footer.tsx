import { Instagram, Facebook, MessageCircle } from 'lucide-react'
import Link from 'next/link'

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
            Lun - Sab: 5:00 AM - 10:00 PM<br />Dom: 7:00 AM - 4:00 PM
          </p>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-display text-xl text-accent tracking-[2px] mb-4 pb-2 border-b-3 border-white/20 [text-shadow:1px_1px_0_var(--navy)]">
            CONTACTO
          </h4>
          <p className="font-body text-[0.9rem] text-white/90 mb-3">
            +57 300 123 4567
          </p>
          <p className="font-body text-[0.9rem] text-white/90">
            info@fitmania.com
          </p>
        </div>

        {/* Social */}
        <div>
          <h4 className="font-display text-xl text-accent tracking-[2px] mb-4 pb-2 border-b-3 border-white/20 [text-shadow:1px_1px_0_var(--navy)]">
            REDES SOCIALES
          </h4>
          <div className="flex gap-4">
            <Link
              href="#"
              className="w-11 h-11 flex items-center justify-center bg-black/20 border-2 border-white/30 text-white transition-all hover:bg-accent hover:text-secondary hover:border-secondary hover:-translate-y-[3px] hover:-rotate-5 hover:shadow-[3px_3px_0_var(--navy)]"
              aria-label="Instagram"
            >
              <Instagram className="w-5 h-5" />
            </Link>
            <Link
              href="#"
              className="w-11 h-11 flex items-center justify-center bg-black/20 border-2 border-white/30 text-white transition-all hover:bg-accent hover:text-secondary hover:border-secondary hover:-translate-y-[3px] hover:-rotate-5 hover:shadow-[3px_3px_0_var(--navy)]"
              aria-label="Facebook"
            >
              <Facebook className="w-5 h-5" />
            </Link>
            <Link
              href="#"
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
        <p className="font-label text-[0.8rem] text-white/80 tracking-[1px]">
          &copy; 2026 FITMANIA. Todos los derechos reservados. Tu Pasion. Tu Fuerza.
        </p>
      </div>
    </footer>
  )
}
