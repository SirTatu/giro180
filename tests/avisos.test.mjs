// Pruebas de js/core/avisos.js (ejemplos inventados, horas de Argentina = UTC-3).
// Ejecutar con:  node --test tests/avisos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DB_AVISOS, TAG_PRUEBA, URL_AVISOS, ESPERA_PRUEBA_SEG, diagnosticar, puedePedirPermiso, textoRetraso, armarAvisoPrueba,
  formatoHace, resumenToques
} from '../js/core/avisos.js';
import { horaSegundos } from '../js/core/sueno.js';

const listo = { esIOS: true, instalada: true, tieneSW: true, swActivo: true, tieneNotification: true, permiso: 'granted', tienePush: true };
const estado = (d, id) => d.filas.find((f) => f.id === id).estado;

test('horaSegundos: hora de Argentina con segundos', () => {
  assert.equal(horaSegundos('2026-03-11T10:10:07Z'), '07:10:07');
  assert.equal(horaSegundos('2026-03-11T02:59:59.999Z'), '23:59:59');
  assert.equal(horaSegundos('basura'), null);
  assert.equal(horaSegundos(null), null);
});

test('diagnosticar: todo listo', () => {
  const d = diagnosticar(listo);
  assert.deepEqual(d.filas.map((f) => f.estado), ['ok', 'ok', 'ok', 'ok', 'ok']);
  assert.deepEqual(d.veredicto, { listo: true, codigo: 'listo', texto: 'Todo listo: ya podés mostrar un aviso de prueba.' });
});

test('diagnosticar: iPhone en Safari (no instalada) no está listo y explica cómo instalarla', () => {
  const d = diagnosticar({ ...listo, instalada: false, permiso: 'default' });
  assert.equal(estado(d, 'instalada'), 'mal');
  assert.match(d.filas[0].detalle, /Añadir a pantalla de inicio/);
  assert.equal(d.veredicto.codigo, 'sin-instalar');
  assert.equal(d.veredicto.listo, false);
});

test('diagnosticar: en un navegador que no es iPhone, no estar instalada es solo un aviso', () => {
  const d = diagnosticar({ ...listo, esIOS: false, instalada: false });
  assert.equal(estado(d, 'instalada'), 'aviso');
  assert.equal(d.veredicto.listo, true);
});

test('diagnosticar: cada bloqueo da su propio veredicto, en orden de prioridad', () => {
  const v = (o) => diagnosticar({ ...listo, ...o }).veredicto.codigo;
  assert.equal(v({ tieneNotification: false, permiso: null }), 'sin-notificaciones');
  assert.equal(v({ instalada: false, tieneSW: false }), 'sin-instalar');                 // instalar primero
  assert.equal(v({ tieneSW: false, swActivo: false }), 'sin-sw');
  assert.equal(v({ instalada: false, permiso: 'denied' }), 'sin-instalar');             // el permiso bloqueado no tapa que falta instalar
  assert.equal(v({ swActivo: false, permiso: 'denied' }), 'sin-sw');
  assert.equal(v({ swActivo: false }), 'sin-sw');
  assert.equal(v({ permiso: 'denied' }), 'bloqueado');
  assert.equal(v({ permiso: 'default' }), 'falta-permiso');
  assert.equal(v({ permiso: null }), 'falta-permiso');
  assert.equal(estado(diagnosticar({ ...listo, permiso: 'denied' }), 'permiso'), 'mal');
  assert.match(diagnosticar({ ...listo, permiso: 'denied' }).filas.find((f) => f.id === 'permiso').detalle, /Ajustes del iPhone/);
  assert.equal(estado(diagnosticar({ ...listo, permiso: 'default' }), 'permiso'), 'aviso');
  assert.equal(estado(diagnosticar({ ...listo, swActivo: false }), 'sw'), 'aviso');
  assert.equal(estado(diagnosticar({ ...listo, tieneSW: false, swActivo: false }), 'sw'), 'mal');
  assert.equal(estado(diagnosticar({ ...listo, tienePush: false }), 'push'), 'aviso');
});

