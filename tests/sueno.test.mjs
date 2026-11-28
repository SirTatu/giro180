// Pruebas de js/core/sueno.js (ejemplos inventados, calculados a mano en hora de Argentina = UTC-3).
// Ejecutar con:  node --test tests/sueno.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  instanteALocal, localAInstante, fechaDeInstante, horaTexto, etiquetaInstante, limitesDelDia, minutosEntre, formatoDuracion,
  duracionMin, sesionAbierta, validarSesion, formularioDeSesion, decidirInicio, decidirFin,
  resumenDia, MAX_HORAS, MAX_NOTA
} from '../js/core/sueno.js';
import { traducirError } from '../js/core/gym.js';

// Registros de ejemplo (hora local de Argentina entre paréntesis):
const noche = { id: 'n1', kind: 'night', started_at: '2026-03-11T02:40:00Z', ended_at: '2026-03-11T10:10:00Z', note: null };   // 10/3 23:40 -> 11/3 07:10 = 450 min
const siesta = { id: 's1', kind: 'nap', started_at: '2026-03-11T18:00:00Z', ended_at: '2026-03-11T18:45:00Z', note: null };     // 11/3 15:00 -> 15:45 = 45 min
const nocheAnterior = { id: 'n0', kind: 'night', started_at: '2026-03-10T02:30:00Z', ended_at: '2026-03-10T09:30:00Z', note: null }; // 9/3 23:30 -> 10/3 06:30 = 420 min
const AHORA = '2026-03-11T20:00:00Z';                                                                                                // 11/3 17:00

test('horas: ida y vuelta entre hora de Argentina e instante', () => {
  assert.equal(localAInstante('2026-03-10T23:40'), '2026-03-11T02:40:00.000Z');
  assert.equal(localAInstante('2026-03-10T23:40:00'), '2026-03-11T02:40:00.000Z');          // acepta segundos
  assert.equal(instanteALocal('2026-03-11T02:40:00.000Z'), '2026-03-10T23:40');
  assert.equal(instanteALocal(localAInstante('2026-12-31T23:59')), '2026-12-31T23:59');
  assert.equal(fechaDeInstante('2026-03-11T02:59:00Z'), '2026-03-10');                      // 23:59 del 10
  assert.equal(fechaDeInstante('2026-03-11T03:00:00Z'), '2026-03-11');                      // 00:00 del 11
  assert.equal(horaTexto('2026-03-11T10:10:00Z'), '07:10');
  assert.equal(etiquetaInstante('2026-03-11T14:00:00Z'), '11/3 11:00');
  for (const malo of ['', null, undefined, 'abc', '2026-02-30T10:00', '2026-03-10T25:00', '2026-03-10 23:40', '2026-03-10']) {
    assert.equal(localAInstante(malo), null, String(malo));
  }
  assert.equal(instanteALocal('basura'), null);
  assert.equal(fechaDeInstante(null), null);
  assert.equal(etiquetaInstante('basura'), '');
});

test('límites de un día de Argentina', () => {
  assert.deepEqual(limitesDelDia('2026-03-10'), { desde: '2026-03-10T03:00:00.000Z', hasta: '2026-03-11T03:00:00.000Z' });
  assert.deepEqual(limitesDelDia('2026-12-31'), { desde: '2026-12-31T03:00:00.000Z', hasta: '2027-01-01T03:00:00.000Z' });
});

test('duraciones y formato', () => {
  assert.equal(minutosEntre(noche.started_at, noche.ended_at), 450);
  assert.equal(minutosEntre(null, noche.ended_at), null);
  assert.equal(minutosEntre('basura', noche.ended_at), null);
  assert.equal(formatoDuracion(450), '7 h 30 min');
  assert.equal(formatoDuracion(480), '8 h');
  assert.equal(formatoDuracion(60), '1 h');
  assert.equal(formatoDuracion(59), '59 min');
  assert.equal(formatoDuracion(45), '45 min');
  assert.equal(formatoDuracion(0), '0 min');
  assert.equal(formatoDuracion(null), 'sin dato');
  assert.equal(formatoDuracion(undefined), 'sin dato');
  assert.equal(duracionMin(noche), 450);
  const abierta = { kind: 'night', started_at: '2026-03-11T14:00:00Z', ended_at: null };
  assert.equal(duracionMin(abierta), null);                                                  // en curso sin «ahora»: no se inventa
  assert.equal(duracionMin(abierta, AHORA), 360);                                            // 11:00 -> 17:00
});

