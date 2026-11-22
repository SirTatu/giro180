// Pruebas de js/core/areas.js y de su integración en informes.js (ejemplos inventados). Ejecutar con:
//   node --test tests/areas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorSerie } from '../js/core/estados.js';
import { calcularSemana, armarInformes, informeGeneralMd, MAX_LINEAS_GENERAL, ESPECIALISTAS } from '../js/core/informes.js';
import { calcularAreas, fragmentosCortos, lineasArea, lineasComparacion, lineasDia, hayDatosArea } from '../js/core/areas.js';

const LUN = '2026-11-09', HOY = '2026-11-12';           // semana en curso: lun 9 a jue 12; anterior: lun 2 a jue 5
const def = (o) => ({ id: 'x', series_id: 's', name: 'H', module: 'central', kind: 'boolean', target_value: null, unit: null,
  scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: '2026-10-01', valid_to: null, ...o });
const log = (habit_id, log_date, status, value = null) => ({ id: habit_id + log_date, habit_id, log_date, status, value });

const defs = [
  def({ id: 'e', series_id: 'se', name: 'Entrenar', module: 'gym' }),
  def({ id: 'ps', series_id: 'sps', name: 'Pasos', module: 'gym', kind: 'quantity', target_value: 8000, unit: 'pasos' }),
  def({ id: 'pr', series_id: 'spr', name: 'Proteína', module: 'nutri', kind: 'quantity', target_value: 120, unit: 'g' }),
  def({ id: 'ag', series_id: 'sag', name: 'Agua', module: 'nutri', kind: 'quantity', target_value: 3, unit: 'L' })
];
const series = agruparPorSerie(defs);
const logs = [
  log('e', '2026-11-10', 'done'), log('e', '2026-11-11', 'done'), log('e', '2026-11-03', 'done'), log('e', '2026-11-05', 'missed'),
  log('ps', '2026-11-09', 'done', 9000), log('ps', '2026-11-10', 'missed', 7000), log('ps', '2026-11-02', 'missed', 5000)
];
const ses = (id, performed_on, routine_name = 'Fuerza') => ({ id, performed_on, routine_name });
const sesiones = [ses('s0', '2026-10-27'), ses('s1', '2026-11-03'), ses('s2', '2026-11-05'), ses('s3', '2026-11-10'), ses('s4', '2026-11-11', 'Piernas')];
const set = (session_id, exercise_id, set_no, reps, weight_kg) => ({ session_id, exercise_id, set_no, reps, weight_kg });
const tres = (sid, ex, reps, kg) => [1, 2, 3].map((n) => set(sid, ex, n, reps, kg));
const sets = [
  ...tres('s0', 'A', 10, 40), ...tres('s1', 'A', 10, 40), ...tres('s3', 'A', 10, 45),      // Press: 1200, 1200, 1350 → +12,5 %
  ...tres('s2', 'B', 10, 35), ...tres('s3', 'B', 10, 30),                                  // Remo: 1050 → 900 → −14,3 %
  ...tres('s4', 'C', 8, 60)                                                                // Sentadilla: primera vez → sin base
];
const ejercicios = [{ id: 'A', name: 'Press banca' }, { id: 'B', name: 'Remo' }, { id: 'C', name: 'Sentadilla' }];
const comida = (eaten_on, protein_g) => ({ eaten_on, protein_g, meal_type: 'almuerzo', description: 'x' });
const comidas = [comida('2026-11-09', 60), comida('2026-11-09', null), comida('2026-11-10', 100), comida('2026-11-03', 90)];
const toma = (drunk_on, ml) => ({ drunk_on, ml });
const tomas = [toma('2026-11-09', 2000), toma('2026-11-10', 3000), toma('2026-11-02', 1500)];
const medida = (measured_on, weight_kg, waist_cm = null) => ({ measured_on, weight_kg, waist_cm });
const medidas = [medida('2026-11-04', 79.0), medida('2026-11-05', 78.8), medida('2026-11-10', 78.6), medida('2026-11-12', 78.4, 90.5)];
const datos = { sesiones, sets, ejercicios, comidas, tomas, medidas };

