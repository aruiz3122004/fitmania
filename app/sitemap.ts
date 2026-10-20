import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// F3-18: solo páginas públicas.
const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/planes', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/tienda', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/entrenadores', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/foro', priority: 0.6, changeFrequency: 'daily' },
  { path: '/pqrs', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/registro', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.3, changeFrequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }))
}
