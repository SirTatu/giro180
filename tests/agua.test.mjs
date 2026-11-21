// Pruebas de js/core/agua.js (ejemplos inventados). Ejecutar con:  node --test tests/agua.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarCantidad, validarBotella, formatoMl, factorUnidad, metaEnMl, mlAUnidad, totalAgua, totalesPorDia, estadoAgua,
  decidirSincronizacionAgua, decidirCierreAgua, resumenAgua, buscarHabitoAgua, NOTA_AUTO_AGUA, NOTA_CIERRE, BOTONES_RAPIDOS
} from '../js/core/agua.js';

const ver = (o = {}) => ({ id: 'ha', series_id: 'sa', module: 'nutri', kind: 'quantity', name: 'Agua', unit: 'L', target_value: 3,
  scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-01-01', valid_to: null, locked: false, ...o });
const toma = (f, ml) => ({ drunk_on: f, ml });
const tot = (...mls) => totalAgua(mls.map((ml) => toma('2026-03-10', ml)));

test('validarCantidad: ml y litros, coma decimal, límites', () => {
  assert.equal(validarCantidad('500', 'ml').ml, 500);
  assert.equal(validarCantidad('0,5', 'l').ml, 500);
  assert.equal(validarCantidad('1.25', 'l').ml, 1250);
  assert.equal(validarCantidad('2', 'l').ml, 2000);
  assert.equal(validarCantidad('0,3333', 'l').ml, 333);                // redondea a ml enteros
  for (const [t, u] of [['', 'ml'], ['abc', 'ml'], ['-5', 'ml'], ['0', 'ml'], ['250,5', 'ml'], ['10001', 'ml'], ['11', 'l'], ['500', 'x'], ['0,0001', 'l']]) {
    assert.ok(validarCantidad(t, u).error, `${t} ${u}`);
  }
  assert.equal(validarCantidad('10000', 'ml').ml, 10000);
});

test('validarBotella', () => {
  assert.deepEqual(validarBotella({ nombre: ' Botella de prueba ', volumen: '750', unidad: 'ml' }).datos, { name: 'Botella de prueba', volume_ml: 750 });
  assert.equal(validarBotella({ nombre: 'Jarra', volumen: '1,5', unidad: 'l' }).datos.volume_ml, 1500);
  assert.ok(validarBotella({ nombre: '  ', volumen: '500', unidad: 'ml' }).error);
  assert.ok(validarBotella({ nombre: 'x'.repeat(61), volumen: '500', unidad: 'ml' }).error);
  assert.ok(validarBotella({ nombre: 'Tanque', volumen: '10001', unidad: 'ml' }).error === null);   // hasta 20 L por botella
  assert.ok(validarBotella({ nombre: 'Tanque', volumen: '21', unidad: 'l' }).error);
  assert.ok(validarBotella({ nombre: 'Vaso', volumen: '', unidad: 'ml' }).error);
});

test('formatoMl y unidades', () => {
  assert.equal(formatoMl(250), '250 ml');
  assert.equal(formatoMl(1000), '1 L');
  assert.equal(formatoMl(1500), '1,5 L');
  assert.equal(formatoMl(1250), '1,25 L');
  assert.deepEqual(BOTONES_RAPIDOS, [250, 500, 1000]);
  assert.equal(factorUnidad(' L '), 1000);
  assert.equal(factorUnidad('ml'), 1);
  assert.equal(factorUnidad('pasos'), null);
  assert.equal(metaEnMl(ver()), 3000);
  assert.equal(metaEnMl(ver({ unit: 'ml', target_value: 2500 })), 2500);
  assert.equal(metaEnMl(ver({ unit: 'vasos' })), null);
  assert.equal(mlAUnidad(2750, 'L'), 2.75);
  assert.equal(mlAUnidad(2750, 'ml'), 2750);
});

test('totalAgua: sin tomas es 0 tomas (no registrado), no un dato', () => {
  assert.deepEqual(totalAgua([]), { ml: 0, cantidad: 0 });
  assert.deepEqual(tot(750, 250, 500), { ml: 1500, cantidad: 3 });
  assert.equal(totalesPorDia([toma('a', 100), toma('b', 5), toma('a', 50)]).get('a').ml, 150);
});

test('estadoAgua', () => {
  assert.deepEqual(estadoAgua(null, totalAgua([])), { estado: 'no_registrado', cerrado: false });
  assert.deepEqual(estadoAgua(null, tot(500)), { estado: 'sin_completar', cerrado: false });
  assert.deepEqual(estadoAgua({ status: 'done', note: NOTA_AUTO_AGUA }, tot(3000)), { estado: 'cumplido', cerrado: false });
  assert.deepEqual(estadoAgua({ status: 'missed', note: NOTA_CIERRE }, tot(500)), { estado: 'incumplido', cerrado: true });
});

test('decidirSincronizacionAgua: cumplido solo al llegar, nunca incumplido solo, unidades L', () => {
  const v = ver();
  assert.equal(decidirSincronizacionAgua({ version: v, totales: tot(2999), log: null }).accion, 'ninguna');
  assert.deepEqual(decidirSincronizacionAgua({ version: v, totales: tot(1500, 1500), log: null }),
    { accion: 'guardar', status: 'done', value: 3, note: NOTA_AUTO_AGUA });                    // 3000 ml = 3 L (en la unidad del hábito)
  assert.equal(decidirSincronizacionAgua({ version: v, totales: tot(3000), log: { status: 'done', value: 3, note: NOTA_AUTO_AGUA } }).accion, 'ninguna');
  assert.equal(decidirSincronizacionAgua({ version: v, totales: tot(3500), log: { status: 'done', value: 3, note: NOTA_AUTO_AGUA } }).value, 3.5);
  assert.equal(decidirSincronizacionAgua({ version: v, totales: tot(1000), log: { status: 'done', value: 3, note: NOTA_AUTO_AGUA } }).accion, 'quitar');
  assert.equal(decidirSincronizacionAgua({ version: v, totales: totalAgua([]), log: { status: 'done', value: 3, note: NOTA_AUTO_AGUA } }).accion, 'quitar');
  for (const ml of [0, 1000, 9000]) assert.equal(decidirSincronizacionAgua({ version: v, totales: tot(ml || 1), log: { status: 'missed', value: 1, note: NOTA_CIERRE } }).accion, 'ninguna');
  // el cumplido automático de la PROTEÍNA no se confunde con el del agua (otra nota = decisión ajena: no se toca)
  assert.equal(decidirSincronizacionAgua({ version: v, totales: tot(100), log: { status: 'done', value: 9, note: 'auto-proteina' } }).accion, 'ninguna');
  assert.equal(decidirSincronizacionAgua({ version: ver({ unit: 'ml', target_value: 2500 }), totales: tot(2500), log: null }).value, 2500);
  assert.equal(decidirSincronizacionAgua({ version: ver({ unit: 'vasos' }), totales: tot(9000), log: null }).accion, 'ninguna');
});

test('decidirCierreAgua', () => {
  const v = ver(), H = '2026-03-10';
  assert.ok(decidirCierreAgua({ version: v, totales: totalAgua([]), fecha: H, hoyFecha: H }).error);
  assert.ok(decidirCierreAgua({ version: v, totales: tot(500), fecha: '2026-03-11', hoyFecha: H }).error);
  assert.ok(decidirCierreAgua({ version: ver({ unit: 'vasos' }), totales: tot(500), fecha: H, hoyFecha: H }).error);
  assert.ok(decidirCierreAgua({ version: null, totales: tot(500), fecha: H, hoyFecha: H }).error);
  const c = decidirCierreAgua({ version: v, totales: tot(2000), fecha: H, hoyFecha: H });
  assert.deepEqual([c.error, c.status, c.value, c.note], [null, 'missed', 2, NOTA_CIERRE]);
  assert.equal(decidirCierreAgua({ version: v, totales: tot(3000), fecha: H, hoyFecha: H }).status, 'done');
});

test('buscarHabitoAgua: estricto, no confunde con proteína', () => {
  const prot = ver({ id: 'hp', series_id: 'sp', name: 'Proteína', unit: 'g', target_value: 120 });
  assert.equal(buscarHabitoAgua([prot, ver()], '2026-03-10').version.id, 'ha');
  assert.equal(buscarHabitoAgua([prot], '2026-03-10').motivo, 'sin_habito');
});

test('resumenAgua: promedio solo sobre días con tomas', () => {
  const logs = [{ habit_id: 'ha', log_date: '2026-03-02', status: 'done', value: 3, note: NOTA_AUTO_AGUA }];
  const tomas = [toma('2026-03-02', 3000), toma('2026-03-03', 1000), toma('2026-03-03', 500), toma('2026-03-05', 2000)];
  const r = resumenAgua([ver()], logs, tomas, '2026-03-01', '2026-03-07');
  assert.equal(r.estados.cumplidos, 1);
  assert.equal(r.estados.incumplidos, 0);
  assert.equal(r.conDato, 3);
  assert.equal(r.promedioMl, 2167);                                   // (3000+1500+2000)/3, no /7
  assert.deepEqual(r.mejor, { fecha: '2026-03-02', ml: 3000 });
  assert.equal(r.sinCompletar, 2);
  const v = resumenAgua([ver()], [], [], '2026-03-01', '2026-03-07');
  assert.equal(v.promedioMl, null);
  assert.equal(v.mejor, null);
});
