/** Titan Protection — lightweight service worker (offline shell + static cache). */
const CACHE = 'titan-pwa-v2';
const PRECACHE = ['/', '/emblem-wordmark.png', '/emblem-light.jpg', '/icons/icon-192.png', '/icons/icon-512.png'];

/** Never cache APKs, version manifest, or the downloads page — always fetch fresh. */
function isUncachedPath(pathname) {
  return pathname === '/downloads'
    || pathname.startsWith('/downloads/')
    || pathname.startsWith('/api/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isUncachedPath(url.pathname)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