test('puedePedirPermiso', () => {
  assert.equal(puedePedirPermiso({ ...listo, permiso: 'default' }), true);
  assert.equal(puedePedirPermiso({ ...listo, permiso: 'granted' }), false);
  assert.equal(puedePedirPermiso({ ...listo, permiso: 'denied' }), false);
  assert.equal(puedePedirPermiso({ ...listo, permiso: 'default', instalada: false }), false);                 // iPhone sin instalar: no deja
  assert.equal(puedePedirPermiso({ ...listo, permiso: 'default', instalada: false, esIOS: false }), true);    // otro navegador: sí
  assert.equal(puedePedirPermiso({ ...listo, permiso: null, tieneNotification: false }), false);
});

test('textoRetraso y armarAvisoPrueba', () => {
  const pedido = '2026-03-11T10:00:00Z';
  assert.equal(textoRetraso(pedido, '2026-03-11T10:00:04Z'), '');                         // menos de 5 s: normal
  assert.equal(textoRetraso(pedido, '2026-03-11T10:00:20Z'), '20 s');
  assert.equal(textoRetraso(pedido, '2026-03-11T10:02:00Z'), '2 min');
  assert.equal(textoRetraso(pedido, '2026-03-11T11:30:00Z'), '1 h 30 min');
  assert.equal(textoRetraso('basura', pedido), '');
  const puntual = armarAvisoPrueba({ programadaISO: pedido, mostradaISO: '2026-03-11T10:00:01Z' });
  assert.equal(puntual.titulo, 'Aviso de prueba');
  assert.equal(puntual.opciones.body, 'Pedido y mostrado a las 07:00:01. Tocalo para probar el toque.');
  assert.equal(puntual.opciones.tag, TAG_PRUEBA);
  assert.deepEqual(puntual.opciones.data, { tipo: 'prueba', url: URL_AVISOS, programada: pedido, mostrada: '2026-03-11T10:00:01Z' });
  const tarde = armarAvisoPrueba({ programadaISO: pedido, mostradaISO: '2026-03-11T10:03:00Z' });
  assert.equal(tarde.opciones.body, 'Pedido a las 07:00:00, mostrado a las 07:03:00 (llegó 3 min tarde). Tocalo para probar el toque.');
  assert.ok(URL_AVISOS.startsWith('./#/'));                                                // lo exige sw.js para aceptar la dirección
  assert.equal(ESPERA_PRUEBA_SEG, 20);
});

test('formatoHace y resumenToques: más recientes primero, hasta 5, ignora basura', () => {
  const ahora = '2026-03-11T10:10:00Z';
  assert.equal(formatoHace(ahora, '2026-03-11T10:09:30Z'), 'hace 30 s');
  assert.equal(formatoHace(ahora, '2026-03-11T10:07:00Z'), 'hace 3 min');
  assert.equal(formatoHace(ahora, '2026-03-11T08:10:00Z'), 'hace 2 h');
  assert.equal(formatoHace(ahora, '2026-03-11T10:11:00Z'), '');                           // del futuro (reloj raro): no se inventa
  assert.equal(formatoHace(ahora, 'basura'), '');
  const toques = [
    { id: 1, iso: '2026-03-11T10:07:00Z', tag: TAG_PRUEBA },
    { id: 2, iso: '2026-03-11T10:09:30Z', tag: 'otro' },
    { id: 3, iso: 'basura', tag: 'x' },
    { id: 4, iso: '2026-03-11T10:08:00Z', tag: null }
  ];
  assert.deepEqual(resumenToques(toques, ahora), [
    '07:09:30 · otro · hace 30 s', '07:08:00 · sin etiqueta · hace 2 min', '07:07:00 · aviso de prueba · hace 3 min'
  ]);
  const siete = Array.from({ length: 7 }, (_, i) => ({ iso: `2026-03-11T10:0${i}:00Z`, tag: TAG_PRUEBA }));
  assert.equal(resumenToques(siete, ahora).length, 5);
  assert.equal(resumenToques(siete, ahora, 2).length, 2);
  assert.deepEqual(resumenToques([], ahora), []);
  assert.deepEqual(resumenToques(null, ahora), []);
});

test('sw.js usa la misma base local que js/core/avisos.js', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const m = /const DB_AVISOS = \{ nombre: '([^']+)', version: (\d+), almacen: '([^']+)' \};/.exec(sw);
  assert.ok(m, 'no se encontró DB_AVISOS en sw.js');
  assert.deepEqual({ nombre: m[1], version: Number(m[2]), almacen: m[3] }, DB_AVISOS);
});
