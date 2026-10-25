import { IS_FICTIONAL, LEGAL_ENTITY, OPENING_HOURS } from '@/lib/legal'
import { SITE_URL } from '@/lib/site'

/**
 * Datos estructurados del gimnasio para SEO local (F3-19): Google los usa para el
 * panel del negocio en búsquedas como "gimnasio en Barranquilla". Los campos que
 * siguen con "[...]" en lib/legal.ts (pendientes de completar) se omiten.
 */
// Datos ficticios (proyecto de portafolio): no se publican como datos reales de un negocio.
const filled = (v: string) => (!IS_FICTIONAL && v && !v.includes('[') ? v : undefined)

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
    // Antes decía sábados 7–14 h, distinto del pie de página: ahora ambos leen OPENING_HOURS.
    openingHoursSpecification: OPENING_HOURS.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.schemaDays,
      opens: h.opens,
      closes: h.closes,
    })),
  }
  return (
    <script
      type="application/ld+json"
      // JSON-LD no se ejecuta; se escapa "<" para que el contenido no pueda cerrar la etiqueta.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