const sem = calcularSemana({ series, logs, lunes: LUN, hoy: HOY });
const areas = calcularAreas({ series, logs, datos, periodo: sem.periodo, anterior: sem.periodoAnterior });

test('Gym: sesiones, series, volumen y comparación con el período anterior', () => {
  assert.deepEqual(areas.gym.actual, { sesiones: 2, dias: 2, series: 9, reps: 84, volumen: 3690 });   // 1350 + 900 + 1440
  assert.deepEqual(areas.gym.anterior, { sesiones: 2, dias: 2, series: 6, reps: 60, volumen: 2250 });  // 1200 + 1050
});

test('Gym: progresión por ejercicio contra la sesión anterior del mismo ejercicio; sin base no es 0', () => {
  const p = areas.gym.progresion;
  assert.deepEqual(p.mejoraron, [{ nombre: 'Press banca', delta: 12.5 }]);
  assert.deepEqual(p.bajaron, [{ nombre: 'Remo', delta: -14.3 }]);
  assert.equal(p.iguales, 0);
  assert.equal(p.sinBase, 1);                                  // Sentadilla: primera vez
});

test('Pasos: promedio solo sobre días con dato', () => {
  assert.equal(areas.pasos.actual.promedio, 8000);             // (9000 + 7000) / 2, no /4
  assert.equal(areas.pasos.actual.conDato, 2);
  assert.deepEqual(areas.pasos.actual.mejor, { fecha: '2026-11-09', valor: 9000 });
  assert.equal(areas.pasos.anterior.promedio, 5000);
});

test('Nutri: promedios solo sobre días con dato; avisa días con comidas sin proteína', () => {
  const p = areas.nutri.proteina;
  assert.equal(p.actual.promedio, 80);                         // (60 + 100) / 2; la comida sin proteína no suma ni cuenta como 0
  assert.equal(p.actual.diasConFaltantes, 1);
  assert.equal(p.anterior.promedio, 90);
  assert.equal(p.meta, 120);
  const a = areas.nutri.agua;
  assert.equal(a.actual.promedio, 2500);
  assert.equal(a.anterior.promedio, 1500);
  assert.equal(a.metaMl, 3000);
});

test('Cuerpo: peso último y cambio contra los 7 días previos', () => {
  assert.equal(areas.cuerpo.peso.ultimo.valor, 78.4);
  assert.equal(areas.cuerpo.peso.promedio7.valor, 78.5);       // 11-10 y 11-12
  assert.equal(areas.cuerpo.peso.deltaSemana, -0.4);           // 78,5 vs 78,9
  assert.equal(areas.cuerpo.cintura.ultimo.valor, 90.5);
});

test('Texto corto para el INFORME GENERAL', () => {
  assert.deepEqual(fragmentosCortos(areas, 'gym'), ['2 entrenos (ant. 2)', 'pasos 8.000/día', 'peso 78,4 kg (−0,4 kg vs semana previa)']);
  assert.deepEqual(fragmentosCortos(areas, 'nutri'), ['proteína 80 g/día', 'agua 2,5 L/día']);
  assert.deepEqual(fragmentosCortos(areas, 'vida'), []);
  assert.deepEqual(fragmentosCortos(null, 'gym'), []);
});

test('INFORME GENERAL: lleva los datos reales y NUNCA pasa de 15 líneas', () => {
  const todos = [...defs, ...['vida', 'estudio', 'derma', 'central'].map((m, i) => def({ id: 'z' + i, series_id: 'sz' + i, name: 'H' + m, module: m }))];
  const s2 = agruparPorSerie(todos);
  const sem2 = calcularSemana({ series: s2, logs, lunes: LUN, hoy: HOY });
  const ar = calcularAreas({ series: s2, logs, datos, periodo: sem2.periodo, anterior: sem2.periodoAnterior });
  const t = informeGeneralMd(sem2, { prioridades: ['uno', 'dos', 'tres'], revision: { decisions: 'x'.repeat(300) }, areas: ar });
  const lineas = t.split('\n');
  assert.ok(lineas.length <= MAX_LINEAS_GENERAL, `${lineas.length} líneas`);
  assert.match(t, /Gym: .*2 entrenos.*pasos 8\.000\/día.*peso 78,4 kg/);
  assert.match(t, /Nutri: .*proteína 80 g\/día · agua 2,5 L\/día/);
  assert.match(t, /Decisiones/);                              // lo último no se recorta
  // sin areas el informe es el de siempre
  assert.equal(informeGeneralMd(sem2, { prioridades: [] }).includes('entrenos'), false);
});

