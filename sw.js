// Service worker: lets the game install as a PWA and run offline.
// Bump CACHE_VERSION whenever the precached files change.
const CACHE_VERSION = 'asteroids-v1';

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

// Third-party assets the page loads. Cached best-effort as opaque responses;
// the font files themselves are picked up at runtime on first play.
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com/3.4.17',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_SHELL);
    await Promise.all(CDN_ASSETS.map(async (url) => {
      try {
        const request = new Request(url, { mode: 'no-cors' });
        await cache.put(request, await fetch(request));
      } catch (e) {}
    }));
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
  if (request.method !== 'GET') return;

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
      if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
      return response;
    }).catch(() => cached || Response.error());
    event.waitUntil(refresh);
    return cached || refresh;
  })());
});