test('sesionAbierta', () => {
  const abierta = { id: 'a', kind: 'night', started_at: '2026-03-11T14:00:00Z', ended_at: null };
  assert.equal(sesionAbierta([noche, abierta, siesta]).id, 'a');
  assert.equal(sesionAbierta([noche, siesta]), null);
  assert.equal(sesionAbierta([]), null);
  assert.equal(sesionAbierta(null), null);
});

test('validarSesion: caso correcto', () => {
  const r = validarSesion({ tipo: 'night', inicio: '2026-03-10T23:40', fin: '2026-03-11T07:10', nota: '  dormí bien  ' }, { ahora: AHORA });
  assert.equal(r.error, null);
  assert.deepEqual(r.datos, { kind: 'night', started_at: '2026-03-11T02:40:00.000Z', ended_at: '2026-03-11T10:10:00.000Z', note: 'dormí bien' });
  assert.equal(validarSesion({ tipo: 'nap', inicio: '2026-03-11T15:00', fin: '2026-03-11T15:45', nota: '   ' }, { ahora: AHORA }).datos.note, null);
});

test('validarSesion: errores de tipo, formato y orden', () => {
  const v = (o) => validarSesion({ tipo: 'night', inicio: '2026-03-10T23:40', fin: '2026-03-11T07:10', nota: '', ...o }, { ahora: AHORA });
  assert.match(v({ tipo: 'x' }).error, /noche o siesta/);
  assert.match(v({ tipo: '' }).error, /noche o siesta/);
  assert.match(v({ inicio: '' }).error, /Completá la hora de inicio/);
  assert.match(v({ inicio: 'basura' }).error, /inicio no es válida/);
  assert.match(v({ fin: '' }).error, /Completá la hora de fin/);
  assert.match(v({ fin: '2026-02-30T10:00' }).error, /fin no es válida/);
  assert.match(v({ fin: '2026-03-10T23:40' }).error, /posterior/);                           // fin == inicio
  assert.match(v({ fin: '2026-03-10T22:00' }).error, /posterior/);                           // fin antes del inicio
  for (const r of [v({ tipo: 'x' }), v({ inicio: '' })]) assert.equal(r.datos, null);
  assert.match(validarSesion({ tipo: 'night', inicio: '2026-03-10T23:40', fin: '2026-03-11T07:10' }, { ahora: 'basura' }).error, /hora del dispositivo/);
});

test('validarSesion: límite de 24 horas y de la nota', () => {
  const v = (inicio, fin, nota = '') => validarSesion({ tipo: 'night', inicio, fin, nota }, { ahora: AHORA });
  assert.equal(MAX_HORAS, 24);
  assert.equal(v('2026-03-09T10:00', '2026-03-10T10:00').error, null);                       // justo 24 h: se acepta
  assert.match(v('2026-03-09T10:00', '2026-03-10T10:01').error, /más de 24 horas/);          // 24 h 1 min: no
  assert.equal(MAX_NOTA, 500);
  assert.equal(v('2026-03-10T23:40', '2026-03-11T07:10', 'x'.repeat(500)).error, null);
  assert.match(v('2026-03-10T23:40', '2026-03-11T07:10', 'x'.repeat(501)).error, /500 caracteres/);
});

test('validarSesion: nada en el futuro (con un minuto de tolerancia)', () => {
  const v = (inicio, fin) => validarSesion({ tipo: 'nap', inicio, fin, nota: '' }, { ahora: AHORA });   // ahora = 11/3 17:00 local
  assert.equal(v('2026-03-11T16:00', '2026-03-11T17:00').error, null);                       // fin == ahora
  assert.equal(v('2026-03-11T16:00', '2026-03-11T17:01').error, null);                       // ahora + 60 s: tolerado
  assert.match(v('2026-03-11T16:00', '2026-03-11T17:02').error, /fin no puede estar en el futuro/);
  assert.match(v('2026-03-12T01:00', '2026-03-12T02:00').error, /inicio no puede estar en el futuro/);
});

