// Service Worker de Giro 180
// Al cambiar archivos de la app, subí el número de VERSION para forzar la actualización.
const VERSION = 'giro180-v0.12.0';
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
  'js/version.js',
  'js/core/constantes.js',
  'js/core/fechas.js',
  'js/core/estados.js',
  'js/core/informes.js',
  'js/core/exportar.js',
  'js/core/dom.js',
  'js/core/gym.js',
  'js/core/entrenos.js',
  'js/core/cuerpo.js',
  'js/core/nutri.js',
  'js/modules/central/index.js',
  'js/modules/central/datos.js',
  'js/modules/central/hoy.js',
  'js/modules/central/semana.js',
  'js/modules/central/informes.js',
  'js/modules/central/exportar.js',
  'js/modules/central/habitos.js',
  'js/modules/central/ajustes.js',
  'js/modules/central/panel.js',
  'js/modules/central/plan.js',
  'js/modules/central/prioridades.js',
  'js/modules/central/objetivos.js',
  'js/modules/central/compromisos.js',
  'js/modules/central/decisiones.js',
  'js/modules/compartido/habitos.js',
  'js/modules/nutri/index.js',
  'js/modules/nutri/datos.js',
  'js/modules/nutri/ui.js',
  'js/modules/nutri/hoy.js',
  'js/modules/nutri/historial.js',
  'js/modules/gym/index.js',
  'js/modules/gym/datos.js',
  'js/modules/gym/ui.js',
  'js/modules/gym/rutinas.js',
  'js/modules/gym/ejercicios.js',
  'js/modules/gym/importar.js',
  'js/modules/gym/entrenar.js',
  'js/modules/gym/historial.js',
  'js/modules/gym/pasos.js',
  'js/modules/gym/cuerpo.js',
  'js/modules/compartido/medidas.js',
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
