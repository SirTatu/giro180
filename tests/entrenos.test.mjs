// Pruebas de js/core/entrenos.js (ejemplos inventados). Ejecutar con:  node --test tests/entrenos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsearNumero, formatoNumero, formatoSerie, textoObjetivo, totales, mejorSerie, agruparPorEjercicio, validarFilas,
  armarEntrenamiento, bloquesIniciales, ultimasPorEjercicio, totalesPorSesion, totalesPorSemana, progresionEjercicio,
  buscarHabitoEntrenar
} from '../js/core/entrenos.js';

test('parsearNumero: coma o punto, vacío = null, basura = NaN', () => {
  assert.equal(parsearNumero('82,5'), 82.5);
  assert.equal(parsearNumero(' 80 '), 80);
  assert.equal(parsearNumero(''), null);
  assert.equal(parsearNumero(null), null);
  for (const mal of ['-5', 'abc', '1e3', '8 kg', '1,2,3']) assert.ok(Number.isNaN(parsearNumero(mal)), mal);
});

test('formatos', () => {
  assert.equal(formatoNumero(82.5), '82,5');
  assert.equal(formatoNumero(80), '80');
  assert.equal(formatoNumero('62.50'), '62,5');
  assert.equal(formatoSerie({ weight_kg: 82.5, reps: 8 }), '82,5 kg × 8');
  assert.equal(formatoSerie({ weight_kg: null, reps: 12 }), '12 reps');
  assert.equal(textoObjetivo({ series: 4, min: 6, max: 8 }), '4 × 6-8');
  assert.equal(textoObjetivo({ series: 3, min: 10, max: 10 }), '3 × 10');
  assert.equal(textoObjetivo({ series: null, min: 6, max: 8 }), '6-8 reps');
  assert.equal(textoObjetivo({ series: 3, min: null, max: null }), '3 series');
  assert.equal(textoObjetivo(null), '');
});

test('totales: volumen solo con peso; las series sin peso se informan aparte', () => {
  const t = totales([{ reps: 8, weight_kg: 80 }, { reps: 7, weight_kg: 80 }, { reps: 10, weight_kg: null }, { reps: 5, weight_kg: 82.5 }]);
  assert.deepEqual(t, { series: 4, reps: 30, volumen: 1612.5, sinPeso: 1 });
  assert.deepEqual(totales([]), { series: 0, reps: 0, volumen: 0, sinPeso: 0 });
  assert.equal(totales([{ reps: 3, weight_kg: 0.1 }, { reps: 3, weight_kg: 0.2 }]).volumen, 0.9);   // sin ruido de coma flotante
});

test('mejorSerie y agruparPorEjercicio', () => {
  assert.deepEqual(mejorSerie([{ reps: 8, weight_kg: 80 }, { reps: 6, weight_kg: 85 }, { reps: 7, weight_kg: 85 }]), { weight_kg: 85, reps: 7 });
  assert.equal(mejorSerie([{ reps: 10, weight_kg: null }]), null);
  const g = agruparPorEjercicio([{ exercise_id: 'a', set_no: 2 }, { exercise_id: 'a', set_no: 1 }, { exercise_id: 'b', set_no: 1 }]);
  assert.deepEqual(g.get('a').map((s) => s.set_no), [1, 2]);
});

test('validarFilas: ignora vacías, exige repeticiones y valida rangos', () => {
  const ok = validarFilas([{ peso: '80', reps: '8' }, { peso: '', reps: '' }, { peso: '', reps: '12' }], 'Remo');
  assert.deepEqual(ok.sets, [{ reps: 8, weight_kg: 80 }, { reps: 12, weight_kg: null }]);
  assert.deepEqual(ok.errores, []);
  const mal = validarFilas([{ peso: '80', reps: '' }, { peso: 'x', reps: '5' }, { peso: '10', reps: '2,5' }, { peso: '10000', reps: '5' }, { peso: '1,234', reps: '5' }, { peso: '10', reps: '501' }], 'Remo');
  assert.equal(mal.sets.length, 0);
  assert.equal(mal.errores.length, 6);
  assert.match(mal.errores[0], /Remo, serie 1: falta cargar/);
  assert.equal(validarFilas([{ peso: '', reps: '0' }]).sets.length, 1);          // 0 repeticiones es válido (serie fallida)
});

