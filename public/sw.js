// Service worker de FITMANIA (F2-09, parcial).
//
// Antes era cache-first para TODO GET del mismo origen: guardaba en el navegador
// respuestas privadas de /api/admin/* y servía precios/stock/HTML viejos para
// siempre. Estrategia actual:
//   - /api/* y paneles internos: NUNCA se cachean (siempre red).
//   - Navegaciones (HTML): red primero; si no hay red, la última copia o '/offline'.
//   - Estáticos versionados (/_next/static) e imágenes: caché primero.
//
// Cambiar CACHE_NAME invalida todo lo guardado por versiones anteriores.
const CACHE_NAME = 'fitmania-v4'
const OFFLINE_FALLBACK = '/offline'

const NEVER_CACHE_PREFIXES = ['/api/', '/fitministration', '/fitception', '/pago']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_FALLBACK, '/perfil'])).catch(() => {})
  )
  // La activación espera a que el usuario acepte "Nueva versión disponible" (SKIP_WAITING),
  // salvo la primera instalación (sin SW previo), que se activa de inmediato.
  if (!self.registration.active) self.skipWaiting()
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
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

// F3-13: notificaciones push (Firebase Cloud Messaging con este service worker).
// El servidor duplica título, cuerpo y URL en `data` para leerlos aquí.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { data: { title: 'FITMANIA', body: event.data ? event.data.text() : '' } }
  }
  const data = payload.data || {}
  const notification = payload.notification || {}
  const title = data.title || notification.title || 'FITMANIA'
  const options = {
    body: data.body || notification.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || (payload.fcmOptions && payload.fcmOptions.link) || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => new URL(c.url).pathname === target.pathname)
      if (existing) return existing.focus()
      return self.clients.openWindow(target.href)
    })
  )
})
