// Service Worker de Giro 180
// Al cambiar archivos de la app, subí el número de VERSION para forzar la actualización.
const VERSION = 'giro180-v0.22.0';
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
  'js/core/agua.js',
  'js/core/areas.js',
  'js/core/alimentos.js',
  'js/core/macros.js',
  'js/core/sueno.js',
  'js/core/avisos.js',
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
  'js/modules/nutri/agua.js',
  'js/modules/nutri/alimentos.js',
  'js/modules/nutri/objetivos.js',
  'js/modules/nutri/botellas.js',
  'js/modules/vida/index.js',
  'js/modules/vida/datos.js',
  'js/modules/vida/sueno.js',
  'js/modules/vida/toques.js',
  'js/modules/vida/avisos.js',
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

// ---------- Avisos (hito 4-1b): toque sobre una notificación ----------
// ADITIVO: no cambia nada de lo de arriba. Cuando tocás una notificación de la app, ACÁ se captura la hora del toque (el instante
// exacto, aunque la app esté cerrada), se guarda en una base local (IndexedDB) y se abre o enfoca la app.
// Estos valores repiten DB_AVISOS de js/core/avisos.js (una prueba verifica que coincidan).
const DB_AVISOS = { nombre: 'giro180-avisos', version: 1, almacen: 'toques' };

function abrirAvisos() {
  return new Promise((resolver, rechazar) => {
    const r = indexedDB.open(DB_AVISOS.nombre, DB_AVISOS.version);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(DB_AVISOS.almacen)) r.result.createObjectStore(DB_AVISOS.almacen, { keyPath: 'id', autoIncrement: true });
    };
    r.onsuccess = () => resolver(r.result);
    r.onerror = () => rechazar(r.error);
  });
}

async function guardarToque(toque) {
  const db = await abrirAvisos();
  try {
    await new Promise((resolver, rechazar) => {
      const tx = db.transaction(DB_AVISOS.almacen, 'readwrite');
      tx.objectStore(DB_AVISOS.almacen).add(toque);
      tx.oncomplete = () => resolver();
      tx.onerror = () => rechazar(tx.error);
      tx.onabort = () => rechazar(tx.error);
    });
  } finally { db.close(); }
}

self.addEventListener('notificationclick', (e) => {
  const iso = new Date().toISOString();                 // la hora se toma en el instante del toque, antes de cualquier otra cosa
  const n = e.notification;
  n.close();
  e.waitUntil((async () => {
    const datos = n.data ?? null;
    const toque = { iso, tag: n.tag || null, accion: e.action || null, datos };
    let guardado = true;
    try { await guardarToque(toque); } catch (err) { guardado = false; }
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) v.postMessage({ tipo: 'toque-aviso', ...toque, guardado });
    if (ventanas.length) {
      try { await ventanas[0].focus(); } catch (err) { /* si no se puede enfocar, el sistema igual abre la app */ }
      return;
    }
    const destino = typeof datos?.url === 'string' && datos.url.startsWith('./#/') ? datos.url : './#/vida';
    // Si la base falló y no hay ventana para avisarle, la hora viaja en la dirección para no perderse.
    await self.clients.openWindow(guardado ? destino : `./?toque=${encodeURIComponent(iso)}${destino.slice(2)}`);
  })());
});
