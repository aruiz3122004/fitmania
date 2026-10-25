import { Dumbbell } from 'lucide-react'

const WORDS = ['¡CALENTANDO!', '¡CARGANDO PESAS!', '¡UNA MÁS!', '¡VAMOS!']

/**
 * Pantalla de carga de página completa: globo de cómic con una pesa que sube y baja,
 * palabras que se turnan y una barra rayada. Sin JavaScript (solo CSS de globals.css)
 * y estática si el usuario prefiere menos movimiento.
 */
export function ComicLoader({ label = 'Cargando', belowTopbar = false }: { label?: string; belowTopbar?: boolean }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`${belowTopbar ? 'min-h-[calc(100vh-72px)] mt-[72px]' : 'min-h-screen'} flex flex-col items-center justify-center gap-8 bg-muted px-6 relative overflow-hidden`}
    >
      {/* Trama de puntos de fondo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle, var(--navy) 1px, transparent 1.2px)', backgroundSize: '14px 14px' }}
      />

      <div aria-hidden="true" className="relative fm-burst" style={{ animation: 'fm-burst 1.6s ease-in-out infinite' }}>
        {/* Estallido de cómic */}
        <svg viewBox="0 0 200 200" className="w-52 h-52 drop-shadow-[6px_6px_0_var(--navy)]">
          <polygon
            points="100,4 118,52 168,28 150,78 196,96 152,118 176,168 124,152 108,196 88,152 38,176 52,126 4,110 50,88 26,38 78,56"
            fill="var(--accent)"
            stroke="var(--navy)"
            strokeWidth="6"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="fm-lift" style={{ animation: 'fm-lift 0.9s ease-in-out infinite' }}>
            <Dumbbell className="w-20 h-20 text-secondary" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="relative h-10 w-72 max-w-full">
        {WORDS.map((w, i) => (
          <span
            key={w}
            className="fm-word absolute inset-0 flex items-center justify-center font-display text-3xl md:text-4xl italic text-primary tracking-wider [text-shadow:3px_3px_0_var(--navy)]"
            style={{ animation: `fm-word ${WORDS.length * 1.1}s ease-in-out ${i * 1.1}s infinite`, opacity: 0 }}
          >
            {w}
          </span>
        ))}
      </div>

      <div aria-hidden="true" className="relative w-64 max-w-full h-5 border-3 border-secondary bg-white shadow-comic-sm overflow-hidden">
        <div
          className="fm-stripes absolute inset-y-0 left-0 w-2/3"
          style={{
            backgroundImage: 'repeating-linear-gradient(-45deg, var(--primary) 0 10px, #ef4444 10px 20px)',
            backgroundSize: '40px 100%',
            animation: 'fm-stripes 0.6s linear infinite',
          }}
        />
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  )
}
