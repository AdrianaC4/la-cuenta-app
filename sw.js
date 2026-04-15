// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Service Worker (PWA)
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'la-cuenta-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/state.js',
  './js/api.js',
  './js/ui.js',
  './js/cobro.js',
  './js/app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // No cachear llamadas a la API de Anthropic
  if (event.request.url.includes('anthropic.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
