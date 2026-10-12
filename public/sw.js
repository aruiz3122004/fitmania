const CACHE_NAME = 'fitmania-v1'
const ASSETS_TO_PRECACHE = [
  '/',
  '/login',
  '/tienda',
  '/planes',
  '/foro',
  '/pqrs',
  '/entrenadores',
  '/carrito',
  '/perfil',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res
        const resClone = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone))
        return res
      }).catch(() => cached)
    })
  )
})
