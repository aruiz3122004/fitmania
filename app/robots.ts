import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// F3-18: los paneles internos, la API y las páginas privadas no se indexan.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/fitministration', '/fitception', '/api/', '/perfil', '/pago', '/carrito', '/planilla-ingresos', '/offline'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
