// Pruebas del estado «excedido» y del máximo en los objetivos (hito 3-6c1). Ejecutar con:  node --test tests/excedido.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADO, agruparPorSerie, estadoDia, logsDeSerie, evaluar, tipoObjetivo, textoObjetivo, resumenSerie, combinar, resumenGlobal
} from '../js/core/estados.js';

const def = (o = {}) => ({ id: 'h1', series_id: 's1', module: 'nutri', name: 'Calorías', kind: 'quantity', unit: 'kcal',
  target_value: 1500, target_max: 2000, scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-01-01', valid_to: null, ...o });
const log = (log_date, status, value = null, habit_id = 'h1') => ({ id: habit_id + log_date, habit_id, log_date, status, value });

test('evaluar: sin máximo se comporta EXACTAMENTE como siempre (nunca da «excedido»)', () => {
  for (const v of [def({ target_max: null, target_value: 120 }), def({ target_max: undefined, target_value: 120 })]) {
    assert.equal(evaluar(v, 119.9), 'missed');
    assert.equal(evaluar(v, 120), 'done');
    assert.equal(evaluar(v, 5000), 'done');
  }
  assert.equal(evaluar({ target_value: 8000 }, 9000), 'done');        // versión vieja sin la propiedad target_max
});

test('evaluar: «entre X e Y» (1500 a 2000)', () => {
  const v = def();
  assert.equal(evaluar(v, 1499.9), 'missed');
  assert.equal(evaluar(v, 1500), 'done');
  assert.equal(evaluar(v, 2000), 'done');          // justo en el máximo todavía cumple
  assert.equal(evaluar(v, 2000.1), 'exceeded');
  assert.equal(evaluar(v, '2500'), 'exceeded');    // acepta texto numérico
});

test('evaluar: «como máximo Y» (mínimo 0, máximo 2000)', () => {
  const v = def({ target_value: 0 });
  assert.equal(evaluar(v, 0), 'done');
  assert.equal(evaluar(v, 1800), 'done');
  assert.equal(evaluar(v, 2000), 'done');
  assert.equal(evaluar(v, 2001), 'exceeded');
});

test('tipoObjetivo y textoObjetivo', () => {
  assert.equal(tipoObjetivo(def({ target_max: null })), 'al_menos');
  assert.equal(tipoObjetivo(def()), 'entre');
  assert.equal(tipoObjetivo(def({ target_value: 0 })), 'maximo');
  assert.equal(textoObjetivo(def({ target_max: null, target_value: 120, unit: 'g' })), '120 g o más');     // idéntico al texto de siempre
  assert.equal(textoObjetivo(def({ target_max: null, target_value: 120, unit: null })), '120 o más');
  assert.equal(textoObjetivo(def()), 'entre 1500 y 2000 kcal');
  assert.equal(textoObjetivo(def({ target_value: 0 })), 'como máximo 2000 kcal');
  assert.equal(textoObjetivo(def({ target_value: 0, unit: null })), 'como máximo 2000');
});

test('estadoDia: un registro «exceeded» es el estado EXCEDIDO (no incumplido)', () => {
  const versiones = [def()];
  const por = (...l) => logsDeSerie(versiones, l);
  assert.equal(estadoDia(versiones, por(log('2026-03-02', 'exceeded', 2400)), '2026-03-02').estado, ESTADO.EXCEDIDO);
  assert.equal(estadoDia(versiones, por(log('2026-03-02', 'done', 1800)), '2026-03-02').estado, ESTADO.CUMPLIDO);
  assert.equal(estadoDia(versiones, por(log('2026-03-02', 'missed', 900)), '2026-03-02').estado, ESTADO.INCUMPLIDO);
  assert.equal(estadoDia(versiones, por(), '2026-03-02').estado, ESTADO.NO_REGISTRADO);
  assert.equal(ESTADO.EXCEDIDO, 'excedido');
});

test('resumenSerie: el excedido cuenta como registrado, NO como no cumplido y queda fuera del %', () => {
  const versiones = [def()];
  const logs = [log('2026-03-02', 'done', 1800), log('2026-03-03', 'missed', 900), log('2026-03-04', 'exceeded', 2400)];
  const r = resumenSerie(versiones, logs, '2026-03-02', '2026-03-05');
  assert.deepEqual([r.cumplidos, r.incumplidos, r.excedidos, r.noRegistrados, r.programados], [1, 1, 1, 1, 4]);
  assert.equal(r.pct, 50);                         // 1 / (1 + 1): el excedido no entra ni suma ni resta
  assert.equal(r.cobertura, 75);                   // 3 registrados de 4 programados (el excedido SÍ cuenta como registrado)
});

test('resumenSerie: agregar un día excedido NO cambia el porcentaje', () => {
  const versiones = [def()];
  const base = [log('2026-03-02', 'done', 1800), log('2026-03-03', 'done', 1700), log('2026-03-04', 'missed', 900)];
  const sin = resumenSerie(versiones, base, '2026-03-02', '2026-03-05');
  const con = resumenSerie(versiones, [...base, log('2026-03-05', 'exceeded', 2600)], '2026-03-02', '2026-03-05');
  assert.equal(sin.pct, 67);
  assert.equal(con.pct, 67);                       // igual
  assert.equal(sin.cobertura, 75);
  assert.equal(con.cobertura, 100);                // pero ahora ese día figura como registrado
  assert.equal(con.noRegistrados, 0);
});

test('resumenSerie: solo días excedidos → % sin datos (no 0 %), cobertura 100 %', () => {
  const r = resumenSerie([def()], [log('2026-03-02', 'exceeded', 2400), log('2026-03-03', 'exceeded', 2500)], '2026-03-02', '2026-03-03');
  assert.equal(r.pct, null);
  assert.equal(r.excedidos, 2);
  assert.equal(r.cobertura, 100);
});

test('resumenSerie: un excedido en un día NO programado es «extra», no excedido', () => {
  const lunes = [def({ scheduled_days: [1] })];                      // 2026-03-02 es lunes; 2026-03-03 martes
  const r = resumenSerie(lunes, [log('2026-03-03', 'exceeded', 2400)], '2026-03-02', '2026-03-03');
  assert.equal(r.extras, 1);
  assert.equal(r.excedidos, 0);
});

test('combinar y resumenGlobal: suman excedidos; un resumen viejo sin «excedidos» no rompe nada', () => {
  const a = resumenSerie([def()], [log('2026-03-02', 'exceeded', 2400)], '2026-03-02', '2026-03-02');
  const b = resumenSerie([def({ id: 'h2', series_id: 's2' })], [log('2026-03-02', 'done', 1800, 'h2')], '2026-03-02', '2026-03-02');
  const c = combinar([a, b]);
  assert.deepEqual([c.cumplidos, c.excedidos, c.programados, c.pct, c.cobertura], [1, 1, 2, 100, 100]);
  const viejo = { cumplidos: 2, incumplidos: 1, noRegistrados: 1, sinActividad: 0, extras: 0 };     // forma anterior, sin excedidos
  const mezcla = combinar([viejo, a]);
  assert.equal(mezcla.excedidos, 1);
  assert.ok(Number.isFinite(mezcla.programados) && Number.isFinite(mezcla.cobertura), 'no debe haber NaN');
  const series = agruparPorSerie([def(), def({ id: 'h2', series_id: 's2', module: 'gym', name: 'Pasos', target_max: null, target_value: 8000, unit: 'pasos' })]);
  const g = resumenGlobal(series, [log('2026-03-02', 'exceeded', 2400), log('2026-03-02', 'done', 9000, 'h2')], '2026-03-02', '2026-03-02');
  assert.equal(g.total.excedidos, 1);
  assert.equal(g.porModulo.get('nutri').excedidos, 1);
  assert.equal(g.porModulo.get('gym').excedidos, 0);
});

test('Sin ningún excedido, los resúmenes son los de siempre (más el campo excedidos en 0)', () => {
  const versiones = [def({ target_max: null, target_value: 120, unit: 'g' })];
  const logs = [log('2026-03-02', 'done', 130), log('2026-03-03', 'missed', 50)];
  const r = resumenSerie(versiones, logs, '2026-03-02', '2026-03-04');
  assert.deepEqual([r.cumplidos, r.incumplidos, r.excedidos, r.noRegistrados, r.programados, r.pct, r.cobertura], [1, 1, 0, 1, 3, 50, 67]);
});

// ---------- informes, Nutri y Panel con días excedidos ----------
import { calcularSemana, informeGeneralMd, armarInformes, aIndicadores, filasDelDia, registroDiarioMd, MAX_LINEAS_GENERAL } from '../js/core/informes.js';
import { estadoProteina } from '../js/core/nutri.js';
import { estadoAgua } from '../js/core/agua.js';
import { textoPanel } from '../js/core/areas.js';

const LUN = '2026-11-09', HOY = '2026-11-12';                          // lunes a jueves: 4 días en curso
const cal = def({ id: 'c1', series_id: 'sc', module: 'nutri', name: 'Calorías' });             // entre 1500 y 2000 kcal
const logsC = [log('2026-11-09', 'done', 1800, 'c1'), log('2026-11-10', 'exceeded', 2300, 'c1'), log('2026-11-11', 'missed', 900, 'c1')];
const semana = (logs) => calcularSemana({ series: agruparPorSerie([cal]), logs, lunes: LUN, hoy: HOY });

test('Semana: el día excedido queda fuera del % pero cuenta como registrado', () => {
  const con = semana(logsC).actual.total;
  assert.deepEqual([con.cumplidos, con.incumplidos, con.excedidos, con.noRegistrados, con.programados], [1, 1, 1, 1, 4]);
  assert.equal(con.pct, 50);
  assert.equal(con.cobertura, 75);
  const sin = semana(logsC.filter((l) => l.status !== 'exceeded')).actual.total;
  assert.equal(sin.pct, 50);                                            // el mismo %: el excedido no lo movió
  assert.equal(sin.noRegistrados, 2);                                   // sin el registro, ese día sería «sin registrar»
});

test('INFORME GENERAL: menciona los días excedidos sin pasar de 15 líneas', () => {
  const t = informeGeneralMd(semana(logsC), { prioridades: ['a', 'b', 'c'] });
  assert.ok(t.split('\n').length <= MAX_LINEAS_GENERAL);
  assert.match(t, /1 día excedido \(no cuentan como no cumplidos\)/);
  assert.match(t, /Cumplimiento:\*\* 50 %/);
  assert.ok(!/excedid/.test(informeGeneralMd(semana(logsC.filter((l) => l.status !== 'exceeded')), {})), 'sin excedidos el texto no cambia');
});

test('Indicadores por área y notas: cuentan el excedido aparte', () => {
  const sem = semana(logsC);
  const series = agruparPorSerie([cal]);
  const nota = armarInformes({ sem, series, logs: logsC, fecha: HOY, especialista: 'nutri' }).especialista;
  assert.match(nota, /Calorías: 1 cumplido, 1 no cumplido, 1 excedido/);
  const areas = armarInformes({ sem, series, logs: logsC, fecha: HOY, especialista: 'central' }).areas;
  assert.match(areas, /1 día excedido \(no cuenta como incumplimiento\)/);
});

test('Un módulo con SOLO días excedidos no se muestra como «sin registros»', () => {
  const solo = [log('2026-11-10', 'exceeded', 2300, 'c1'), log('2026-11-11', 'exceeded', 2500, 'c1')];
  const areas = armarInformes({ sem: semana(solo), series: agruparPorSerie([cal]), logs: solo, fecha: HOY, especialista: 'central' }).areas;
  assert.match(areas, /sin días evaluables · 2 días excedidos \(no cuenta como incumplimiento\)/);
  assert.ok(!/sin registros/.test(areas));
});

test('Registro diario: el excedido figura como EXCEDIDO y con su objetivo', () => {
  const filas = filasDelDia(agruparPorSerie([cal]), logsC, '2026-11-10');
  assert.equal(filas[0].estado, 'excedido');
  const t = registroDiarioMd({ fecha: '2026-11-10', filas, entrada: null });
  assert.match(t, /Calorías: EXCEDIDO \(pasó el máximo; no cuenta como incumplimiento\) \(2300 kcal · objetivo entre 1500 y 2000 kcal\)/);
  // un hábito sin máximo conserva el texto de siempre («meta N»)
  const gym = def({ id: 'p1', series_id: 'sp', module: 'gym', name: 'Pasos', target_max: null, target_value: 8000, unit: 'pasos' });
  const f2 = filasDelDia(agruparPorSerie([gym]), [log('2026-11-10', 'done', 9000, 'p1')], '2026-11-10');
  assert.match(registroDiarioMd({ fecha: '2026-11-10', filas: f2, entrada: null }), /Pasos: cumplido \(9000 pasos · meta 8000\)/);
});

test('La foto semanal (aIndicadores) guarda los excedidos', () => {
  const ind = aIndicadores(semana(logsC));
  assert.equal(ind.total.excedidos, 1);
  assert.equal(aIndicadores(semana([])).total.excedidos, 0);
});

test('Nutri y Panel: un registro «exceeded» se lee como excedido, no como incumplido', () => {
  const t = { cantidad: 2, total: 3000 };
  assert.deepEqual(estadoProteina({ status: 'exceeded', note: 'cierre-dia' }, t), { estado: 'excedido', cerrado: true });
  assert.deepEqual(estadoProteina({ status: 'missed', note: 'cierre-dia' }, t), { estado: 'incumplido', cerrado: true });
  assert.deepEqual(estadoAgua({ status: 'exceeded', note: 'auto-agua' }, { cantidad: 1, ml: 9000 }), { estado: 'excedido', cerrado: false });
  const txt = textoPanel({ entrenos: null, proteina: { total: 200, cantidad: 3, sinProteina: 0, meta: 120, falta: null, estado: 'excedido', cerrado: true }, agua: null });
  assert.ok(txt.notas.includes('Proteína: pasó el máximo (excedido).'));
});