test('Un módulo sin hábitos pero con datos reales igual aparece', () => {
  const soloGymHabito = agruparPorSerie([defs[0]]);
  const s = calcularSemana({ series: soloGymHabito, logs, lunes: LUN, hoy: HOY });
  const ar = calcularAreas({ series: soloGymHabito, logs, datos, periodo: s.periodo, anterior: s.periodoAnterior });
  assert.equal(hayDatosArea(ar, 'nutri'), true);
  assert.match(informeGeneralMd(s, { areas: ar }), /Nutri: sin hábitos programados · proteína 80 g\/día/);
});

test('Nota para Gym y para Nutri con datos reales; las demás no cambian', () => {
  const r = (id) => armarInformes({ sem, series, logs, fecha: HOY, especialista: id, prioridades: [], areas, datosAreas: datos }).especialista;
  const gym = r('gym');
  assert.match(gym, /Regla fija/);
  assert.match(gym, /Entrenamientos: 2 sesiones en 2 días · 9 series · volumen 3\.690 kg; período anterior: 2 sesiones, 6 series, volumen 2\.250 kg/);
  assert.match(gym, /1 mejoraron, 1 bajaron, 0 igual, 1 sin base de comparación/);
  assert.match(gym, /Mejoraron: Press banca \+12,5 %/);
  assert.match(gym, /Bajaron: Remo −14,3 %/);
  assert.match(gym, /Pasos: promedio 8\.000\/día en 2 días con dato de 4/);
  assert.match(gym, /Peso: último 78,4 kg \(12\/11\) · promedio 7 días 78,5 kg \(−0,4 kg vs 7 días previos\)/);
  assert.match(gym, /Cintura: último 90,5 cm/);
  const nutri = r('nutri');
  assert.match(nutri, /Proteína: promedio 80 g\/día sobre 2 días con dato · meta 120 g · mejor día 100 g \(10\/11\) · período anterior: 90 g\/día · 1 día con comidas sin proteína cargada/);
  assert.match(nutri, /Agua: promedio 2,5 L\/día sobre 2 días con tomas · meta 3 L/);
  assert.match(nutri, /Peso: último 78,4 kg/);
  assert.match(nutri, /no fue registrado o no se pudo leer/);
  const vida = r('vida');
  assert.match(vida, /por ahora son solo hábitos/);
  assert.ok(!vida.includes('Entrenamientos'));
});

test('Indicadores por área: Gym lleva cuerpo, Nutri no lo repite', () => {
  const t = armarInformes({ sem, series, logs, fecha: HOY, especialista: 'central', areas, datosAreas: datos }).areas;
  assert.equal((t.match(/- Peso:/g) ?? []).length, 1);
  assert.match(t, /- Proteína: promedio 80/);
  assert.match(t, /- Entrenamientos: 2 sesiones/);
});

test('Comparación semanal con métricas reales', () => {
  const L = lineasComparacion(areas);
  assert.ok(L.includes('- Gym: 2 sesiones vs 2 sesiones · volumen 3.690 kg vs 2.250 kg'));
  assert.ok(L.includes('- Pasos (promedio/día): 8.000 vs 5.000'));
  assert.ok(L.includes('- Proteína (promedio/día): 80 g vs 90 g'));
  assert.ok(L.includes('- Agua (promedio/día): 2,5 L vs 1,5 L'));
  assert.ok(L.includes('- Peso (promedio 7 días): 78,5 kg vs 78,9 kg'));
});

