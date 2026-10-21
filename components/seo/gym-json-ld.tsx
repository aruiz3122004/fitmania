import { LEGAL_ENTITY } from '@/lib/legal'
import { SITE_URL } from '@/lib/site'

/**
 * Datos estructurados del gimnasio para SEO local (F3-19): Google los usa para el
 * panel del negocio en búsquedas como "gimnasio en Barranquilla". Los campos que
 * siguen con "[...]" en lib/legal.ts (pendientes de completar) se omiten.
 */
const filled = (v: string) => (v && !v.includes('[') ? v : undefined)

export function GymJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ExerciseGym',
    name: 'FITMANIA',
    url: SITE_URL,
    image: `${SITE_URL}/Imagenes/Fitmania%20Gym.jpeg`,
    logo: `${SITE_URL}/icons/icon-512.png`,
    telephone: filled(LEGAL_ENTITY.telefono),
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: filled(LEGAL_ENTITY.direccion.split(',')[0]),
      addressLocality: 'Barranquilla',
      addressRegion: 'Atlántico',
      addressCountry: 'CO',
    },
    // TODO: confirmar el horario real de la sede.
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '05:00', closes: '22:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday'], opens: '07:00', closes: '14:00' },
    ],
  }
  return (
    <script
      type="application/ld+json"
      // JSON-LD no se ejecuta; se escapa "<" para que el contenido no pueda cerrar la etiqueta.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
