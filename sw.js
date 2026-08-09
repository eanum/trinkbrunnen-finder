const CACHE_NAME = 'trinkbrunnen-v10';
const APP_SHELL = [
  './',
  './index.html',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isTile = /tile\.openstreetmap\.org$/.test(url.hostname);

  if (isTile) {
    // Kartenkacheln: einmal online gesehen, danach auch offline verfügbar.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          // Tile-Requests von <img> laufen im no-cors-Modus -> "opake" Response
          // (resp.ok ist dabei immer false, auch bei Erfolg). Trotzdem cachen,
          // solange es überhaupt eine Antwort gab (type 'opaque' oder 'basic'/'cors' ok).
          if (resp.type === 'opaque' || resp.ok) {
            cache.put(event.request, resp.clone());
          }
          return resp;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  const isPage = event.request.mode === 'navigate' ||
    (event.request.method === 'GET' && url.origin === self.location.origin &&
      (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')));

  if (isPage) {
    // Die Seite selbst: erst Netz (damit Updates sofort ankommen), Cache nur als Offline-Fallback.
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    // Statische Assets (Leaflet, Manifest): ändern sich selten, cache-first reicht.
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
  // Overpass-Anfragen (POST, fremde Origin) werden nicht abgefangen -> immer live.
});