test('armarEntrenamiento: numera series, guarda la foto del objetivo y no guarda lo saltado', () => {
  const r = armarEntrenamiento([
    { exerciseId: 'a', nombre: 'A', objetivo: { series: 3, min: 8, max: 10 }, saltado: false, filas: [{ peso: '50', reps: '10' }, { peso: '', reps: '' }, { peso: '50', reps: '9' }] },
    { exerciseId: 'b', nombre: 'B', objetivo: null, saltado: true, filas: [{ peso: '10', reps: '10' }] },
    { exerciseId: 'c', nombre: 'C', objetivo: null, saltado: false, filas: [{ peso: '', reps: '' }] }        // sin datos: no cuenta, no es error
  ]);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.sets, [
    { exercise_id: 'a', set_no: 1, reps: 10, weight_kg: 50, target_sets: 3, target_reps_min: 8, target_reps_max: 10 },
    { exercise_id: 'a', set_no: 2, reps: 9, weight_kg: 50, target_sets: 3, target_reps_min: 8, target_reps_max: 10 }
  ]);
  assert.equal(r.totales.volumen, 950);
});

test('armarEntrenamiento: errores (nada cargado, ejercicio repetido, series inválidas)', () => {
  assert.match(armarEntrenamiento([]).errores[0], /al menos una serie/);
  const dup = armarEntrenamiento([
    { exerciseId: 'a', nombre: 'A', objetivo: null, saltado: false, filas: [{ peso: '1', reps: '1' }] },
    { exerciseId: 'a', nombre: 'A', objetivo: null, saltado: false, filas: [{ peso: '1', reps: '1' }] }
  ]);
  assert.match(dup.errores.join(' '), /dos veces/);
  const inv = armarEntrenamiento([{ exerciseId: 'a', nombre: 'A', objetivo: null, saltado: false, filas: [{ peso: '5', reps: '' }] }]);
  assert.match(inv.errores[0], /falta cargar/);
});

const ejercicios = [{ id: 'a', name: 'Press' }, { id: 'b', name: 'Remo' }, { id: 'c', name: 'Plancha' }];
const items = [
  { exercise_id: 'b', sort_order: 2, target_sets: 2, reps_min: 10, reps_max: 12 },
  { exercise_id: 'a', sort_order: 1, target_sets: 3, reps_min: 6, reps_max: 8 }
];

test('bloquesIniciales: sesión nueva → filas vacías según el objetivo, en el orden de la rutina, con la última vez', () => {
  const ultimas = new Map([['a', { fecha: '2026-11-10', sets: [{ reps: 8, weight_kg: 60, set_no: 1 }] }]]);
  const b = bloquesIniciales({ items, ejercicios, ultimas });
  assert.deepEqual(b.map((x) => x.nombre), ['Press', 'Remo']);
  assert.equal(b[0].filas.length, 3);
  assert.equal(b[1].filas.length, 2);
  assert.deepEqual(b[0].filas[0], { peso: '', reps: '' });
  assert.equal(b[0].ultima.fecha, '2026-11-10');
  assert.equal(b[1].ultima, null);
  assert.deepEqual(b[0].objetivo, { series: 3, min: 6, max: 8 });
});

