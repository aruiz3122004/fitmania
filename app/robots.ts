import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { IS_SANDBOX } from '@/lib/sandbox'

// F3-18: los paneles internos, la API y las páginas privadas no se indexan.
export default function robots(): MetadataRoute.Robots {
  // El sandbox (copia de pruebas) no se indexa entero.
  if (IS_SANDBOX) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/fitministration', '/fitception', '/api/', '/perfil', '/compras', '/pago', '/carrito', '/planilla-ingresos', '/offline'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
