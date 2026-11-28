// Pruebas del toque sobre una notificación en sw.js: se ejecuta el sw.js REAL en un contexto aislado (node:vm) con un
// IndexedDB, un «clients» y un «caches» simulados. Ejecutar con:  node --test tests/sw_avisos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { crearIDB } from './ayuda_idb.mjs';
import { leerToques, borrarToques } from '../js/modules/vida/toques.js';

const codigo = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function cargarSW({ ventanas = [], idb = crearIDB(), retrasoVentanas = 0 } = {}) {
  const oyentes = {}; const abiertas = []; const cacheado = []; const registro = { matchAllEn: null };
  const self = {
    addEventListener: (ev, fn) => { (oyentes[ev] ??= []).push(fn); },
    skipWaiting() { registro.saltado = true; },
    location: { origin: 'https://usuario.github.io' },
    clients: {
      matchAll: async () => { registro.matchAllEn = Date.now(); if (retrasoVentanas) await new Promise((r) => setTimeout(r, retrasoVentanas)); return ventanas; },
      openWindow: async (u) => { abiertas.push(u); }, claim: async () => {}
    }
  };
  const caches = { open: async (n) => ({ addAll: async (l) => { cacheado.push([n, l]); }, put: async () => {} }), keys: async () => [], match: async () => undefined, delete: async () => true };
  const contexto = vm.createContext({ self, caches, indexedDB: idb, URL, encodeURIComponent, setTimeout, Promise, fetch: async () => ({ ok: true, clone() { return this; } }) });
  vm.runInContext(codigo, contexto);
  return { oyentes, abiertas, cacheado, idb, registro };
}

async function tocar(sw, { tag = 'giro180-prueba', data = { tipo: 'prueba', url: './#/vida/avisos' }, action = '' } = {}) {
  let espera; let cerrada = false;
  const ev = { notification: { tag, data, close() { cerrada = true; } }, action, waitUntil(p) { espera = p; } };
  const antes = Date.now();
  sw.oyentes.notificationclick[0](ev);
  await espera;
  return { cerrada, antes, despues: Date.now() };
}
const ventana = ({ falla = false } = {}) => { const v = { mensajes: [], enfocada: false, postMessage(m) { v.mensajes.push(m); }, async focus() { if (falla) throw new Error('no se puede enfocar'); v.enfocada = true; } }; return v; };

test('los manejadores de siempre siguen y el de toque se suma', () => {
  const sw = cargarSW();
  assert.deepEqual(Object.keys(sw.oyentes).sort(), ['activate', 'fetch', 'install', 'notificationclick']);
  assert.equal(sw.oyentes.notificationclick.length, 1);
});

test('install cachea la lista de archivos con el nombre de versión (incluye los archivos de avisos)', async () => {
  const sw = cargarSW(); let espera;
  sw.oyentes.install[0]({ waitUntil(p) { espera = p; } }); await espera;
  assert.equal(sw.registro.saltado, true);
  const [nombre, lista] = sw.cacheado[0];
  assert.match(nombre, /^giro180-v\d+\.\d+\.\d+$/);
  for (const f of ['js/core/avisos.js', 'js/modules/vida/avisos.js', 'js/modules/vida/toques.js', 'js/core/sueno.js']) assert.ok(lista.includes(f), f);
});

test('tocar el aviso: cierra la notificación, guarda la hora del toque, avisa a la ventana abierta y la enfoca', async () => {
  const v = ventana(); const sw = cargarSW({ ventanas: [v] });
  const t = await tocar(sw);
  assert.equal(t.cerrada, true);
  const filas = sw.idb.filas();
  assert.equal(filas.length, 1);
  assert.equal(filas[0].tag, 'giro180-prueba'); assert.equal(filas[0].accion, null); assert.deepEqual(filas[0].datos, { tipo: 'prueba', url: './#/vida/avisos' });
  const ms = Date.parse(filas[0].iso);
  assert.ok(ms >= t.antes && ms <= t.despues, 'la hora guardada es la del toque');
  assert.equal(v.mensajes.length, 1);
  assert.equal(v.mensajes[0].tipo, 'toque-aviso'); assert.equal(v.mensajes[0].iso, filas[0].iso); assert.equal(v.mensajes[0].guardado, true);
  assert.equal(v.enfocada, true);
  assert.deepEqual(sw.abiertas, []);                                                          // no abre otra ventana
});

