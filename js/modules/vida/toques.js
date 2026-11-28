// Vida → Avisos: lectura de los toques que guardó el service worker (IndexedDB «giro180-avisos»). Lanza error si algo falla.
// La base y su almacén los crea quien abra primero (sw.js o esta pantalla) con la misma definición (DB_AVISOS).
import { DB_AVISOS } from '../../core/avisos.js';

function abrir() {
  return new Promise((resolver, rechazar) => {
    if (typeof indexedDB === 'undefined') { rechazar(new Error('Este navegador no guarda datos locales (IndexedDB).')); return; }
    const r = indexedDB.open(DB_AVISOS.nombre, DB_AVISOS.version);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(DB_AVISOS.almacen)) r.result.createObjectStore(DB_AVISOS.almacen, { keyPath: 'id', autoIncrement: true });
    };
    r.onsuccess = () => resolver(r.result);
    r.onerror = () => rechazar(r.error ?? new Error('No se pudo abrir la base local.'));
  });
}

export async function leerToques() {
  const db = await abrir();
  try {
    return await new Promise((resolver, rechazar) => {
      const rq = db.transaction(DB_AVISOS.almacen, 'readonly').objectStore(DB_AVISOS.almacen).getAll();
      rq.onsuccess = () => resolver(rq.result ?? []);
      rq.onerror = () => rechazar(rq.error);
    });
  } finally { db.close(); }
}

export async function borrarToques() {
  const db = await abrir();
  try {
    await new Promise((resolver, rechazar) => {
      const tx = db.transaction(DB_AVISOS.almacen, 'readwrite');
      tx.objectStore(DB_AVISOS.almacen).clear();
      tx.oncomplete = () => resolver();
      tx.onerror = () => rechazar(tx.error);
      tx.onabort = () => rechazar(tx.error);
    });
  } finally { db.close(); }
}

// Si el service worker no pudo guardar el toque, la hora viaja en la dirección (?toque=...). Se lee y se limpia la dirección.
export function toqueDeLaDireccion() {
  const valor = new URLSearchParams(location.search).get('toque');
  if (!valor) return null;
  history.replaceState(null, '', location.pathname + location.hash);
  return Number.isNaN(Date.parse(valor)) ? null : new Date(Date.parse(valor)).toISOString();
}
