// Pruebas de js/core/cuerpo.js (ejemplos inventados). Ejecutar con:  node --test tests/cuerpo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatoDelta, buscarHabitoPasos, validarPasos, resumenPasos, validarMedida, tendenciaMedidas } from '../js/core/cuerpo.js';

test('validarPasos', () => {
  assert.deepEqual(validarPasos('8500'), { valor: 8500, error: null });
  assert.equal(validarPasos('0').valor, 0);
  for (const mal of ['', '8,5', '-3', 'abc', '200001']) assert.ok(validarPasos(mal).error, mal);
});

test('validarMedida: al menos un dato, rangos y decimales', () => {
  assert.deepEqual(validarMedida({ peso: '82,5', cintura: '' }), { peso: 82.5, cintura: null, errores: [] });
  assert.deepEqual(validarMedida({ peso: '', cintura: '88,2' }).errores, []);
  assert.match(validarMedida({ peso: '', cintura: '' }).errores[0], /Cargá/);
  assert.equal(validarMedida({ peso: '5', cintura: '' }).errores.length, 1);          // peso fuera de rango
  assert.equal(validarMedida({ peso: '82,555', cintura: '' }).errores.length, 1);     // más de 2 decimales
  assert.equal(validarMedida({ peso: '', cintura: '88,25' }).errores.length, 1);      // más de 1 decimal
  assert.equal(validarMedida({ peso: 'x', cintura: '300' }).errores.length, 2);
});

