// Pruebas de js/core/nutri.js (ejemplos inventados). Ejecutar con:  node --test tests/nutri.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarProteina, totalDia, totalesPorDia, aviso, estadoProteina, decidirSincronizacion,
  decidirCierre, resumenProteina, buscarHabitoProteina, NOTA_AUTO, NOTA_CIERRE, estaCerrado
} from '../js/core/nutri.js';

const ver = (o = {}) => ({ id: 'h1', series_id: 's1', module: 'nutri', kind: 'quantity', name: 'Proteína', unit: 'g',
  target_value: 120, scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-01-01', valid_to: null, locked: false, ...o });
const comida = (f, p, id = Math.random()) => ({ id, eaten_on: f, meal_type: 'almuerzo', description: 'x', protein_g: p });

test('validarProteina: vacío es null (no cargada), nunca 0', () => {
  assert.deepEqual(validarProteina(''), { valor: null, error: null });
  assert.deepEqual(validarProteina('  '), { valor: null, error: null });
  assert.equal(validarProteina('0').valor, 0);
  assert.equal(validarProteina('32,5').valor, 32.5);
  for (const mal of ['abc', '-5', '501', '32.55']) assert.ok(validarProteina(mal).error, mal);
});

test('totalDia: suma solo lo cargado; sin nada cargado es null, no 0', () => {
  assert.deepEqual(totalDia([]), { total: null, cantidad: 0, conProteina: 0, sinProteina: 0 });
  assert.equal(totalDia([comida('2026-03-02', null)]).total, null);
  const t = totalDia([comida('2026-03-02', 30.5), comida('2026-03-02', null), comida('2026-03-02', 40)]);
  assert.deepEqual(t, { total: 70.5, cantidad: 3, conProteina: 2, sinProteina: 1 });
  assert.equal(totalDia([comida('x', 0.1), comida('x', 0.2)]).total, 0.3);   // sin errores de coma flotante
  assert.equal(aviso(t), '1 comida quedó sin proteína cargada.');
  assert.equal(aviso({ sinProteina: 2 }), '2 comidas quedaron sin proteína cargada.');
  assert.equal(aviso({ sinProteina: 0 }), null);
});

test('estadoProteina: sin completar solo si hay comidas y ningún registro', () => {
  const t0 = totalDia([]), t1 = totalDia([comida('d', 10)]);
  assert.deepEqual(estadoProteina(null, t0), { estado: 'no_registrado', cerrado: false });
  assert.deepEqual(estadoProteina(null, t1), { estado: 'sin_completar', cerrado: false });
  assert.deepEqual(estadoProteina({ status: 'done', note: NOTA_AUTO }, t1), { estado: 'cumplido', cerrado: false });
  assert.deepEqual(estadoProteina({ status: 'missed', note: NOTA_CIERRE }, t1), { estado: 'incumplido', cerrado: true });
  assert.equal(estaCerrado({ note: null }), true);          // registro cargado a mano desde Central: no se toca
});

test('decidirSincronizacion: cumplido automático al llegar a la meta, nunca incumplido solo', () => {
  const v = ver();
  assert.equal(decidirSincronizacion({ version: v, total: 119.9, log: null }).accion, 'ninguna');
  const g = decidirSincronizacion({ version: v, total: 120, log: null });
  assert.deepEqual(g, { accion: 'guardar', status: 'done', value: 120, note: NOTA_AUTO });
  // ya marcado con el mismo total: nada que escribir; con otro total: actualizar
  assert.equal(decidirSincronizacion({ version: v, total: 120, log: { status: 'done', value: 120, note: NOTA_AUTO } }).accion, 'ninguna');
  assert.equal(decidirSincronizacion({ version: v, total: 140, log: { status: 'done', value: 120, note: NOTA_AUTO } }).accion, 'guardar');
  // dejó de llegar (o borró comidas): se quita solo el marcado automático
  assert.equal(decidirSincronizacion({ version: v, total: 90, log: { status: 'done', value: 120, note: NOTA_AUTO } }).accion, 'quitar');
  assert.equal(decidirSincronizacion({ version: v, total: null, log: { status: 'done', value: 120, note: NOTA_AUTO } }).accion, 'quitar');
  // un cierre manual no se toca nunca
  for (const total of [0, 90, 200, null]) assert.equal(decidirSincronizacion({ version: v, total, log: { status: 'missed', value: 50, note: NOTA_CIERRE } }).accion, 'ninguna');
  assert.equal(decidirSincronizacion({ version: null, total: 500, log: null }).accion, 'ninguna');
});

test('decidirCierre: reglas del cierre manual', () => {
  const v = ver(), H = '2026-03-10';
  const t = (...ps) => totalDia(ps.map((p) => comida('2026-03-10', p)));
  assert.ok(decidirCierre({ version: v, totales: t(), fecha: H, hoyFecha: H }).error);                 // sin comidas
  assert.ok(decidirCierre({ version: v, totales: t(null), fecha: H, hoyFecha: H }).error);             // sin proteína cargada: falta el dato
  assert.ok(decidirCierre({ version: v, totales: t(100), fecha: '2026-03-11', hoyFecha: H }).error);   // futuro
  assert.ok(decidirCierre({ version: null, totales: t(100), fecha: H, hoyFecha: H }).error);
  const bajo = decidirCierre({ version: v, totales: t(100), fecha: H, hoyFecha: H });
  assert.deepEqual([bajo.error, bajo.status, bajo.value, bajo.note, bajo.confirmar], [null, 'missed', 100, NOTA_CIERRE, null]);
  assert.equal(decidirCierre({ version: v, totales: t(120), fecha: H, hoyFecha: H }).status, 'done');
  const conFalta = decidirCierre({ version: v, totales: t(100, null), fecha: H, hoyFecha: H });
  assert.match(conFalta.confirmar, /sin proteína cargada/);
  assert.match(conFalta.confirmar, /incumplido/);
});

test('buscarHabitoProteina: módulo Nutri, cantidad, nombre con «prote»; el agua no se confunde', () => {
  const agua = ver({ id: 'h2', series_id: 's2', name: 'Agua', unit: 'L', target_value: 3 });
  const gym = ver({ id: 'h3', series_id: 's3', module: 'gym', name: 'Proteína rara' });
  const r = buscarHabitoProteina([agua, gym, ver()], '2026-03-10');
  assert.equal(r.version.id, 'h1');
  // solo existe el agua: NO debe confundirse con la proteína
  assert.equal(buscarHabitoProteina([agua], '2026-03-10').motivo, 'sin_habito');
  assert.equal(buscarHabitoProteina([], '2026-03-10').motivo, 'sin_habito');
});

test('resumenProteina: promedio solo sobre días con dato; sin completar; faltantes', () => {
  const versiones = [ver()];
  const comidas = [comida('2026-03-02', 130), comida('2026-03-03', 80), comida('2026-03-03', null),
    comida('2026-03-04', null), comida('2026-03-05', 100)];
  const logs = [{ habit_id: 'h1', log_date: '2026-03-02', status: 'done', value: 130, note: NOTA_AUTO }];
  const r = resumenProteina(versiones, logs, comidas, '2026-03-01', '2026-03-07');
  assert.equal(r.estados.cumplidos, 1);
  assert.equal(r.estados.incumplidos, 0);                    // lo que falta NUNCA es incumplimiento
  assert.equal(r.conDato, 3);                                // el 4 no tiene proteína: no cuenta
  assert.equal(r.promedio, 103.3);                           // (130+80+100)/3, no /4
  assert.deepEqual(r.mejor, { fecha: '2026-03-02', valor: 130 });
  assert.equal(r.sinCompletar, 3);                           // días 3, 4 y 5: con comidas y sin registro
  assert.equal(r.diasConFaltantes, 2);
  assert.equal(r.diasConComidas, 4);
  const vacio = resumenProteina(versiones, [], [], '2026-03-01', '2026-03-07');
  assert.equal(vacio.promedio, null);
  assert.equal(vacio.mejor, null);
});

test('totalesPorDia agrupa por fecha', () => {
  const m = totalesPorDia([comida('a', 10), comida('b', 5), comida('a', 20)]);
  assert.equal(m.get('a').total, 30);
  assert.equal(m.get('b').cantidad, 1);
});
