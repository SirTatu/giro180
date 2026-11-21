// Lógica pura del REGISTRO de entrenamientos (hito 3-2): números, validación de series, armado de bloques,
// totales (series, repeticiones, volumen), última vez, resumen semanal, progresión y hábito «Entrenar».
// Sin pantalla ni base de datos. Pruebas en tests/entrenos.test.mjs.
import { agruparPorSerie, versionVigente } from './estados.js';
import { diaISO, lunesDe } from './fechas.js';
import { normalizar } from './gym.js';

const redondear = (n) => Math.round(n * 100) / 100;

// "82,5" o "82.5" -> 82.5 · "" -> null · cualquier otra cosa -> NaN (no se aceptan negativos ni notación científica).
export function parsearNumero(texto) {
  const s = String(texto ?? '').trim().replace(',', '.');
  if (s === '') return null;
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

// 82.5 -> "82,5" · 80 -> "80" (coma decimal, como en el resto de la app).
export const formatoNumero = (n) => String(redondear(Number(n))).replace('.', ',');

export function formatoSerie(s) {
  return s.weight_kg == null ? `${s.reps} reps` : `${formatoNumero(s.weight_kg)} kg × ${s.reps}`;
}

// Objetivo guardado en la foto de una serie, o el de la rutina: { series, min, max } (cualquiera puede ser null).
export function textoObjetivo(o) {
  if (!o) return '';
  const { series, min, max } = o;
  const reps = min != null && max != null ? (min === max ? `${min}` : `${min}-${max}`) : min != null ? `${min}+` : max != null ? `hasta ${max}` : '';
  if (series != null && reps) return `${series} × ${reps}`;
  if (series != null) return `${series} series`;
  return reps ? `${reps} reps` : '';
}

// ---------- totales ----------
// sets: [{reps, weight_kg}]. El volumen suma solo las series CON peso; las series sin peso (peso corporal)
// cuentan en series y repeticiones pero no en el volumen, y se informan aparte en `sinPeso`.
export function totales(sets) {
  let reps = 0, volumen = 0, sinPeso = 0;
  for (const s of sets) {
    reps += Number(s.reps);
    if (s.weight_kg == null) sinPeso++;
    else volumen += Number(s.weight_kg) * Number(s.reps);
  }
  return { series: sets.length, reps, volumen: redondear(volumen), sinPeso };
}

// Mejor serie: mayor peso (a igual peso, más repeticiones). Series sin peso no compiten; null si no hay con peso.
export function mejorSerie(sets) {
  let mejor = null;
  for (const s of sets) {
    if (s.weight_kg == null) continue;
    const w = Number(s.weight_kg), r = Number(s.reps);
    if (!mejor || w > mejor.weight_kg || (w === mejor.weight_kg && r > mejor.reps)) mejor = { weight_kg: w, reps: r };
  }
  return mejor;
}

// Agrupa las series por ejercicio, ordenadas por número de serie. -> Map(exercise_id -> sets)
export function agruparPorEjercicio(sets) {
  const m = new Map();
  for (const s of sets) { if (!m.has(s.exercise_id)) m.set(s.exercise_id, []); m.get(s.exercise_id).push(s); }
  for (const v of m.values()) v.sort((a, b) => a.set_no - b.set_no);
  return m;
}

// ---------- series escritas en pantalla ----------
// filas: [{peso: 'texto', reps: 'texto'}]. Una fila totalmente vacía se ignora (no es un dato).
// Devuelve { sets: [{reps, weight_kg}], errores: [texto] }.
export function validarFilas(filas, nombre = 'Ejercicio') {
  const sets = [], errores = [];
  filas.forEach((f, i) => {
    const p = parsearNumero(f.peso), r = parsearNumero(f.reps);
    if (p === null && r === null) return;
    const et = `${nombre}, serie ${i + 1}`;
    let bien = true;
    if (Number.isNaN(p) || (p !== null && (p > 9999.99 || redondear(p) !== p))) { errores.push(`${et}: peso inválido (hasta 9999,99 kg y 2 decimales).`); bien = false; }
    if (r === null) { errores.push(`${et}: falta cargar las repeticiones.`); bien = false; }
    else if (Number.isNaN(r) || !Number.isInteger(r) || r > 500) { errores.push(`${et}: las repeticiones deben ser un entero entre 0 y 500.`); bien = false; }
    if (bien) sets.push({ reps: r, weight_kg: p });
  });
  return { sets, errores };
}

// bloques: [{exerciseId, nombre, objetivo, saltado, filas}]. Devuelve { sets (para la base), errores, totales }.
// Los bloques saltados no se guardan. Un mismo ejercicio no puede estar dos veces con series (chocaría con la base).
export function armarEntrenamiento(bloques) {
  const sets = [], errores = [], vistos = new Set(), todas = [];
  for (const b of bloques) {
    if (b.saltado) continue;
    const v = validarFilas(b.filas, b.nombre);
    errores.push(...v.errores);
    if (!v.sets.length) continue;
    if (vistos.has(b.exerciseId)) { errores.push(`${b.nombre} está dos veces con series: dejá una sola.`); continue; }
    vistos.add(b.exerciseId);
    const o = b.objetivo;
    v.sets.forEach((s, i) => {
      sets.push({
        exercise_id: b.exerciseId, set_no: i + 1, reps: s.reps, weight_kg: s.weight_kg,
        target_sets: o?.series ?? null, target_reps_min: o?.min ?? null, target_reps_max: o?.max ?? null
      });
      todas.push(s);
    });
  }
  if (!sets.length && !errores.length) errores.push('Cargá al menos una serie con sus repeticiones.');
  return { sets, errores, totales: totales(todas) };
}

// ---------- armado de los bloques de la pantalla ----------
const fotoObjetivo = (s) => (s.target_sets != null || s.target_reps_min != null || s.target_reps_max != null
  ? { series: s.target_sets, min: s.target_reps_min, max: s.target_reps_max } : null);
const filaDe = (s) => ({ peso: s.weight_kg == null ? '' : formatoNumero(s.weight_kg), reps: String(s.reps) });

// items: ejercicios de la rutina elegida; setsSesion: series ya guardadas de la sesión que se edita (o []);
// ultimas: Map(exercise_id -> {fecha, sets}). IMPORTANTE: al editar una sesión, el objetivo sale de la FOTO
// guardada en sus series (no de la rutina actual), para no reescribir el historial al volver a guardar.
export function bloquesIniciales({ items = [], ejercicios, setsSesion = [], ultimas = new Map() }) {
  const nombres = new Map(ejercicios.map((e) => [e.id, e.name]));
  const guardadas = agruparPorEjercicio(setsSesion);
  const usados = new Set();
  const bloques = [];
  const crear = (exerciseId, objetivo, origen, sets) => {
    const filas = sets?.length ? sets.map(filaDe) : Array.from({ length: Math.min(20, objetivo?.series ?? 3) }, () => ({ peso: '', reps: '' }));
    return { exerciseId, nombre: nombres.get(exerciseId) ?? '(ejercicio desconocido)', objetivo, origen, saltado: false,
      filas, original: exerciseId, ultima: ultimas.get(exerciseId) ?? null };
  };
  for (const it of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const propias = usados.has(it.exercise_id) ? null : guardadas.get(it.exercise_id);
    usados.add(it.exercise_id);
    const delRutina = { series: it.target_sets, min: it.reps_min, max: it.reps_max };
    bloques.push(crear(it.exercise_id, (propias && fotoObjetivo(propias[0])) || delRutina, 'rutina', propias));
  }
  for (const [id, sets] of guardadas) {
    if (!usados.has(id)) bloques.push(crear(id, fotoObjetivo(sets[0]), 'extra', sets));
  }
  return bloques;
}

// Última vez de cada ejercicio: la sesión más reciente (de las dadas) en la que aparece.
// sesiones: [{id, performed_on}] anteriores al día que se registra; sets: series de esas sesiones.
export function ultimasPorEjercicio(sesiones, sets) {
  const fecha = new Map(sesiones.map((s) => [s.id, s.performed_on]));
  const mejor = new Map();                               // exercise_id -> {fecha, sesion}
  for (const s of sets) {
    const f = fecha.get(s.session_id);
    if (!f) continue;
    const a = mejor.get(s.exercise_id);
    if (!a || f > a.fecha) mejor.set(s.exercise_id, { fecha: f, sesion: s.session_id });
  }
  const res = new Map();
  for (const [id, { fecha: f, sesion }] of mejor) {
    res.set(id, { fecha: f, sets: sets.filter((s) => s.exercise_id === id && s.session_id === sesion).sort((a, b) => a.set_no - b.set_no) });
  }
  return res;
}

// ---------- historial ----------
// Totales de cada sesión. -> Map(session_id -> {series, reps, volumen, sinPeso})
export function totalesPorSesion(sesiones, sets) {
  const por = new Map(sesiones.map((s) => [s.id, []]));
  for (const s of sets) por.get(s.session_id)?.push(s);
  return new Map([...por].map(([id, v]) => [id, totales(v)]));
}

// Resumen por semana (lunes a domingo), la más reciente primero.
export function totalesPorSemana(sesiones, sets) {
  const tot = totalesPorSesion(sesiones, sets);
  const semanas = new Map();
  for (const s of sesiones) {
    const lunes = lunesDe(s.performed_on);
    const w = semanas.get(lunes) ?? { semana: lunes, sesiones: 0, series: 0, reps: 0, volumen: 0, sinPeso: 0 };
    const t = tot.get(s.id);
    w.sesiones += 1; w.series += t.series; w.reps += t.reps; w.volumen = redondear(w.volumen + t.volumen); w.sinPeso += t.sinPeso;
    semanas.set(lunes, w);
  }
  return [...semanas.values()].sort((a, b) => (a.semana < b.semana ? 1 : -1));
}

// Progresión de un ejercicio: una fila por sesión (de la más antigua a la más nueva), con el cambio de volumen
// respecto de la sesión anterior de ESE ejercicio. Sin sesión previa (o con volumen 0) no hay base: deltaVolumen = null.
export function progresionEjercicio(sesiones, sets, exerciseId) {
  const fecha = new Map(sesiones.map((s) => [s.id, s]));
  const porSesion = new Map();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId || !fecha.has(s.session_id)) continue;
    if (!porSesion.has(s.session_id)) porSesion.set(s.session_id, []);
    porSesion.get(s.session_id).push(s);
  }
  const filas = [...porSesion].map(([id, v]) => ({
    sesionId: id, fecha: fecha.get(id).performed_on, sets: v.sort((a, b) => a.set_no - b.set_no),
    ...totales(v), mejor: mejorSerie(v)
  })).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return filas.map((f, i) => {
    const prev = filas[i - 1];
    return { ...f, deltaVolumen: prev && prev.volumen > 0 && f.volumen > 0 ? Math.round(((f.volumen - prev.volumen) / prev.volumen) * 1000) / 10 : null };
  });
}

