/**
 * URL pública del sitio (SEO: metadataBase, sitemap, robots, Open Graph).
 * Definir `NEXT_PUBLIC_SITE_URL` con el dominio propio (p. ej. https://fitmania.com.co).
 * En Vercel, si no está, se usa el dominio de producción del proyecto.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
).replace(/\/$/, '')

export const SITE_NAME = 'FITMANIA'
