// Service worker: guarda el juego para jugar sin internet (red primero, caché de respaldo).
const CACHE = 'lifeline-v1';
const CORE = ['./', 'index.html', 'juego.js', 'styles/console.css', 'styles/terminal.css', 'styles/extras.css', 'fonts/VT323-Regular.ttf', 'manifest.webmanifest', 'docs/img/icono.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
