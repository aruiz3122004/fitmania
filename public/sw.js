// Service worker de FITMANIA (F2-09, parcial).
//
// Antes era cache-first para TODO GET del mismo origen: guardaba en el navegador
// respuestas privadas de /api/admin/* y servía precios/stock/HTML viejos para
// siempre. Estrategia actual:
//   - /api/* y paneles internos: NUNCA se cachean (siempre red).
//   - Navegaciones (HTML): red primero; si no hay red, la última copia o '/'.
//   - Estáticos versionados (/_next/static) e imágenes: caché primero.
//
// Cambiar CACHE_NAME invalida todo lo guardado por versiones anteriores.
const CACHE_NAME = 'fitmania-v2'
const OFFLINE_FALLBACK = '/'

const NEVER_CACHE_PREFIXES = ['/api/', '/fitministration', '/fitception', '/pago']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_FALLBACK)).catch(() => {}).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/Imagenes/') ||
    /\.(png|jpe?g|webp|avif|svg|gif|ico|woff2?)$/i.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return

  // HTML: red primero, copia local solo sin conexión.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match(OFFLINE_FALLBACK)))
    )
    return
  }

  // Estáticos: caché primero.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))
          }
          return res
        })
      })
    )
  }
  // Todo lo demás: comportamiento normal del navegador (sin caché del SW).
})
