// Pruebas del núcleo de informes. Ejecutar con:  node --test tests/informes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorSerie } from '../js/core/estados.js';
import {
  periodosSemana, diferencia, promedio, resumenAnimo, compararResumenes, calcularSemana, aIndicadores,
  detalleHabitos, filasDelDia, registroDiarioMd, resumenSemanalMd, comparacionMd, indicadoresAreaMd,
  notaEspecialistaMd, informeGeneralMd, limitarLineas, ESPECIALISTAS, MAX_LINEAS_GENERAL, prioridadesAl, fmtEscala
} from '../js/core/informes.js';

// Semana en curso de las pruebas: lunes 2026-11-09 ... jueves 2026-11-12 es "hoy".
const LUN = '2026-11-09';
const HOY = '2026-11-12';
const def = (extra) => ({
  id: 'x', series_id: 's', name: 'H', module: 'central', kind: 'boolean', target_value: null, unit: null,
  scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-10-01', valid_to: null, ...extra
});
const log = (habit_id, log_date, status, value = null) => ({ id: habit_id + log_date, habit_id, log_date, status, value });

// Fixture: Gym (mar-sáb) y Agua (todos los días, cantidad, meta 2 L).
const gym = def({ id: 'g', series_id: 'sg', name: 'Entrenar', module: 'gym', scheduled_days: [2, 3, 4, 5, 6] });
const agua = def({ id: 'a', series_id: 'sa', name: 'Agua', module: 'nutri', kind: 'quantity', target_value: 2, unit: 'L' });
const series = agruparPorSerie([gym, agua]);
const logs = [
  // semana anterior (2-8 nov): gym mar/mié done, jue missed; agua lunes done
  log('g', '2026-11-03', 'done'), log('g', '2026-11-04', 'done'), log('g', '2026-11-05', 'missed'),
  log('a', '2026-11-02', 'done', 2.5),
  // semana actual (9-12 nov): gym martes done, miércoles done; agua lunes done, martes missed
  log('g', '2026-11-10', 'done'), log('g', '2026-11-11', 'done'),
  log('a', '2026-11-09', 'done', 2.2), log('a', '2026-11-10', 'missed', 1.5)
];

test('periodosSemana: en curso compara el mismo tramo, cerrada compara semanas completas, futura es null', () => {
  const c = periodosSemana(LUN, HOY);
  assert.deepEqual(c.actual, { desde: LUN, hasta: HOY, domingo: '2026-11-15', enCurso: true, dias: 4 });
  assert.deepEqual(c.anterior, { desde: '2026-11-02', hasta: '2026-11-05' });          // lunes a jueves
  const cerrada = periodosSemana('2026-11-02', HOY);
  assert.equal(cerrada.actual.enCurso, false);
  assert.equal(cerrada.actual.dias, 7);
  assert.deepEqual(cerrada.anterior, { desde: '2026-10-26', hasta: '2026-11-01' });
  assert.equal(periodosSemana('2026-11-16', HOY), null);                               // semana futura
  assert.throws(() => periodosSemana('2026-11-10', HOY));                              // martes: no es lunes
});

test('periodosSemana: el último día de la semana (domingo) ya cuenta como cerrada', () => {
  const p = periodosSemana(LUN, '2026-11-15');
  assert.equal(p.actual.enCurso, false);
  assert.equal(p.actual.dias, 7);
});

test('diferencia y promedio tratan "sin datos" como null, nunca como 0', () => {
  assert.equal(diferencia(80, 60), 20);
  assert.equal(diferencia(null, 60), null);
  assert.equal(diferencia(80, null), null);
  assert.equal(diferencia(0, 0), 0);
  assert.equal(promedio([]), null);
  assert.equal(promedio([null, undefined]), null);
  assert.equal(promedio([3, null, 4]), 3.5);
  assert.equal(promedio([1, 2, 2]), 1.7);
});

test('resumenAnimo solo cuenta días con dato dentro del rango', () => {
  const entradas = [
    { entry_date: '2026-11-09', mood: 4, energy: 3 },
    { entry_date: '2026-11-10', mood: 2, energy: null },
    { entry_date: '2026-11-11', mood: null, energy: null },    // sin datos: no cuenta
    { entry_date: '2026-11-01', mood: 5, energy: 5 }           // fuera del rango
  ];
  const r = resumenAnimo(entradas, LUN, HOY);
  assert.equal(r.animo, 3);
  assert.equal(r.energia, 3);
  assert.equal(r.dias, 2);
  assert.deepEqual(resumenAnimo([], LUN, HOY), { animo: null, energia: null, dias: 0 });
});