// ---------- hábitos de Gym (Entrenar, Pasos) ----------
// Identifica un hábito de Gym SIN tocarlo: del módulo Gym y del tipo pedido; si hay varios se prefiere el de nombre
// esperado y luego el bloqueado. Devuelve { version, motivo, programado } con la VERSIÓN vigente ese día.
// motivo: null si se encontró · 'sin_habito' · 'ambiguo' · 'sin_version_vigente'.
export const buscarHabitoDeGym = (defs, fecha, kind, patronNombre) => buscarHabitoDeModulo(defs, fecha, 'gym', kind, patronNombre);

// Igual, para cualquier módulo (Nutri usa módulo 'nutri': proteína y agua).
// estricto: si ninguno tiene el nombre esperado, NO adivina (Nutri: proteína y agua son los dos de cantidad).
export function buscarHabitoDeModulo(defs, fecha, modulo, kind, patronNombre, estricto = false) {
  let series = [...agruparPorSerie(defs).values()].filter((v) => {
    const u = v[v.length - 1];
    return u.module === modulo && u.kind === kind;
  });
  const porNombre = series.filter((v) => patronNombre.test(normalizar(v[v.length - 1].name)));
  if (porNombre.length) series = porNombre;
  else if (estricto) series = [];
  if (series.length > 1) {
    const bloq = series.filter((v) => v.some((x) => x.locked));
    if (bloq.length) series = bloq;
  }
  if (!series.length) return { version: null, motivo: 'sin_habito', programado: false, versiones: [] };
  if (series.length > 1) return { version: null, motivo: 'ambiguo', programado: false, versiones: [] };
  const version = versionVigente(series[0], fecha);
  if (!version) return { version: null, motivo: 'sin_version_vigente', programado: false, versiones: series[0] };
  return { version, motivo: null, programado: version.scheduled_days.includes(diaISO(fecha)), versiones: series[0] };
}

// «Entrenar»: hábito de Gym de tipo sí/no (nombre entrenar / gimnasio).
export const buscarHabitoEntrenar = (defs, fecha) => buscarHabitoDeGym(defs, fecha, 'boolean', /entren|gimnas/);