test('validarSesion: no se superpone con otros registros (pero pegados sí)', () => {
  const v = (inicio, fin, ops = {}) => validarSesion({ tipo: 'nap', inicio, fin, nota: '' }, { ahora: AHORA, otras: [noche, siesta], ...ops });
  const r = v('2026-03-11T06:00', '2026-03-11T08:00');                                       // pisa el final de la noche (hasta 07:10)
  assert.match(r.error, /Se superpone con otro registro de sueño \(Noche de 10\/3 23:40 a 11\/3 07:10\)/);
  assert.equal(v('2026-03-11T07:10', '2026-03-11T08:00').error, null);                       // empieza justo cuando termina la noche
  assert.equal(v('2026-03-11T14:00', '2026-03-11T15:00').error, null);                       // termina justo cuando empieza la siesta
  assert.match(v('2026-03-11T14:30', '2026-03-11T15:10').error, /Siesta de 11\/3 15:00 a 11\/3 15:45/);
  assert.equal(v('2026-03-11T06:00', '2026-03-11T08:00', { idActual: 'n1' }).error, null);   // editando la propia noche no choca consigo misma
  // Un registro en curso cuenta hasta ahora
  const abierta = { id: 'a', kind: 'nap', started_at: '2026-03-11T14:00:00Z', ended_at: null };   // desde 11:00
  const r2 = validarSesion({ tipo: 'nap', inicio: '2026-03-11T12:00', fin: '2026-03-11T13:00', nota: '' }, { ahora: AHORA, otras: [abierta] });
  assert.match(r2.error, /en curso/);
});

test('validarSesion: al corregir un registro en curso el fin puede quedar vacío', () => {
  const abierta = { id: 'a', kind: 'night', started_at: '2026-03-11T14:00:00Z', ended_at: null };
  const r = validarSesion({ tipo: 'night', inicio: '2026-03-11T10:30', fin: '', nota: '' }, { ahora: AHORA, otras: [abierta], idActual: 'a', permitirAbierta: true });
  assert.equal(r.error, null);
  assert.equal(r.datos.ended_at, null);
  assert.equal(r.datos.started_at, '2026-03-11T13:30:00.000Z');
  assert.match(validarSesion({ tipo: 'night', inicio: '2026-03-11T10:30', fin: '' }, { ahora: AHORA }).error, /Completá la hora de fin/);   // sin permiso: exige fin
});

test('formularioDeSesion devuelve lo que el formulario necesita', () => {
  assert.deepEqual(formularioDeSesion({ ...noche, note: 'x' }), { tipo: 'night', inicio: '2026-03-10T23:40', fin: '2026-03-11T07:10', nota: 'x' });
  assert.deepEqual(formularioDeSesion({ kind: 'nap', started_at: '2026-03-11T18:00:00Z', ended_at: null, note: null }), { tipo: 'nap', inicio: '2026-03-11T15:00', fin: '', nota: '' });
});

test('decidirInicio: toma la hora de ahora y no deja dos en curso', () => {
  const r = decidirInicio({ tipo: 'night', ahora: '2026-03-11T02:40:12.345Z', sesiones: [noche] });
  assert.equal(r.error, null);
  assert.deepEqual(r.datos, { kind: 'night', started_at: '2026-03-11T02:40:12.345Z' });
  const abierta = { id: 'a', kind: 'night', started_at: '2026-03-11T14:00:00Z', ended_at: null };
  assert.match(decidirInicio({ tipo: 'nap', ahora: AHORA, sesiones: [abierta] }).error, /Ya hay un registro en curso desde 11\/3 11:00/);
  assert.match(decidirInicio({ tipo: 'x', ahora: AHORA, sesiones: [] }).error, /noche o siesta/);
  assert.match(decidirInicio({ tipo: 'night', ahora: 'basura', sesiones: [] }).error, /hora del dispositivo/);
});