test('compararResumenes: sin datos de un lado => delta null', () => {
  const a = { pct: 80, cobertura: 50, cumplidos: 4, noRegistrados: 1 };
  const b = { pct: null, cobertura: null, cumplidos: 0, noRegistrados: 3 };
  const c = compararResumenes(a, b);
  assert.equal(c.pct.delta, null);
  assert.equal(c.cobertura.delta, null);
  assert.equal(c.cumplidos.delta, 4);
  assert.equal(compararResumenes(a, a).pct.delta, 0);
});

test('calcularSemana: números correctos, comparación justa y semana futura = null', () => {
  const s = calcularSemana({ series, logs, entradas: [], lunes: LUN, hoy: HOY });
  // Semana actual lun-jue. Gym (mar-sáb): mar done, mié done, jue sin registrar. Agua: lun done, mar missed, mié y jue sin registrar.
  assert.equal(s.actual.total.cumplidos, 3);
  assert.equal(s.actual.total.incumplidos, 1);
  assert.equal(s.actual.total.noRegistrados, 3);
  assert.equal(s.actual.total.pct, 75);
  // Semana anterior, mismo tramo lun-jue (2-5): gym mar done, mié done, jue missed; agua lun done, resto sin registrar.
  assert.equal(s.anterior.total.cumplidos, 3);
  assert.equal(s.anterior.total.incumplidos, 1);
  assert.equal(s.anterior.total.pct, 75);
  assert.equal(s.comparacion.total.pct.delta, 0);
  // Gym: actual 2/2 = 100 %, anterior 2/3 = 67 %
  assert.equal(s.actual.porModulo.get('gym').pct, 100);
  assert.equal(s.comparacion.porModulo.get('gym').pct.delta, 33);
  assert.equal(calcularSemana({ series, logs, lunes: '2026-11-16', hoy: HOY }), null);
});

test('calcularSemana: semana anterior sin registros => delta null (no es un 0 %)', () => {
  const soloActual = logs.filter((l) => l.log_date >= LUN);
  const s = calcularSemana({ series, logs: soloActual, lunes: LUN, hoy: HOY });
  assert.equal(s.anterior.total.pct, null);
  assert.equal(s.comparacion.total.pct.delta, null);
  assert.match(comparacionMd(s), /no hay base de comparación/);
});

test('aIndicadores es JSON puro y sobrevive a ida y vuelta', () => {
  const s = calcularSemana({ series, logs, entradas: [{ entry_date: LUN, mood: 4, energy: 3 }], lunes: LUN, hoy: HOY });
  const ind = aIndicadores(s);
  assert.deepEqual(JSON.parse(JSON.stringify(ind)), ind);
  assert.equal(ind.total.pct, 75);
  assert.equal(ind.porModulo.gym.pct, 100);
  assert.equal(ind.animo.animo, 4);
  assert.equal(ind.periodo.enCurso, true);
});

test('detalleHabitos filtra por módulo y ordena por nombre', () => {
  const todos = detalleHabitos(series, logs, LUN, HOY);
  assert.deepEqual(todos.map((d) => d.nombre), ['Agua', 'Entrenar']);
  const soloGym = detalleHabitos(series, logs, LUN, HOY, ['gym']);
  assert.equal(soloGym.length, 1);
  assert.equal(soloGym[0].cumplidos, 2);
});

test('filasDelDia: omite sin actividad, mantiene los 4 estados y marca extras', () => {
  // Lunes: gym no programado (sin actividad, se omite); agua cumplida.
  const lunes = filasDelDia(series, logs, LUN);
  assert.deepEqual(lunes.map((f) => f.nombre), ['Agua']);
  assert.equal(lunes[0].estado, 'cumplido');
  assert.equal(lunes[0].valor, 2.2);
  // Jueves: gym y agua sin registrar.
  const jueves = filasDelDia(series, logs, HOY);
  assert.deepEqual(jueves.map((f) => f.estado), ['no_registrado', 'no_registrado']);
  // Registro en día no programado (gym un lunes) aparece como extra.
  const conExtra = filasDelDia(series, [...logs, log('g', LUN, 'done')], LUN);
  assert.equal(conExtra.find((f) => f.nombre === 'Entrenar').extra, true);
});

