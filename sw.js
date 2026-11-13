// Service Worker de Giro 180
// Al cambiar archivos de la app, subí el número de VERSION para forzar la actualización.
const VERSION = 'giro180-v0.2.0';
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'js/main.js',
  'js/config.js',
  'js/supabase.js',
  'js/auth.js',
  'js/router.js',
  'js/views/login.js',
  'js/views/shell.js',
  'js/modules/registry.js',
  'js/modules/central/index.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero (código siempre fresco); sin conexión usa la copia guardada.
// Solo toca archivos propios y la librería del CDN. Las llamadas a Supabase (datos) NUNCA se cachean.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const permitido = url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net';
  if (req.method !== 'GET' || !permitido) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