const pasos = (o) => ({ id: 'p1', series_id: 'sp', name: 'Pasos', module: 'gym', kind: 'quantity', unit: 'pasos', target_value: 8000,
  locked: false, scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-01-01', valid_to: null, ...o });

test('buscarHabitoPasos: del módulo Gym, de cantidad, con nombre de pasos', () => {
  const defs = [pasos({}), pasos({ id: 'h2', series_id: 'sh', name: 'Estirar', kind: 'boolean' })];
  const r = buscarHabitoPasos(defs, '2026-11-17');
  assert.equal(r.version.id, 'p1');
  assert.equal(r.programado, true);
  assert.equal(buscarHabitoPasos([], '2026-11-17').motivo, 'sin_habito');
  assert.equal(buscarHabitoPasos([pasos({ module: 'nutri' })], '2026-11-17').motivo, 'sin_habito');
  assert.equal(buscarHabitoPasos(defs, '2025-01-01').motivo, 'sin_version_vigente');
});

test('resumenPasos: el promedio es sobre los días con dato (no cuenta los vacíos como 0) y los estados vienen de estados.js', () => {
  const versiones = [pasos({})];
  const logs = [
    { habit_id: 'p1', log_date: '2026-11-16', status: 'done', value: 9000 },
    { habit_id: 'p1', log_date: '2026-11-17', status: 'missed', value: 6000 },
    { habit_id: 'p1', log_date: '2026-11-19', status: 'done', value: 12000 }
  ];
  const r = resumenPasos(versiones, logs, '2026-11-16', '2026-11-19');       // 4 días, 3 con dato
  assert.equal(r.conDato, 3);
  assert.equal(r.total, 27000);
  assert.equal(r.promedio, 9000);                                           // y no 6750
  assert.deepEqual(r.mejor, { fecha: '2026-11-19', valor: 12000 });
  assert.equal(r.estados.cumplidos, 2);
  assert.equal(r.estados.incumplidos, 1);
  assert.equal(r.estados.noRegistrados, 1);                                  // el 18: sin registro, no es incumplimiento
  assert.equal(r.estados.pct, 67);
  const vacio = resumenPasos(versiones, [], '2026-11-16', '2026-11-19');
  assert.equal(vacio.promedio, null);
  assert.equal(vacio.mejor, null);
  assert.equal(vacio.estados.pct, null);
});

const m = (fecha, peso, cintura = null) => ({ measured_on: fecha, weight_kg: peso, waist_cm: cintura });
// hasta = jueves 2026-11-19 (semana del lunes 16)
const FILAS = [
  m('2026-10-26', 84.0), m('2026-11-03', 83.5), m('2026-11-05', 83.1),    // 14+ días antes
  m('2026-11-11', 82.4),                                                   // semana previa (13 a 7 días antes: 6 al 12)
  m('2026-11-13', 82.0), m('2026-11-16', 81.8), m('2026-11-19', 81.2)
];

test('tendenciaMedidas: último, cambios, promedios de 7 días, ritmo y semanas', () => {
  const t = tendenciaMedidas(FILAS, 'weight_kg', '2026-11-19', 30);
  assert.deepEqual(t.ultimo, { fecha: '2026-11-19', valor: 81.2 });
  assert.equal(t.diasDesdeUltimo, 0);
  assert.equal(t.n, 7);
  assert.equal(t.cambioPeriodo, -2.8);                                       // 81,2 - 84,0
  assert.equal(t.min, 81.2);
  assert.equal(t.max, 84);
  assert.deepEqual(t.promedio7, { valor: 81.7, n: 3 });                      // 13, 16 y 19
  assert.deepEqual(t.promedio7Previo, { valor: 82.4, n: 1 });                // solo el 11
  assert.equal(t.deltaSemana, -0.7);
  assert.equal(t.ritmoSemanal, -0.83);                                       // regresión lineal, calculada aparte
  assert.deepEqual(t.semanas.map((w) => [w.semana, w.promedio, w.n, w.cambio]), [
    ['2026-11-16', 81.5, 2, -0.7], ['2026-11-09', 82.2, 2, -1.1], ['2026-11-02', 83.3, 2, -0.7], ['2026-10-26', 84, 1, null]
  ]);
});

test('tendenciaMedidas: sin datos suficientes devuelve null, nunca 0', () => {
  const vacia = tendenciaMedidas([], 'weight_kg', '2026-11-19');
  assert.equal(vacia.ultimo, null);
  assert.equal(vacia.diasDesdeUltimo, null);
  assert.equal(vacia.cambioPeriodo, null);
  assert.equal(vacia.promedio7, null);
  assert.equal(vacia.deltaSemana, null);
  assert.equal(vacia.ritmoSemanal, null);
  assert.deepEqual(vacia.semanas, []);
  const una = tendenciaMedidas([m('2026-11-19', 80)], 'weight_kg', '2026-11-19');
  assert.equal(una.cambioPeriodo, null);                                     // una sola medición: no hay cambio
  assert.equal(una.deltaSemana, null);                                       // sin semana previa: «sin base de comparación»
  assert.equal(una.ritmoSemanal, null);
  assert.equal(una.n, 1);
  // 3 mediciones pero en menos de 7 días: no se estima ritmo
  assert.equal(tendenciaMedidas([m('2026-11-15', 80), m('2026-11-17', 79.9), m('2026-11-19', 79.8)], 'weight_kg', '2026-11-19').ritmoSemanal, null);
});

test('tendenciaMedidas: cada campo es independiente y se avisa cuánto hace de la última medición', () => {
  const filas = [m('2026-11-01', 80, 90), m('2026-11-10', 79, null), m('2026-11-15', 78.5, 88.5)];
  const cintura = tendenciaMedidas(filas, 'waist_cm', '2026-11-19');
  assert.equal(cintura.n, 2);
  assert.equal(cintura.cambioPeriodo, -1.5);
  assert.equal(cintura.diasDesdeUltimo, 4);
  const peso = tendenciaMedidas(filas, 'weight_kg', '2026-11-19');
  assert.equal(peso.n, 3);
  // mediciones futuras (después de «hasta») no cuentan
  assert.equal(tendenciaMedidas([m('2026-12-01', 70)], 'weight_kg', '2026-11-19').ultimo, null);
});

test('formatoDelta', () => {
  assert.equal(formatoDelta(-0.7, 'kg'), '−0,7 kg');
  assert.equal(formatoDelta(1.5, 'cm'), '+1,5 cm');
  assert.equal(formatoDelta(0, 'kg'), 'sin cambios');
  assert.equal(formatoDelta(null, 'kg'), null);
});