test('Registro diario: solo lo cargado ese día', () => {
  const d = lineasDia({ fecha: '2026-11-09', datos });
  assert.deepEqual(d, ['- Nutri: 2 comidas · proteína 60 g · 1 comida quedó sin proteína cargada.', '- Agua: 2 L en 1 toma']);
  const d2 = lineasDia({ fecha: '2026-11-11', datos });
  assert.deepEqual(d2, ['- Gym: entrenó Piernas · 3 series · volumen 1.440 kg']);
  assert.deepEqual(lineasDia({ fecha: '2026-11-08', datos }), []);                   // sin dato ese día: no se dice nada
  assert.deepEqual(lineasDia({ fecha: '2026-11-12', datos }), ['- Cuerpo: peso 78,4 kg · cintura 90,5 cm']);
  const t = armarInformes({ sem, series, logs, fecha: '2026-11-09', especialista: 'central', areas, datosAreas: datos }).diario;
  assert.match(t, /\*\*Gym y Nutri \(cargado ese día\)\*\*/);
});

test('Datos que no se pudieron leer: se dice, no se inventa 0', () => {
  const ar = calcularAreas({ series, logs, datos: { sesiones: null, sets: null, ejercicios: null, comidas, tomas: null, medidas: null }, periodo: sem.periodo, anterior: sem.periodoAnterior });
  assert.equal(ar.gym, null);
  assert.equal(ar.cuerpo, null);
  assert.equal(ar.nutri.agua, null);
  assert.deepEqual(ar.faltantes, ['entrenamientos de Gym', 'agua de Nutri', 'peso y cintura']);
  const g = lineasArea(ar, 'gym').join('\n');
  assert.match(g, /No se pudieron leer: entrenamientos de Gym, peso y cintura/);
  assert.ok(!/Entrenamientos: /.test(g) && !/sesiones/.test(g));
  assert.match(lineasArea(ar, 'nutri').join('\n'), /No se pudieron leer: agua de Nutri/);
  assert.match(lineasArea(ar, 'nutri').join('\n'), /Proteína: promedio 80/);          // lo que sí se leyó, se usa
});

test('Sin datos cargados: dice que faltan, no 0', () => {
  const vacio = calcularAreas({ series, logs: [], datos: { sesiones: [], sets: [], ejercicios, comidas: [], tomas: [], medidas: [] }, periodo: sem.periodo, anterior: sem.periodoAnterior });
  const g = lineasArea(vacio, 'gym').join('\n');
  assert.match(g, /sin sesiones registradas en el período \(si no las cargaste, es dato faltante, no incumplimiento\)/);
  assert.match(g, /Peso: sin mediciones registradas/);
  assert.match(lineasArea(vacio, 'nutri').join('\n'), /Proteína: sin proteína cargada en el período/);
  assert.match(lineasArea(vacio, 'nutri').join('\n'), /Agua: sin tomas registradas en el período/);
  assert.equal(hayDatosArea(vacio, 'gym'), false);
  assert.equal(hayDatosArea(vacio, 'nutri'), false);
  assert.deepEqual(fragmentosCortos(vacio, 'gym'), []);
  assert.deepEqual(lineasComparacion(vacio), []);
});

test('Los 6 especialistas siguen armándose con y sin datos reales', () => {
  for (const e of ESPECIALISTAS) {
    for (const a of [null, areas]) {
      const t = armarInformes({ sem, series, logs, fecha: HOY, especialista: e.id, areas: a, datosAreas: a ? datos : null }).especialista;
      assert.match(t, new RegExp(`Nota para ${e.nombre}`));
    }
  }
});

// ---------- Panel (hito 3-5b) ----------
import { indicadoresPanel, textoPanel } from '../js/core/areas.js';

const hoyP = '2026-11-12';
const panel = (extra = {}) => indicadoresPanel({ defs: defs, logs, fecha: hoyP, lunes: LUN, sesiones, comidas: comidas.concat([comida(hoyP, 70)]), tomas: tomas.concat([toma(hoyP, 1200)]), ...extra });