test('la hora se captura al instante del toque, no después de esperar las ventanas', async () => {
  const sw = cargarSW({ ventanas: [], retrasoVentanas: 60 });
  const t = await tocar(sw);
  const ms = Date.parse(sw.idb.filas()[0].iso);
  assert.ok(ms <= sw.registro.matchAllEn, 'se tomó antes de consultar las ventanas');
  assert.ok(ms >= t.antes && ms < t.antes + 30, 'y es la del toque, no la del final del trabajo');
});

test('con la app cerrada: abre la dirección del aviso; sin dirección o con una ajena usa la de Vida', async () => {
  let sw = cargarSW(); await tocar(sw);
  assert.deepEqual(sw.abiertas, ['./#/vida/avisos']);
  assert.equal(sw.idb.filas().length, 1);
  sw = cargarSW(); await tocar(sw, { data: null });
  assert.deepEqual(sw.abiertas, ['./#/vida']);
  sw = cargarSW(); await tocar(sw, { data: { url: 'https://sitio-ajeno.com/' } });
  assert.deepEqual(sw.abiertas, ['./#/vida']);
  sw = cargarSW(); await tocar(sw, { data: { url: 42 } });
  assert.deepEqual(sw.abiertas, ['./#/vida']);
});

test('si la base local falla y no hay ventana, la hora viaja en la dirección', async () => {
  const idb = crearIDB(); idb.falla.agregar = true;
  const sw = cargarSW({ idb }); const t = await tocar(sw);
  assert.equal(sw.idb.filas().length, 0);
  assert.equal(sw.abiertas.length, 1);
  const m = /^\.\/\?toque=([^#]+)#\/vida\/avisos$/.exec(sw.abiertas[0]);
  assert.ok(m, sw.abiertas[0]);
  const iso = decodeURIComponent(m[1]);
  assert.ok(Date.parse(iso) >= t.antes && Date.parse(iso) <= t.despues);
  assert.equal(new URL('https://x.io/giro180/' + sw.abiertas[0].slice(2)).searchParams.get('toque'), iso);   // la dirección se lee bien
});

test('si no se puede ni abrir la base, igual avisa a la ventana (guardado: false) y no se rompe', async () => {
  const idb = crearIDB(); idb.falla.abrir = true; const v = ventana();
  const sw = cargarSW({ idb, ventanas: [v] }); await tocar(sw);
  assert.equal(v.mensajes[0].guardado, false);
  assert.ok(v.mensajes[0].iso);
  assert.deepEqual(sw.abiertas, []);
});

test('si la ventana no se puede enfocar, no falla', async () => {
  const v = ventana({ falla: true }); const sw = cargarSW({ ventanas: [v] });
  await assert.doesNotReject(() => tocar(sw));
  assert.equal(sw.idb.filas().length, 1);
});

test('toques repetidos se guardan todos, con la acción si la hubiera; la pantalla los lee y los borra', async () => {
  const sw = cargarSW({ ventanas: [ventana()] });
  await tocar(sw); await tocar(sw, { tag: 'otro', action: 'levantarme' });
  assert.deepEqual(sw.idb.filas().map((f) => [f.id, f.tag, f.accion]), [[1, 'giro180-prueba', null], [2, 'otro', 'levantarme']]);
  const previo = globalThis.indexedDB; globalThis.indexedDB = sw.idb;                         // la pantalla usa el mismo IndexedDB
  try {
    const leidos = await leerToques();
    assert.deepEqual(leidos.map((f) => f.tag), ['giro180-prueba', 'otro']);
    await borrarToques();
    assert.deepEqual(await leerToques(), []);
  } finally { globalThis.indexedDB = previo; }
  assert.ok([...sw.idb.bases.values()][0].almacenes.get('toques').opts.autoIncrement);
});
