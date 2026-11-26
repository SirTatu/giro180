// Pruebas de js/core/macros.js (objetivos de macros, cumplido/excedido automáticos y cierre). Ejecutar con:
//   node --test tests/macros.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarHabitoMacro, validarObjetivo, objetivoDeVersion, planObjetivo, estadoVivo, estadoMacro, notaMacro,
  decidirSincronizacionMacro, decidirCierreMacros, textoResumenCierre, logsParaReabrir, NOTA_AUTO_MACRO, NOTA_CIERRE
} from '../js/core/macros.js';

const def = (o = {}) => ({ id: 'x', series_id: 's', module: 'nutri', kind: 'quantity', name: 'X', unit: 'g', target_value: 120, target_max: null,
  scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-01-01', valid_to: null, locked: false, ...o });
const PROT = def({ id: 'p', series_id: 'sp', name: 'Proteína diaria' });                                   // al menos 120 g
const ENTRE = def({ id: 'c', series_id: 'sc', name: 'Calorías', unit: 'kcal', target_value: 1500, target_max: 2000 });
const MAX = def({ id: 'm', series_id: 'sm', name: 'Calorías', unit: 'kcal', target_value: 0, target_max: 2000 });
const log = (status, value, note, habit_id = 'p') => ({ id: 'l' + habit_id, habit_id, log_date: '2026-03-10', status, value, note });

test('buscarHabitoMacro: cada macro por su nombre; el agua no se confunde; estricto', () => {
  const defs = [
    def({ id: 'a', series_id: 'sa', name: 'Agua', unit: 'L', target_value: 3 }), PROT, ENTRE,
    def({ id: 'h', series_id: 'sh', name: 'Carbohidratos' }), def({ id: 'g', series_id: 'sg', name: 'Grasas' }),
    def({ id: 'z', series_id: 'sz', module: 'gym', name: 'Calorías quemadas', unit: 'kcal' })
  ];
  assert.equal(buscarHabitoMacro(defs, '2026-03-10', 'protein').version.id, 'p');
  assert.equal(buscarHabitoMacro(defs, '2026-03-10', 'kcal').version.id, 'c');            // el de Gym no cuenta
  assert.equal(buscarHabitoMacro(defs, '2026-03-10', 'carbs').version.id, 'h');
  assert.equal(buscarHabitoMacro(defs, '2026-03-10', 'fat').version.id, 'g');
  assert.equal(buscarHabitoMacro([defs[0]], '2026-03-10', 'protein').motivo, 'sin_habito');   // solo hay agua: NO la toma por proteína
  assert.equal(buscarHabitoMacro([PROT, def({ id: 'p2', series_id: 'sp2', name: 'Proteínas extra' })], '2026-03-10', 'protein').motivo, 'ambiguo');
});

test('validarObjetivo: al menos / como máximo / entre / ninguno', () => {
  assert.deepEqual(validarObjetivo({ macroId: 'protein', tipo: 'al_menos', minimo: '120' }).datos, { target_value: 120, target_max: null });
  assert.deepEqual(validarObjetivo({ macroId: 'kcal', tipo: 'maximo', maximo: '2000' }).datos, { target_value: 0, target_max: 2000 });
  assert.deepEqual(validarObjetivo({ macroId: 'kcal', tipo: 'entre', minimo: '1500,5', maximo: '2000' }).datos, { target_value: 1500.5, target_max: 2000 });
  assert.deepEqual(validarObjetivo({ macroId: 'kcal', tipo: 'entre', minimo: '1800', maximo: '1800' }).datos, { target_value: 1800, target_max: 1800 });   // exacto
  assert.deepEqual(validarObjetivo({ macroId: 'kcal', tipo: 'ninguno' }), { error: null, datos: null });
});

test('validarObjetivo: rechazos', () => {
  const e = (o) => validarObjetivo({ macroId: 'kcal', ...o }).error;
  assert.match(e({ tipo: 'entre', minimo: '2000', maximo: '1500' }), /no puede ser menor/);
  assert.match(e({ tipo: 'al_menos', minimo: '' }), /Escribí el mínimo/);
  assert.match(e({ tipo: 'maximo', maximo: '' }), /Escribí el máximo/);
  for (const [tipo, campo, v] of [['al_menos', 'minimo', '0'], ['al_menos', 'minimo', '-5'], ['maximo', 'maximo', 'abc'], ['maximo', 'maximo', '20001'], ['entre', 'minimo', '10,55']]) {
    assert.match(e({ tipo, minimo: '100', maximo: '200', [campo]: v }), /Revisá/, `${tipo} ${v}`);
  }
  assert.ok(e({ tipo: 'raro' }));
  assert.match(validarObjetivo({ macroId: 'nada', tipo: 'al_menos', minimo: '1' }).error, /desconocida/);
  assert.match(validarObjetivo({ macroId: 'protein', tipo: 'al_menos', minimo: '1001' }).error, /1001|hasta 1000/);   // proteína: tope 1000
});

test('objetivoDeVersion: rellena el formulario con el objetivo actual', () => {
  assert.deepEqual(objetivoDeVersion(PROT), { tipo: 'al_menos', minimo: '120', maximo: '' });
  assert.deepEqual(objetivoDeVersion(ENTRE), { tipo: 'entre', minimo: '1500', maximo: '2000' });
  assert.deepEqual(objetivoDeVersion(MAX), { tipo: 'maximo', minimo: '', maximo: '2000' });
  assert.deepEqual(objetivoDeVersion(null), { tipo: 'ninguno', minimo: '', maximo: '' });
});

const hab = (versiones, vigente = undefined) => ({ versiones, version: vigente === undefined ? versiones.find((v) => v.valid_to == null) ?? null : vigente, motivo: null });
const HOY = '2026-03-10';
const D = (target_value, target_max) => ({ target_value, target_max });

test('planObjetivo: macro sin hábito → crear (nombre y unidad de la macro)', () => {
  const p = planObjetivo({ macroId: 'kcal', hab: { versiones: [], version: null, motivo: 'sin_habito' }, tipo: 'entre', datos: D(1500, 2000), desde: HOY, hoyFecha: HOY, tieneLogs: false });
  assert.equal(p.accion, 'crear');
  assert.deepEqual(p.campos, { module: 'nutri', name: 'Calorías', kind: 'quantity', unit: 'kcal', target_value: 1500, target_max: 2000, scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: HOY, locked: false });
  assert.match(planObjetivo({ macroId: 'kcal', hab: { versiones: [], version: null }, tipo: 'entre', datos: D(1, 2), desde: '', hoyFecha: HOY }).error, /desde cuándo/);
});

test('planObjetivo: sin registros se corrige en el lugar; con registros nace una versión nueva (el historial no cambia)', () => {
  const sinLogs = planObjetivo({ macroId: 'protein', hab: hab([PROT]), tipo: 'entre', datos: D(120, 160), desde: HOY, hoyFecha: HOY, tieneLogs: false });
  assert.deepEqual([sinLogs.accion, sinLogs.id, sinLogs.campos], ['corregir', 'p', { target_value: 120, target_max: 160 }]);
  const conLogs = planObjetivo({ macroId: 'protein', hab: hab([PROT]), tipo: 'entre', datos: D(120, 160), desde: '2026-03-11', hoyFecha: HOY, tieneLogs: true });
  assert.equal(conLogs.accion, 'nueva_version');
  assert.equal(conLogs.anterior.id, 'p');
  assert.equal(conLogs.desde, '2026-03-11');
  assert.deepEqual(conLogs.campos, { name: 'Proteína diaria', kind: 'quantity', unit: 'g', scheduled_days: [1, 2, 3, 4, 5, 6, 7], target_value: 120, target_max: 160 });
  assert.match(planObjetivo({ macroId: 'protein', hab: hab([PROT]), tipo: 'entre', datos: D(120, 160), desde: '2026-01-01', hoyFecha: HOY, tieneLogs: true }).error, /posterior al inicio/);
  assert.match(planObjetivo({ macroId: 'protein', hab: hab([PROT]), tipo: 'entre', datos: D(120, 160), desde: '', hoyFecha: HOY, tieneLogs: true }).error, /posterior al inicio/);
});

test('planObjetivo: sin cambios no hace nada', () => {
  const p = planObjetivo({ macroId: 'kcal', hab: hab([ENTRE]), tipo: 'entre', datos: D(1500, 2000), desde: HOY, hoyFecha: HOY, tieneLogs: true });
  assert.deepEqual([p.accion, p.error], ['ninguna', null]);
  const q = planObjetivo({ macroId: 'protein', hab: hab([PROT]), tipo: 'al_menos', datos: D(120, null), desde: HOY, hoyFecha: HOY, tieneLogs: true });
  assert.equal(q.accion, 'ninguna');
});

test('planObjetivo: quitar el objetivo cierra la versión el día anterior', () => {
  const p = planObjetivo({ macroId: 'kcal', hab: hab([ENTRE]), tipo: 'ninguno', datos: null, desde: '2026-03-15', hoyFecha: HOY, tieneLogs: true });
  assert.deepEqual([p.accion, p.id, p.valid_to], ['cerrar', 'c', '2026-03-14']);
  assert.match(planObjetivo({ macroId: 'kcal', hab: hab([ENTRE]), tipo: 'ninguno', datos: null, desde: '2026-01-01', hoyFecha: HOY }).error, /posterior al inicio/);
  assert.equal(planObjetivo({ macroId: 'kcal', hab: { versiones: [], version: null }, tipo: 'ninguno', datos: null, desde: HOY, hoyFecha: HOY }).accion, 'ninguna');
});

test('planObjetivo: reactivar una macro cuyo objetivo se cerró usa la MISMA serie (no crea un hábito duplicado)', () => {
  const cerrado = { ...ENTRE, valid_to: '2026-02-28' };
  const p = planObjetivo({ macroId: 'kcal', hab: { versiones: [cerrado], version: null, motivo: 'sin_version_vigente' }, tipo: 'maximo', datos: D(0, 2200), desde: '2026-03-01', hoyFecha: HOY, tieneLogs: false });
  assert.equal(p.accion, 'reabrir_serie');
  assert.equal(p.campos.series_id, 'sc');
  assert.deepEqual([p.campos.target_value, p.campos.target_max, p.campos.valid_from, p.campos.name], [0, 2200, '2026-03-01', 'Calorías']);
  assert.match(planObjetivo({ macroId: 'kcal', hab: { versiones: [cerrado], version: null }, tipo: 'maximo', datos: D(0, 2200), desde: '2026-02-20', hoyFecha: HOY }).error, /posterior al fin/);
  assert.match(planObjetivo({ macroId: 'kcal', hab: { versiones: [{ ...ENTRE, valid_from: '2026-04-01' }], version: null }, tipo: 'maximo', datos: D(0, 2200), desde: HOY, hoyFecha: HOY }).error, /todavía no empezó/);
});

test('planObjetivo: con más de un hábito de la macro no se toca nada', () => {
  assert.match(planObjetivo({ macroId: 'protein', hab: { versiones: [], version: null, motivo: 'ambiguo' }, tipo: 'al_menos', datos: D(1, null), desde: HOY, hoyFecha: HOY }).error, /más de un hábito/);
});

test('estadoVivo, estadoMacro y notaMacro: sin completar nunca es incumplido', () => {
  assert.equal(estadoVivo(ENTRE, 1499), 'por_debajo');
  assert.equal(estadoVivo(ENTRE, 1500), 'dentro');
  assert.equal(estadoVivo(ENTRE, 2000), 'dentro');
  assert.equal(estadoVivo(ENTRE, 2001), 'excedido');
  assert.equal(estadoVivo(PROT, 5000), 'dentro');                       // sin máximo nunca excede
  assert.equal(estadoVivo(null, 100), null);
  assert.equal(estadoVivo(ENTRE, null), null);
  const e = (version, total, log, hayComidas = true) => estadoMacro({ version, total, log, notaAuto: NOTA_AUTO_MACRO.protein, hayComidas });
  assert.deepEqual(e(null, 100, null), { estado: null, cerrado: false });
  assert.deepEqual(e(PROT, null, null, false), { estado: 'no_registrado', cerrado: false });
  assert.deepEqual(e(PROT, null, null), { estado: 'sin_dato', cerrado: false });
  assert.deepEqual(e(PROT, 80, null), { estado: 'sin_completar', cerrado: false });
  assert.deepEqual(e(MAX, 1200, null), { estado: 'dentro_del_limite', cerrado: false });
  assert.deepEqual(e(ENTRE, 1800, null), { estado: 'dentro_del_rango', cerrado: false });
  assert.deepEqual(e(ENTRE, 2500, null), { estado: 'excedido', cerrado: false });
  assert.deepEqual(e(PROT, 130, log('done', 130, 'auto-proteina')), { estado: 'cumplido', cerrado: false });
  assert.deepEqual(e(PROT, 130, log('missed', 80, 'cierre-dia')), { estado: 'incumplido', cerrado: true });
  assert.deepEqual(e(ENTRE, 2500, log('exceeded', 2500, 'cierre-dia')), { estado: 'excedido', cerrado: true });
  const n = (version, total, estado, cerrado = false) => notaMacro({ version, total, estado, cerrado, unidad: 'kcal' });
  assert.equal(n(ENTRE, 1200, 'sin_completar'), 'faltan 300 kcal para el mínimo');
  assert.equal(n(MAX, 1200, 'dentro_del_limite'), 'dentro del límite · quedan 800 kcal');
  assert.equal(n(ENTRE, 2300, 'excedido'), 'te pasaste por 300 kcal');
  assert.equal(n(ENTRE, 1800, 'cumplido', true), 'dentro del rango · día cerrado');
  assert.equal(n(MAX, 1800, 'cumplido'), 'dentro del límite');
  assert.equal(n(PROT, 130, 'cumplido'), 'objetivo cumplido');
  assert.equal(n(ENTRE, 1000, 'incumplido', true), 'no llegaste al mínimo · día cerrado');
  assert.equal(n(ENTRE, null, 'sin_dato'), '');
});

const A = NOTA_AUTO_MACRO;
test('Sincronización «al menos» (proteína): igual que siempre — cumplido solo al llegar, nunca incumplido solo', () => {
  const s = (total, log) => decidirSincronizacionMacro({ version: PROT, total, log, notaAuto: A.protein });
  assert.equal(s(119.9, null).accion, 'ninguna');
  assert.deepEqual(s(120, null), { accion: 'guardar', status: 'done', value: 120, note: 'auto-proteina' });
  assert.equal(s(120, log('done', 120, A.protein)).accion, 'ninguna');
  assert.equal(s(140, log('done', 120, A.protein)).value, 140);
  assert.equal(s(90, log('done', 120, A.protein)).accion, 'quitar');
  assert.equal(s(null, log('done', 120, A.protein)).accion, 'quitar');
  assert.equal(s(5000, null).status, 'done');                                       // sin máximo nunca excedido
  for (const total of [0, 90, 200, null]) assert.equal(s(total, log('missed', 50, NOTA_CIERRE)).accion, 'ninguna');   // un cierre no se toca
  assert.equal(s(100, log('done', 9, 'auto-agua')).accion, 'ninguna');             // otra marca = decisión ajena
  assert.equal(decidirSincronizacionMacro({ version: null, total: 500, log: null, notaAuto: A.protein }).accion, 'ninguna');
});

test('Sincronización «entre»: cumplido al llegar al mínimo, excedido al pasar el máximo, y vuelve si corregís', () => {
  const s = (total, log) => decidirSincronizacionMacro({ version: ENTRE, total, log, notaAuto: A.kcal });
  assert.equal(s(1499, null).accion, 'ninguna');
  assert.deepEqual(s(1500, null), { accion: 'guardar', status: 'done', value: 1500, note: 'auto-calorias' });
  assert.deepEqual(s(2000, null), { accion: 'guardar', status: 'done', value: 2000, note: 'auto-calorias' });          // el máximo es inclusive
  assert.deepEqual(s(2001, log('done', 1900, A.kcal, 'c')), { accion: 'guardar', status: 'exceeded', value: 2001, note: 'auto-calorias' });
  assert.deepEqual(s(1800, log('exceeded', 2300, A.kcal, 'c')), { accion: 'guardar', status: 'done', value: 1800, note: 'auto-calorias' });   // corregiste y volvió
  assert.equal(s(1000, log('exceeded', 2300, A.kcal, 'c')).accion, 'quitar');
  assert.equal(s(2300, log('exceeded', 2300, A.kcal, 'c')).accion, 'ninguna');
});

test('Sincronización «como máximo»: NUNCA cumplido a mitad del día; excedido sí, enseguida', () => {
  const s = (total, log) => decidirSincronizacionMacro({ version: MAX, total, log, notaAuto: A.kcal });
  assert.equal(s(1, null).accion, 'ninguna');                                       // el primer bocado no es «cumplido»
  assert.equal(s(1999, null).accion, 'ninguna');
  assert.equal(s(2000, null).accion, 'ninguna');                                    // justo en el límite: todavía dentro, lo decide el cierre
  assert.deepEqual(s(2001, null), { accion: 'guardar', status: 'exceeded', value: 2001, note: 'auto-calorias' });
  assert.equal(s(1500, log('exceeded', 2300, A.kcal, 'm')).accion, 'quitar');       // borraste una comida: vuelve a estar dentro
  assert.equal(s(null, log('exceeded', 2300, A.kcal, 'm')).accion, 'quitar');
  assert.equal(s(2500, log('done', 1800, NOTA_CIERRE, 'm')).accion, 'ninguna');     // cerrado: no se toca
});

const fila = (macroId, nombre, version, total, sinDato = 0, lg = null) => ({ macroId, nombre, version, total, sinDato, log: lg });
test('Cierre del día: un solo botón para todas las macros con objetivo y datos', () => {
  const filas = [fila('kcal', 'Calorías', MAX, 1800), fila('carbs', 'Carbohidratos', null, 200), fila('protein', 'Proteínas', PROT, 90), fila('fat', 'Grasas', def({ id: 'g', target_value: 0, target_max: 70 }), 85)];
  const c = decidirCierreMacros({ filas, hayComidas: true, fecha: HOY, hoyFecha: HOY });
  assert.equal(c.error, null);
  assert.deepEqual(c.escribir.map((e) => [e.macroId, e.status, e.value, e.note]), [
    ['kcal', 'done', 1800, NOTA_CIERRE],                     // como máximo: cumplido recién al cerrar
    ['protein', 'missed', 90, NOTA_CIERRE],                  // por debajo del mínimo: incumplido
    ['fat', 'exceeded', 85, NOTA_CIERRE]                     // pasó el máximo: excedido
  ]);
  assert.deepEqual(c.resumen, { cumplidas: 1, incumplidas: 1, excedidas: 1 });
  assert.equal(c.confirmar, null);                           // todo con datos completos: sin confirmación
  assert.equal(textoResumenCierre(c.resumen), '1 cumplida, 1 incumplida, 1 excedida');
  assert.equal(textoResumenCierre({ cumplidas: 2, incumplidas: 0, excedidas: 0 }), '2 cumplidas');
});

test('Cierre del día: pide confirmación si faltan datos y no cierra lo que no tiene ninguno', () => {
  const filas = [fila('kcal', 'Calorías', ENTRE, 1800, 1), fila('protein', 'Proteínas', PROT, null, 3), fila('fat', 'Grasas', null, null)];
  const c = decidirCierreMacros({ filas, hayComidas: true, fecha: HOY, hoyFecha: HOY });
  assert.deepEqual(c.escribir.map((e) => e.macroId), ['kcal']);
  assert.deepEqual(c.omitidas, ['Proteínas']);
  assert.match(c.confirmar, /Hay comidas sin dato de calorías/);
  assert.match(c.confirmar, /Sin ningún dato y sin cerrar: proteínas/);
  assert.match(c.confirmar, /¿Cerrar el día igual\?$/);
});

test('Cierre del día: errores', () => {
  const ok = [fila('protein', 'Proteínas', PROT, 130)];
  assert.match(decidirCierreMacros({ filas: ok, hayComidas: true, fecha: '2026-03-11', hoyFecha: HOY }).error, /todavía no llegó/);
  assert.match(decidirCierreMacros({ filas: ok, hayComidas: false, fecha: HOY, hoyFecha: HOY }).error, /No hay comidas/);
  assert.match(decidirCierreMacros({ filas: [fila('protein', 'Proteínas', null, 130)], hayComidas: true, fecha: HOY, hoyFecha: HOY }).error, /No hay objetivos/);
  assert.match(decidirCierreMacros({ filas: [fila('protein', 'Proteínas', PROT, null, 2)], hayComidas: true, fecha: HOY, hoyFecha: HOY }).error, /Ninguna macro con objetivo tiene datos/);
  const cerrada = [fila('protein', 'Proteínas', PROT, 130, 0, log('done', 130, NOTA_CIERRE))];
  assert.match(decidirCierreMacros({ filas: cerrada, hayComidas: true, fecha: HOY, hoyFecha: HOY }).error, /ya está cerrado/);
});

test('Cierre del día: una macro ya cerrada no se vuelve a escribir; la automática sí se cierra', () => {
  const filas = [fila('protein', 'Proteínas', PROT, 130, 0, log('done', 130, NOTA_CIERRE)), fila('kcal', 'Calorías', ENTRE, 1800, 0, log('done', 1800, A.kcal, 'c'))];
  const c = decidirCierreMacros({ filas, hayComidas: true, fecha: HOY, hoyFecha: HOY });
  assert.deepEqual(c.escribir.map((e) => e.macroId), ['kcal']);
  assert.equal(c.escribir[0].note, NOTA_CIERRE);                          // pasa de automático a cierre manual
});

test('logsParaReabrir: solo los registros cerrados (no los automáticos)', () => {
  const filas = [
    fila('protein', 'Proteínas', PROT, 130, 0, log('done', 130, NOTA_CIERRE)),
    fila('kcal', 'Calorías', ENTRE, 1800, 0, log('done', 1800, A.kcal, 'c')),
    fila('fat', 'Grasas', null, 50, 0, log('missed', 50, NOTA_CIERRE, 'g')),
    fila('carbs', 'Carbohidratos', def({ id: 'h' }), 100, 0, null)
  ];
  assert.deepEqual(logsParaReabrir(filas).map((l) => l.habit_id), ['p']);     // grasas no tiene objetivo vigente: no se toca
});