test('bloquesIniciales: al EDITAR, el objetivo sale de la foto guardada (no de la rutina actual) y los extras reaparecen', () => {
  const setsSesion = [
    { exercise_id: 'a', set_no: 1, reps: 7, weight_kg: 62.5, target_sets: 4, target_reps_min: 5, target_reps_max: 7 },   // la rutina hoy dice 3 × 6-8
    { exercise_id: 'c', set_no: 1, reps: 40, weight_kg: null, target_sets: null, target_reps_min: null, target_reps_max: null }
  ];
  const b = bloquesIniciales({ items, ejercicios, setsSesion });
  assert.deepEqual(b.map((x) => x.nombre), ['Press', 'Remo', 'Plancha']);
  assert.deepEqual(b[0].objetivo, { series: 4, min: 5, max: 7 });          // foto, no la rutina
  assert.deepEqual(b[0].filas, [{ peso: '62,5', reps: '7' }]);
  assert.equal(b[1].filas.length, 2);                                       // sin series guardadas: vacío con el objetivo de la rutina
  assert.equal(b[2].origen, 'extra');
  assert.equal(b[2].objetivo, null);
  assert.deepEqual(b[2].filas, [{ peso: '', reps: '40' }]);
  // y volver a guardar sin tocar nada conserva la foto
  const r = armarEntrenamiento(b);
  assert.equal(r.sets.find((s) => s.exercise_id === 'a').target_sets, 4);
});

test('ultimasPorEjercicio: toma la sesión más reciente donde aparece cada ejercicio', () => {
  const sesiones = [{ id: 's1', performed_on: '2026-11-03' }, { id: 's2', performed_on: '2026-11-10' }];
  const sets = [
    { session_id: 's1', exercise_id: 'a', set_no: 1, reps: 8, weight_kg: 50 },
    { session_id: 's2', exercise_id: 'a', set_no: 2, reps: 7, weight_kg: 55 },
    { session_id: 's2', exercise_id: 'a', set_no: 1, reps: 8, weight_kg: 55 },
    { session_id: 's1', exercise_id: 'b', set_no: 1, reps: 10, weight_kg: 30 },
    { session_id: 'otra', exercise_id: 'b', set_no: 1, reps: 1, weight_kg: 1 }        // sesión desconocida: se ignora
  ];
  const u = ultimasPorEjercicio(sesiones, sets);
  assert.equal(u.get('a').fecha, '2026-11-10');
  assert.deepEqual(u.get('a').sets.map((s) => s.set_no), [1, 2]);
  assert.equal(u.get('b').fecha, '2026-11-03');
  assert.equal(u.size, 2);
});

const SES = [
  { id: 's1', performed_on: '2026-11-03' }, { id: 's2', performed_on: '2026-11-06' },   // semana del 2
  { id: 's3', performed_on: '2026-11-10' }                                              // semana del 9
];
const SETS = [
  { session_id: 's1', exercise_id: 'a', set_no: 1, reps: 10, weight_kg: 50 },
  { session_id: 's1', exercise_id: 'a', set_no: 2, reps: 10, weight_kg: 50 },
  { session_id: 's2', exercise_id: 'a', set_no: 1, reps: 10, weight_kg: 55 },
  { session_id: 's2', exercise_id: 'b', set_no: 1, reps: 12, weight_kg: null },
  { session_id: 's3', exercise_id: 'a', set_no: 1, reps: 8, weight_kg: 60 }
];

test('totalesPorSesion y totalesPorSemana (semana lunes-domingo, la más nueva primero)', () => {
  const t = totalesPorSesion(SES, SETS);
  assert.deepEqual(t.get('s1'), { series: 2, reps: 20, volumen: 1000, sinPeso: 0 });
  assert.deepEqual(t.get('s2'), { series: 2, reps: 22, volumen: 550, sinPeso: 1 });
  const sem = totalesPorSemana(SES, SETS);
  assert.deepEqual(sem.map((s) => s.semana), ['2026-11-09', '2026-11-02']);
  assert.deepEqual(sem[1], { semana: '2026-11-02', sesiones: 2, series: 4, reps: 42, volumen: 1550, sinPeso: 1 });
  assert.equal(sem[0].sesiones, 1);
});