test('registroDiarioMd: aclara que sin registrar no es incumplimiento y limpia saltos de línea', () => {
  const filas = filasDelDia(series, logs, '2026-11-10');
  const md = registroDiarioMd({ fecha: '2026-11-10', filas, entrada: { mood: 4, energy: 2, notes: 'Dormí mal\n\ny  con dolor' } });
  assert.match(md, /^## Registro diario · martes 10\/11/);
  assert.match(md, /Entrenar: cumplido/);
  assert.match(md, /Agua: NO cumplido \(1\.5 L · meta 2\)/);
  assert.match(md, /\*\*Notas:\*\* Dormí mal y con dolor/);
  assert.match(md, /\*\*Ánimo:\*\* 4\/5 · \*\*Energía:\*\* 2\/5/);
  const vacio = registroDiarioMd({ fecha: HOY, filas: filasDelDia(series, logs, HOY), entrada: null });
  assert.match(vacio, /2 sin registrar: es dato faltante, no incumplimiento/);
  assert.match(vacio, /\*\*Ánimo:\*\* sin registrar/);
});

test('informes: módulos sin hábitos o sin registros no se muestran como incumplimiento', () => {
  const s = calcularSemana({ series, logs: [], entradas: [], lunes: LUN, hoy: HOY });
  const area = indicadoresAreaMd(s, series, []);
  assert.match(area, /Gym: sin registros \(\d+ sin registrar; no cuenta como incumplimiento\)/);
  assert.match(area, /Vida: sin hábitos definidos todavía/);
  assert.doesNotMatch(area, /\d+ % cumplido/);                          // ningún % de cumplimiento inventado
  const sem = resumenSemanalMd(s);
  assert.match(sem, /Ánimo:\*\* sin datos ·/);
  assert.match(sem, /Cumplimiento:\*\* sin datos/);
  assert.doesNotMatch(sem, /Cumplimiento:\*\* 0 %/);
  const gral = informeGeneralMd(s);
  assert.match(gral, /Cumplimiento:\*\* sin datos \(registrado 0 %\)/);      // 0 % es cobertura, no cumplimiento
  assert.doesNotMatch(gral, /Cumplimiento:\*\* 0 %/);
});

test('nota para especialista: Gym incluye la regla fija y Pedagogo cubre Estudio', () => {
  const s = calcularSemana({ series, logs, lunes: LUN, hoy: HOY });
  const gymNota = notaEspecialistaMd(ESPECIALISTAS.find((e) => e.id === 'gym'), s, series, logs, { prioridades: ['Bajar de peso'] });
  assert.match(gymNota, /^## Nota para Gym/);
  assert.match(gymNota, /5 días por semana, de martes a sábado/);
  assert.match(gymNota, /1\) Bajar de peso/);
  assert.match(gymNota, /Entrenar: 2 cumplidos, 0 no cumplidos, 1 sin registrar/);
  const ped = ESPECIALISTAS.find((e) => e.id === 'pedagogo');
  assert.deepEqual(ped.modulos, ['estudio']);
  assert.match(notaEspecialistaMd(ped, s, series, logs), /Estudio: sin hábitos definidos todavía/);
  assert.equal(ESPECIALISTAS.length, 6);
});

test('INFORME GENERAL: nunca supera 15 líneas, ni siquiera en el peor caso', () => {
  // Peor caso: los seis módulos con datos, prioridades largas, decisiones muy largas.
  const mods = ['central', 'gym', 'nutri', 'vida', 'estudio', 'derma'];
  const defs = mods.map((m) => def({ id: 'id' + m, series_id: 's' + m, name: 'H' + m, module: m }));
  const grande = agruparPorSerie(defs);
  const l = defs.flatMap((d) => [log(d.id, '2026-11-09', 'done'), log(d.id, '2026-11-02', 'missed')]);
  const s = calcularSemana({ series: grande, logs: l, entradas: [], lunes: LUN, hoy: HOY });
  const md = informeGeneralMd(s, {
    prioridades: ['P'.repeat(300), 'Q'.repeat(300), 'R\nsalto'.repeat(50)],
    revision: { decisions: 'D\n'.repeat(500) }
  });
  assert.ok(md.split('\n').length <= MAX_LINEAS_GENERAL, 'líneas: ' + md.split('\n').length);
  assert.match(md, /^# INFORME GENERAL/);
  // Caso normal
  const normal = informeGeneralMd(calcularSemana({ series, logs, lunes: LUN, hoy: HOY }), { prioridades: ['Bajar de peso'] });
  assert.ok(normal.split('\n').length <= MAX_LINEAS_GENERAL);
  assert.match(normal, /\*\*Sin datos aún:\*\* Central, Vida, Estudio, Derma/);
  assert.match(normal, /Gym: 100 % \(reg\. 67 %\)/);
});

test('limitarLineas recorta y no toca textos cortos', () => {
  assert.equal(limitarLineas('a\nb\nc', 2), 'a\nb');
  assert.equal(limitarLineas('a\nb', 5), 'a\nb');
  assert.equal(limitarLineas(Array(40).fill('x').join('\n')).split('\n').length, 15);
});

test('semana cerrada: se rotula sin "en curso" y compara semanas completas', () => {
  const s = calcularSemana({ series, logs, lunes: '2026-11-02', hoy: HOY });
  assert.equal(s.periodo.enCurso, false);
  const md = comparacionMd(s);
  assert.doesNotMatch(md, /en curso/);
  assert.doesNotMatch(md, /mismo tramo/);
  assert.match(md, /Esta semana: 2\/11 al 8\/11/);
});

test('prioridadesAl: devuelve las que regían en esa fecha, no las de hoy', () => {
  const p = [
    { title: 'A', started_on: '2026-10-01', ended_on: null },
    { title: 'B', started_on: '2026-10-01', ended_on: '2026-11-05' },   // cerrada antes de esa semana
    { title: 'C', started_on: '2026-11-12', ended_on: null },           // empezó después
    { title: 'D', started_on: '2026-09-01', ended_on: '2026-11-20' }    // se cerró después: regía
  ];
  assert.deepEqual(prioridadesAl(p, '2026-11-09').map((x) => x.title), ['D', 'A']);
  assert.deepEqual(prioridadesAl(p, '2026-11-12').map((x) => x.title), ['D', 'A', 'C']);
  assert.deepEqual(prioridadesAl([], '2026-11-12'), []);
});

test('fmtEscala: sin datos no inventa un 0', () => {
  assert.equal(fmtEscala(null), 'sin datos');
  assert.equal(fmtEscala(3.5), '3,5/5');
  assert.equal(fmtEscala(0), '0/5');
});

test('armarInformes: devuelve los seis textos, respeta el día elegido y el tope de 15 líneas', async () => {
  const { armarInformes } = await import('../js/core/informes.js');
  const sem = calcularSemana({ series, logs, entradas: [{ entry_date: '2026-11-10', mood: 4, energy: 2, notes: 'ok' }], lunes: LUN, hoy: HOY });
  const r = armarInformes({
    sem, series, logs, entradas: [{ entry_date: '2026-11-10', mood: 4, energy: 2, notes: 'ok' }],
    fecha: '2026-11-10', especialista: 'gym', prioridades: ['Bajar de peso'], revision: { summary: 'Buena', decisions: 'Seguir' }
  });
  assert.deepEqual(Object.keys(r), ['general', 'diario', 'semanal', 'comparacion', 'areas', 'especialista']);
  for (const t of Object.values(r)) assert.ok(typeof t === 'string' && t.length > 20);
  assert.ok(r.general.split('\n').length <= MAX_LINEAS_GENERAL);
  assert.match(r.diario, /martes 10\/11/);
  assert.match(r.diario, /Ánimo:\*\* 4\/5/);
  assert.match(r.especialista, /^## Nota para Gym/);
  assert.match(r.semanal, /Mi resumen:\*\* Buena/);
  assert.match(r.general, /Decisiones:\*\* Seguir/);
  // Especialista desconocido => Central; día sin entrada => "sin registrar"
  const r2 = armarInformes({ sem, series, logs, entradas: [], fecha: HOY, especialista: 'inexistente' });
  assert.match(r2.especialista, /^## Nota para Central/);
  assert.match(r2.diario, /Ánimo:\*\* sin registrar/);
});

test('singular y plural correctos en los textos (1 día, 1 cumplido)', async () => {
  const { pl } = await import('../js/core/informes.js');
  assert.equal(pl(1, 'día', 'días'), '1 día');
  assert.equal(pl(0, 'día', 'días'), '0 días');
  assert.equal(pl(2, 'cumplido', 'cumplidos'), '2 cumplidos');
  const s = calcularSemana({ series, logs, entradas: [{ entry_date: LUN, mood: 4, energy: 3 }], lunes: LUN, hoy: HOY });
  assert.match(informeGeneralMd(s), /\(1 día con registro\)/);
  assert.match(indicadoresAreaMd(s, series, logs), /Agua: 1 cumplido, 1 no cumplido/);
});
