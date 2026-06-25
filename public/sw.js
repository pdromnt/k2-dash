// K2 Dash — offline-capable service worker.
// Caches all static assets so the PWA loads when the printer is offline.
// index.html IS cached (cache-first). After a deploy, users need to reload
// twice or wait for the SW update lifecycle to pick up new hashed assets.
// The Vue app detects lost connectivity and shows its own offline screen.

const CACHE = 'k2dash-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/creality.png',
        '/manifest.json',
        '/sw.js',
      ])
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Purge old cache versions
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    })
  )
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Never cache API calls — always go to network
  if (url.pathname.startsWith('/api/')) return

  // Cache-then-network for everything else (HTML, JS, CSS, fonts, icons)
  event.respondWith(
    caches.open(CACHE).then((cache) => {
      return cache.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone())
          return response
        })
        return cached || fetched
      })
    })
  )
})
