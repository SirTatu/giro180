// Pruebas de la lógica central. Ejecutar con:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { hoy, sumarDias, diaISO, lunesDe, rango, etiquetaLarga, formatoFechaHora } from '../js/core/fechas.js';
import { ESTADO, agruparPorSerie, versionVigente, logsDeSerie, estadoDia, evaluar, resumenSerie, combinar, resumenGlobal } from '../js/core/estados.js';

const gym = (extra = {}) => ({
  id: 'g1', series_id: 's1', kind: 'boolean', target_value: null,
  scheduled_days: [2, 3, 4, 5, 6], valid_from: '2026-11-01', valid_to: null, ...extra
});
const log = (habit_id, log_date, status) => ({ id: habit_id + log_date, habit_id, log_date, status });

test('fechas', () => {
  assert.match(hoy(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(diaISO('2026-11-13'), 5);              // viernes
  assert.equal(diaISO('2026-11-15'), 7);              // domingo
  assert.equal(lunesDe('2026-11-13'), '2026-11-09');
  assert.equal(lunesDe('2026-11-15'), '2026-11-09');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
  assert.deepEqual(rango('2026-11-09', '2026-11-11'), ['2026-11-09', '2026-11-10', '2026-11-11']);
  assert.equal(etiquetaLarga('2026-11-13'), 'viernes 13/11');
});

test('los cuatro estados', () => {
  const v = [gym()];
  const sinLogs = new Map();
  assert.equal(estadoDia(v, sinLogs, '2026-11-09').estado, ESTADO.SIN_ACTIVIDAD);   // lunes: no programado
  assert.equal(estadoDia(v, sinLogs, '2026-11-10').estado, ESTADO.NO_REGISTRADO);   // martes sin registro
  assert.equal(estadoDia(v, sinLogs, '2026-10-20').estado, ESTADO.SIN_ACTIVIDAD);   // antes de existir
  const l = logsDeSerie(v, [log('g1', '2026-11-10', 'done'), log('g1', '2026-11-11', 'missed')]);
  assert.equal(estadoDia(v, l, '2026-11-10').estado, ESTADO.CUMPLIDO);
  assert.equal(estadoDia(v, l, '2026-11-11').estado, ESTADO.INCUMPLIDO);
});

test('un dato faltante NUNCA es incumplimiento', () => {
  const v = [gym()];
  const logs = [log('g1', '2026-11-10', 'done')];                 // mar-sáb: solo 1 de 5 registrado
  const r = resumenSerie(v, logs, '2026-11-09', '2026-11-15');
  assert.equal(r.cumplidos, 1);
  assert.equal(r.incumplidos, 0);
  assert.equal(r.noRegistrados, 4);
  assert.equal(r.sinActividad, 2);                                  // lunes y domingo
  assert.equal(r.pct, 100);                                         // 1 de 1 registrado
  assert.equal(r.cobertura, 20);
});

test('sin ningún registro: pct es null, no 0', () => {
  const r = resumenSerie([gym()], [], '2026-11-09', '2026-11-15');
  assert.equal(r.pct, null);
  assert.equal(r.incumplidos, 0);
});

test('cambiar la meta no altera el historial', () => {
  const v1 = { id: 'p1', series_id: 'sp', kind: 'quantity', target_value: 140, scheduled_days: [1,2,3,4,5,6,7], valid_from: '2026-11-01', valid_to: '2026-11-09' };
  const v2 = { ...v1, id: 'p2', target_value: 150, valid_from: '2026-11-10', valid_to: null };
  const series = agruparPorSerie([v2, v1]).get('sp');
  assert.equal(series[0].id, 'p1');                                 // ordenadas por inicio
  assert.equal(versionVigente(series, '2026-11-05').target_value, 140);
  assert.equal(versionVigente(series, '2026-11-12').target_value, 150);
  assert.equal(evaluar(v1, 145), 'done');                           // 145 cumplía la meta de ESE momento
  assert.equal(evaluar(v2, 145), 'missed');
  const logs = [log('p1', '2026-11-05', 'done')];                   // el estado guardado no cambia
  assert.equal(estadoDia(series, logsDeSerie(series, logs), '2026-11-05').estado, ESTADO.CUMPLIDO);
});

test('registro en día no programado = extra, no entra en el %', () => {
  const v = [gym()];
  const logs = [log('g1', '2026-11-09', 'done'), log('g1', '2026-11-10', 'missed')];  // lunes extra
  const r = resumenSerie(v, logs, '2026-11-09', '2026-11-10');
  assert.equal(r.extras, 1);
  assert.equal(r.cumplidos, 0);
  assert.equal(r.incumplidos, 1);
  assert.equal(r.pct, 0);
});

test('evaluar: la meta es "o más" y el borde cumple', () => {
  const v = { target_value: 140 };
  assert.equal(evaluar(v, 140), 'done');
  assert.equal(evaluar(v, 139.9), 'missed');
  assert.equal(evaluar(v, 0), 'missed');
});

test('resumenGlobal: suma conteos, no promedia porcentajes, separa módulos', () => {
  const g = gym({ module: 'gym' });
  const p = { id: 'p1', series_id: 's2', module: 'nutri', kind: 'quantity', target_value: 140,
    scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-11-01', valid_to: null };
  const series = agruparPorSerie([g, p]);
  const logs = [
    log('g1', '2026-11-10', 'done'), log('g1', '2026-11-11', 'done'), log('g1', '2026-11-12', 'missed'),
    log('p1', '2026-11-09', 'done'), log('p1', '2026-11-10', 'done')
  ];
  const { total, porModulo } = resumenGlobal(series, logs, '2026-11-09', '2026-11-13');   // lun a vie
  const rg = porModulo.get('gym');
  assert.deepEqual([rg.cumplidos, rg.incumplidos, rg.noRegistrados, rg.sinActividad], [2, 1, 1, 1]);
  assert.equal(rg.pct, 67);
  assert.equal(rg.cobertura, 75);
  const rp = porModulo.get('nutri');
  assert.deepEqual([rp.cumplidos, rp.incumplidos, rp.noRegistrados], [2, 0, 3]);
  assert.equal(rp.pct, 100);
  assert.equal(rp.cobertura, 40);
  assert.deepEqual([total.cumplidos, total.incumplidos, total.noRegistrados, total.programados], [4, 1, 4, 9]);
  assert.equal(total.pct, 80);          // 4 de 5 registrados (no el promedio de 67 y 100)
  assert.equal(total.cobertura, 56);    // 5 de 9 programados
});

test('combinar sin datos devuelve null, no 0', () => {
  const r = combinar([]);
  assert.equal(r.pct, null);
  assert.equal(r.cobertura, null);
});

test('formatoFechaHora usa hora de Argentina (UTC-3)', () => {
  const t = formatoFechaHora('2026-11-18T18:30:00.000Z');
  assert.match(t, /15:30/);
  assert.match(t, /18\/11/);
});
