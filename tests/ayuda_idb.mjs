// Ayuda para las pruebas (no es una prueba): un IndexedDB simulado en memoria. Soporta solo lo que usan sw.js y vida/toques.js:
// open (con onupgradeneeded), transaction, objectStore, add, getAll, clear, oncomplete, close. «falla» permite simular errores.
const clonar = (v) => structuredClone(v);
export function crearIDB() {
  const bases = new Map();
  const idb = { bases, falla: { abrir: false, agregar: false }, aperturas: 0 };
  idb.open = (nombre, version) => {
    const rq = { result: null, error: null };
    idb.aperturas++;
    setTimeout(() => {
      if (idb.falla.abrir) { rq.error = new Error('No se pudo abrir la base (simulado)'); rq.onerror?.(); return; }
      let b = bases.get(nombre); const nueva = !b;
      if (!b) { b = { version, almacenes: new Map() }; bases.set(nombre, b); }
      const db = {
        cerrada: false,
        objectStoreNames: { contains: (n) => b.almacenes.has(n) },
        createObjectStore(n, opts) { b.almacenes.set(n, { opts, filas: [], seq: 0 }); return {}; },
        close() { db.cerrada = true; },
        transaction(n) {
          const alm = b.almacenes.get(n);
          const tx = { error: null };
          const op = (fn) => {
            const r = { result: undefined, error: null };
            setTimeout(() => { try { fn(r); r.onsuccess?.(); } catch (e) { r.error = e; tx.error = e; r.onerror?.(); tx.onerror?.(); tx.onabort?.(); } }, 0);
            return r;
          };
          tx.objectStore = () => ({
            add: (v) => op((r) => { if (idb.falla.agregar) throw new Error('No se pudo guardar (simulado)'); const fila = { ...clonar(v), id: ++alm.seq }; alm.filas.push(fila); r.result = fila.id; }),
            getAll: () => op((r) => { r.result = clonar(alm.filas); }),
            clear: () => op(() => { alm.filas.length = 0; })
          });
          setTimeout(() => { if (!tx.error) tx.oncomplete?.(); }, 5);
          return tx;
        }
      };
      rq.result = db;
      if (nueva) rq.onupgradeneeded?.();
      rq.onsuccess?.();
    }, 0);
    return rq;
  };
  idb.filas = (nombre = 'giro180-avisos', almacen = 'toques') => bases.get(nombre)?.almacenes.get(almacen)?.filas ?? [];
  return idb;
}