test('progresionEjercicio: orden por fecha, cambio de volumen y «sin base» en la primera', () => {
  const p = progresionEjercicio(SES, SETS, 'a');
  assert.deepEqual(p.map((x) => x.fecha), ['2026-11-03', '2026-11-06', '2026-11-10']);
  assert.equal(p[0].deltaVolumen, null);                                    // primera: sin base de comparación
  assert.equal(p[1].volumen, 550);
  assert.equal(p[1].deltaVolumen, -45);                                     // 550 vs 1000
  assert.deepEqual(p[2].mejor, { weight_kg: 60, reps: 8 });
  assert.equal(p[2].deltaVolumen, -12.7);                                   // 480 vs 550
  assert.deepEqual(progresionEjercicio(SES, SETS, 'zzz'), []);
  // ejercicio sin peso: no hay base para comparar volumen
  const sinPeso = progresionEjercicio(SES, [{ session_id: 's1', exercise_id: 'p', set_no: 1, reps: 10, weight_kg: null }, { session_id: 's2', exercise_id: 'p', set_no: 1, reps: 12, weight_kg: null }], 'p');
  assert.equal(sinPeso[1].deltaVolumen, null);
});

const habito = (o) => ({ id: 'h' + Math.random(), series_id: o.series_id, name: 'Entrenar', module: 'gym', kind: 'boolean', locked: true,
  scheduled_days: [2, 3, 4, 5, 6], valid_from: '2026-01-01', valid_to: null, ...o });

test('buscarHabitoEntrenar: versión vigente del día, programado o extra', () => {
  const v1 = habito({ id: 'v1', series_id: 's', valid_to: '2026-06-30', scheduled_days: [1, 3] });
  const v2 = habito({ id: 'v2', series_id: 's', valid_from: '2026-07-01' });
  const defs = [v1, v2, habito({ id: 'pasos', series_id: 'p', name: 'Pasos', kind: 'quantity', locked: false })];
  const martes = buscarHabitoEntrenar(defs, '2026-11-17');                  // martes
  assert.equal(martes.version.id, 'v2');
  assert.equal(martes.programado, true);
  assert.equal(buscarHabitoEntrenar(defs, '2026-11-15').programado, false);   // domingo: queda como extra
  assert.equal(buscarHabitoEntrenar(defs, '2026-03-04').version.id, 'v1');    // la versión de ESE día, no la actual
  assert.equal(buscarHabitoEntrenar(defs, '2025-12-31').motivo, 'sin_version_vigente');
});

test('buscarHabitoEntrenar: sin hábito, nombre distinto y ambigüedad', () => {
  assert.equal(buscarHabitoEntrenar([], '2026-11-17').motivo, 'sin_habito');
  assert.equal(buscarHabitoEntrenar([habito({ id: 'x', series_id: 'x', module: 'nutri' })], '2026-11-17').motivo, 'sin_habito');
  const gimnasio = habito({ id: 'g', series_id: 'g', name: 'Gimnasio' });
  assert.equal(buscarHabitoEntrenar([gimnasio], '2026-11-17').version.id, 'g');
  const dos = [habito({ id: 'a', series_id: 'a', name: 'Movilidad', locked: false }), habito({ id: 'b', series_id: 'b', name: 'Estiramiento', locked: false })];
  assert.equal(buscarHabitoEntrenar(dos, '2026-11-17').motivo, 'ambiguo');
  // con dos candidatos, se prefiere el de nombre entrenar/gimnasio, y luego el bloqueado
  const mezcla = [habito({ id: 'a', series_id: 'a', name: 'Movilidad', locked: false }), habito({ id: 'b', series_id: 'b', name: 'Entrenar' })];
  assert.equal(buscarHabitoEntrenar(mezcla, '2026-11-17').version.id, 'b');
});
