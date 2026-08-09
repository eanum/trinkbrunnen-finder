const CACHE_NAME = 'trinkbrunnen-v9';
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

  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    // App-Shell: aus dem Cache, damit die Seite auch ohne Netz startet.
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
  // Overpass-Anfragen (POST, fremde Origin) werden nicht abgefangen -> immer live.
});