test('decidirFin: calcula la duración y se protege de casos raros', () => {
  const abierta = { id: 'a', kind: 'night', started_at: '2026-03-11T02:40:00Z', ended_at: null };
  const r = decidirFin({ sesion: abierta, ahora: '2026-03-11T10:10:00Z' });
  assert.equal(r.error, null);
  assert.deepEqual(r.datos, { ended_at: '2026-03-11T10:10:00.000Z' });
  assert.equal(r.minutos, 450);
  assert.match(decidirFin({ sesion: noche, ahora: AHORA }).error, /No hay un registro en curso/);   // ya cerrado
  assert.match(decidirFin({ sesion: null, ahora: AHORA }).error, /No hay un registro en curso/);
  assert.match(decidirFin({ sesion: abierta, ahora: abierta.started_at }).error, /anterior al inicio/);   // mismo instante: la base exigiría fin > inicio
  assert.match(decidirFin({ sesion: abierta, ahora: '2026-03-11T01:00:00Z' }).error, /anterior al inicio/);
  assert.equal(decidirFin({ sesion: abierta, ahora: '2026-03-12T02:40:00Z' }).error, null);          // justo 24 h
  const larga = decidirFin({ sesion: abierta, ahora: '2026-03-12T02:41:00Z' });                       // 24 h 1 min
  assert.match(larga.error, /Pasaron más de 24 horas desde que empezó \(10\/3 23:40\).*Corregir/);
  assert.equal(larga.datos, null);
  assert.match(decidirFin({ sesion: abierta, ahora: 'basura' }).error, /hora del dispositivo/);
});

test('resumenDia: suma noche y siestas por el día en que terminaron; sin registros es null, nunca 0', () => {
  const todo = [noche, siesta, nocheAnterior, { id: 'a', kind: 'nap', started_at: '2026-03-11T19:00:00Z', ended_at: null }];
  const r = resumenDia(todo, '2026-03-11');
  assert.equal(r.cantidad, 2);                                                               // el registro en curso no cuenta
  assert.equal(r.noche_min, 450);
  assert.equal(r.siesta_min, 45);
  assert.equal(r.total_min, 495);
  assert.deepEqual(r.sesiones.map((s) => s.id), ['n1', 's1']);                               // ordenadas por inicio
  const solo = resumenDia([nocheAnterior], '2026-03-10');
  assert.deepEqual([solo.noche_min, solo.siesta_min, solo.total_min], [420, null, 420]);     // sin siestas: null, no 0
  const vacio = resumenDia(todo, '2026-03-12');
  assert.deepEqual([vacio.cantidad, vacio.noche_min, vacio.siesta_min, vacio.total_min], [0, null, null, null]);
  assert.deepEqual(resumenDia(null, '2026-03-11').sesiones, []);
  // Dos siestas el mismo día se suman: 45 + 30
  const otra = { id: 's2', kind: 'nap', started_at: '2026-03-11T12:00:00Z', ended_at: '2026-03-11T12:30:00Z' };
  assert.equal(resumenDia([siesta, otra], '2026-03-11').siesta_min, 75);
});

test('traducirError: mensajes de sueño en español, el resto no cambia', () => {
  assert.equal(traducirError({ code: '23505', message: 'duplicate key value violates unique constraint "sleep_sessions_abierta_uq"' }), 'Ya hay un registro de sueño en curso.');
  assert.match(traducirError({ code: '23514', message: 'new row for relation "sleep_sessions" violates check constraint "sleep_sessions_fin_ck"' }), /posterior al inicio.*24 horas/);
  assert.equal(traducirError({ code: '23505', message: 'duplicate key value violates unique constraint "foods_nombre_uq"' }), 'Ya existe un alimento con ese nombre.');
  assert.equal(traducirError({ code: '23514', message: 'violates check constraint "otra_ck"' }), 'violates check constraint "otra_ck"');
});
