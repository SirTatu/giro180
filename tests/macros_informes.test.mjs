// Informes con las 4 macros: promedios, objetivo, cumplidos / no cumplidos / excedidos y días sin cerrar.
// Ejecutar con:  node --test tests/macros_informes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorSerie } from '../js/core/estados.js';
import { calcularSemana, informeGeneralMd, armarInformes, MAX_LINEAS_GENERAL } from '../js/core/informes.js';
import { calcularAreas, fragmentosCortos, lineasArea, lineasComparacion, lineasDia, hayDatosArea, indicadoresPanel, textoPanel } from '../js/core/areas.js';

const LUN = '2026-11-09', HOY = '2026-11-12';
const def = (o) => ({ id: 'x', series_id: 's', module: 'nutri', kind: 'quantity', unit: 'g', target_value: 0, target_max: null, scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-10-01', valid_to: null, locked: false, ...o });
const defs = [
  def({ id: 'c', series_id: 'sc', name: 'Calorías', unit: 'kcal', target_value: 1500, target_max: 2000 }),       // entre 1500 y 2000
  def({ id: 'p', series_id: 'sp', name: 'Proteínas', target_value: 120 }),                                      // al menos 120
  def({ id: 'g', series_id: 'sg', name: 'Grasas', target_value: 0, target_max: 70 })                            // como máximo 70
];                                                                                                              // carbohidratos: sin objetivo
const log = (habit_id, log_date, status, value) => ({ id: habit_id + log_date, habit_id, log_date, status, value, note: 'cierre-dia' });
const logs = [
  log('c', '2026-11-09', 'done', 1800), log('c', '2026-11-10', 'exceeded', 2300), log('c', '2026-11-11', 'missed', 900),
  log('p', '2026-11-09', 'done', 130), log('p', '2026-11-10', 'done', 140), log('p', '2026-11-11', 'missed', 70),
  log('g', '2026-11-09', 'done', 60), log('g', '2026-11-10', 'exceeded', 85), log('g', '2026-11-11', 'done', 30)
];                                                                                                              // el 12 no se cerró
const com = (eaten_on, calories_kcal, carbs_g, protein_g, fat_g) => ({ eaten_on, meal_type: 'almuerzo', description: 'x', calories_kcal, carbs_g, protein_g, fat_g });
const comidas = [com('2026-11-09', 1800, 200, 130, 60), com('2026-11-10', 2300, 250, 140, 85), com('2026-11-11', 900, 90, 70, 30), com('2026-11-12', 1000, 100, 60, 20)];
const series = agruparPorSerie(defs);
const sem = calcularSemana({ series, logs, lunes: LUN, hoy: HOY });
const areas = calcularAreas({ series, logs, datos: { comidas, tomas: [] }, periodo: sem.periodo, anterior: sem.periodoAnterior });
const texto = lineasArea(areas, 'nutri').join('\n');

test('Nota de Nutri: una línea por macro con promedio, objetivo y estados', () => {
  assert.match(texto, /- Calorías: promedio 1500 kcal\/día sobre 4 días con dato · objetivo entre 1500 y 2000 kcal · 1 cumplido, 1 no cumplido, 1 excedido \(no cuentan como no cumplidos\), 1 día sin cerrar · día más alto 2300 kcal \(10\/11\)/);
  assert.match(texto, /- Proteínas: promedio 100 g\/día sobre 4 días con dato · objetivo 120 g o más · 2 cumplidos, 1 no cumplido, 0 excedidos, 1 día sin cerrar · día más alto 140 g \(10\/11\)/);
  assert.match(texto, /- Grasas: promedio 48,8 g\/día sobre 4 días con dato · objetivo como máximo 70 g · 2 cumplidos, 0 no cumplidos, 1 excedido \(no cuentan como no cumplidos\), 1 día sin cerrar · día más alto 85 g \(10\/11\)/);
});

test('Una macro SIN objetivo muestra su promedio pero no inventa estados', () => {
  assert.match(texto, /- Carbohidratos: promedio 160 g\/día sobre 4 días con dato · día más alto 250 g \(10\/11\)$/m);
  assert.ok(!/Carbohidratos:[^\n]*(cumplido|objetivo)/.test(texto));
});

test('INFORME GENERAL: promedios de las 4 macros en la línea de Nutri, sin pasar de 15 líneas', () => {
  assert.deepEqual(fragmentosCortos(areas, 'nutri'), ['calorías 1500 kcal/día', 'carbos 160 g/día', 'proteína 100 g/día', 'grasas 48,8 g/día']);
  const t = informeGeneralMd(sem, { prioridades: ['a', 'b', 'c'], areas });
  assert.ok(t.split('\n').length <= MAX_LINEAS_GENERAL);
  assert.match(t, /Nutri: .*calorías 1500 kcal\/día · carbos 160 g\/día · proteína 100 g\/día · grasas 48,8 g\/día/);
  assert.match(t, /2 días excedidos \(no cuentan como no cumplidos\)/);                     // 11-10: calorías y grasas
  assert.equal(hayDatosArea(areas, 'nutri'), true);
});

test('El porcentaje de Nutri no cuenta los excedidos como no cumplidos', () => {
  const t = sem.actual.porModulo.get('nutri');
  assert.deepEqual([t.cumplidos, t.incumplidos, t.excedidos, t.noRegistrados], [5, 2, 2, 3]);   // 9 registros + 3 sin cerrar (día 12 × 3 hábitos)
  assert.equal(t.pct, 71);                                                                      // 5 / (5 + 2), con los 2 excedidos fuera
});

test('Comparación y registro diario con las 4 macros', () => {
  const L = lineasComparacion(areas);
  assert.ok(L.includes('- Calorías (promedio/día): 1500 kcal vs sin datos'));
  assert.ok(L.includes('- Grasas (promedio/día): 48,8 g vs sin datos'));
  assert.deepEqual(lineasDia({ fecha: '2026-11-10', datos: { comidas, tomas: [] } }), ['- Nutri: 1 comida · 2300 kcal · C 250 g · P 140 g · G 85 g']);
  // una macro que nunca se carga NO es un faltante; una cargada a medias sí
  const parcial = [com('2026-11-10', 700, null, 40, null), com('2026-11-10', null, null, 30, null)];
  assert.deepEqual(lineasDia({ fecha: '2026-11-10', datos: { comidas: parcial, tomas: [] } }), ['- Nutri: 2 comidas · 700 kcal · P 70 g · 1 comida sin dato de calorías']);
});

test('Informes completos para los 6 especialistas con las 4 macros', () => {
  const nota = armarInformes({ sem, series, logs, fecha: HOY, especialista: 'nutri', areas, datosAreas: { comidas, tomas: [] } }).especialista;
  assert.match(nota, /Calorías: promedio 1500 kcal/);
  assert.match(nota, /Calorías: 1 cumplido, 1 no cumplido, 1 excedido/);                       // detalle por hábito
});

test('Panel: las 4 macros de hoy con su estado; la proteína en el recuadro, el resto en notas', () => {
  const pr = (extra = {}) => indicadoresPanel({ defs, logs, fecha: '2026-11-11', lunes: LUN, sesiones: [], comidas, tomas: [], ...extra });
  const t = textoPanel(pr());
  assert.deepEqual(t.metricas[1], { valor: '70 g', etiqueta: 'Proteína de hoy · objetivo 120 g o más', clase: '' });
  assert.ok(t.notas.includes('Calorías: no llegaste al mínimo · día cerrado.'));
  assert.ok(t.notas.includes('Proteínas: no llegaste al mínimo · día cerrado.'));
  assert.ok(t.notas.includes('Grasas: dentro del límite · día cerrado.'));                     // «como máximo»: cumplido al cerrar
  assert.ok(!t.notas.some((n) => n.startsWith('Carbohidratos')), 'sin objetivo no hay nota de estado');
  const exc = textoPanel(pr({ fecha: '2026-11-10' }));
  assert.ok(exc.notas.includes('Calorías: te pasaste por 300 kcal · día cerrado.'));
  assert.ok(exc.notas.includes('Grasas: te pasaste por 15 g · día cerrado.'));
  assert.ok(exc.notas.includes('Proteínas: objetivo cumplido · día cerrado.'));
  // hoy (12): con datos y sin cierre
  const abierto = textoPanel(pr({ fecha: '2026-11-12' }));
  assert.ok(abierto.notas.includes('Calorías: faltan 500 kcal para el mínimo.'));
  assert.ok(abierto.notas.includes('Grasas: dentro del límite · quedan 50 g.'));
  // hay comidas pero ninguna con calorías ni grasas: se dice «sin dato», no se mide contra el objetivo
  const soloProteina = textoPanel(pr({ fecha: '2026-11-13', comidas: [com('2026-11-13', null, null, 60, null)] }));
  assert.ok(soloProteina.notas.includes('Calorías: sin dato cargado hoy.'));
  assert.ok(soloProteina.notas.includes('Grasas: sin dato cargado hoy.'));
  assert.ok(soloProteina.notas.includes('Proteínas: faltan 60 g para el mínimo.'));
  // sin comidas hoy
  assert.ok(textoPanel(pr({ fecha: '2026-11-13' })).notas.includes('Todavía no cargaste comidas hoy.'));
});
