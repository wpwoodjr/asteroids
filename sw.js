// Service worker: lets the game install as a PWA and run offline.
// Bump CACHE_VERSION whenever the precached files change.
const CACHE_VERSION = 'asteroids-v3';

const APP_SHELL = [
  './',
  './index.html',
  './asteroids.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // The game loads nothing from other sites; leave any such request to the browser
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Pages: network first so updates show up right away, cache when offline
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch (e) {
        return (await cache.match(request, { ignoreSearch: true })) ||
               (await cache.match('./asteroids.html'));
      }
    })());
    return;
  }

  // Everything else: serve from cache, refresh in the background
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    const refresh = fetch(request).then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }).catch(() => cached || Response.error());
    event.waitUntil(refresh);
    return cached || refresh;
  })());
});