test('Panel: entrenos de la semana en curso (no los de semanas anteriores) y hábito aparte', () => {
  const p = panel();
  assert.equal(p.entrenos.n, 2);                                   // 10 y 11 de noviembre; los de la semana anterior no cuentan
  assert.deepEqual(p.entrenos.habito, { programados: 4, cumplidos: 2 });
  const t = textoPanel(p);
  assert.deepEqual(t.metricas[0], { valor: '2', etiqueta: 'Entrenos registrados esta semana', clase: 'ok' });
  assert.ok(t.notas.includes('Hábito Entrenar: 2 de 4 días programados cumplidos.'));
});

test('Panel: proteína y agua de HOY contra la meta; sin completar no es incumplido', () => {
  const p = panel();
  assert.equal(p.proteina.total, 70);                              // solo la comida de hoy
  assert.equal(p.proteina.falta, 50);
  assert.equal(p.proteina.estado, 'sin_completar');
  assert.equal(p.agua.ml, 1200);
  assert.equal(p.agua.falta, 1800);
  assert.equal(p.agua.estado, 'sin_completar');
  const t = textoPanel(p);
  assert.deepEqual(t.metricas[1], { valor: '70 g', etiqueta: 'Proteína de hoy · meta 120 g', clase: '' });
  assert.deepEqual(t.metricas[2], { valor: '1,2 L', etiqueta: 'Agua de hoy · meta 3 L', clase: '' });
  assert.ok(t.notas.includes('Proteína: sin completar · faltan 50 g.'));
  assert.ok(t.notas.includes('Agua: sin completar · faltan 1,8 L.'));
});

test('Panel: cumplido (automático) e incumplido (cierre manual) se muestran según el registro', () => {
  const lg = [...logs, log('pr', hoyP, 'done', 130), log('ag', hoyP, 'missed', 2.5)];
  lg.find((l) => l.habit_id === 'pr' && l.log_date === hoyP).note = 'auto-proteina';
  lg.find((l) => l.habit_id === 'ag' && l.log_date === hoyP).note = 'cierre-dia';
  const t = textoPanel(panel({ logs: lg }));
  assert.ok(t.notas.includes('Proteína: meta cumplida.'));
  assert.ok(t.notas.includes('Agua: día cerrado como incumplido.'));
  assert.equal(t.metricas[1].clase, 'ok');
});

test('Panel: hoy sin nada cargado dice «—», no 0; avisa comidas sin proteína', () => {
  const t = textoPanel(panel({ comidas: [], tomas: [] }));
  assert.equal(t.metricas[1].valor, '—');
  assert.equal(t.metricas[2].valor, '—');
  assert.ok(t.notas.includes('Proteína: todavía no cargaste comidas hoy.'));
  assert.ok(t.notas.includes('Agua: todavía no cargaste tomas hoy.'));
  const t2 = textoPanel(panel({ comidas: [comida(hoyP, 40), comida(hoyP, null)] }));
  assert.equal(t2.metricas[1].valor, '40 g');
  assert.ok(t2.notas.some((n) => /1 comida quedó sin proteína cargada \(el total solo suma lo cargado\)\./.test(n)));
});

test('Panel: lo que no se pudo leer se avisa y no se inventa; el resto sigue', () => {
  const t = textoPanel(panel({ sesiones: null, tomas: null }));
  assert.equal(t.metricas[0].valor, '—');
  assert.equal(t.metricas[2].valor, '—');
  assert.equal(t.metricas[1].valor, '70 g');
  assert.ok(t.notas.includes('No se pudo leer: entrenamientos, agua. Probá recargar.'));
});

test('Panel: sin hábitos de meta muestra el total igual; sin sesiones registra 0 entrenos', () => {
  const p = indicadoresPanel({ defs: [], logs: [], fecha: hoyP, lunes: LUN, sesiones: [], comidas: [comida(hoyP, 55)], tomas: [toma(hoyP, 500)] });
  const t = textoPanel(p);
  assert.equal(t.metricas[0].valor, '0');
  assert.equal(t.metricas[1].etiqueta, 'Proteína de hoy');
  assert.equal(t.metricas[1].valor, '55 g');
  assert.equal(t.metricas[2].valor, '500 ml');
  assert.equal(p.proteina.estado, null);
  assert.equal(p.proteina.falta, null);
});
