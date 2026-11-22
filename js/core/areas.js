// Datos REALES de Gym y Nutri para los informes (hito 3-5a). Lógica pura: sin pantalla ni base de datos.
// Pruebas en tests/areas.test.mjs. Reglas: un dato que no se cargó o no se pudo leer NUNCA se muestra como 0 ni como
// incumplimiento; promedios solo sobre días con dato; todo lo que no se puede calcular es null y el texto lo dice.
import { totales, progresionEjercicio, formatoNumero } from './entrenos.js';
import { buscarHabitoPasos, resumenPasos, tendenciaMedidas, formatoDelta } from './cuerpo.js';
import { buscarHabitoProteina, totalesPorDia as comidasPorDia, aviso } from './nutri.js';
import { buscarHabitoAgua, totalesPorDia as tomasPorDia, metaEnMl, formatoMl } from './agua.js';

const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ddmm = (f) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}`; };
const r1 = (n) => Math.round(n * 10) / 10;
const enRango = (f, p) => f >= p.desde && f <= p.hasta;
const recortar = (t, n) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const conSigno = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatoNumero(Math.abs(n))}`;

// ---------- cálculo ----------
function agregadoGym(sesiones, sets, p) {
  const ses = sesiones.filter((s) => enRango(s.performed_on, p));
  const ids = new Set(ses.map((s) => s.id));
  const t = totales(sets.filter((x) => ids.has(x.session_id)));
  return { sesiones: ses.length, dias: new Set(ses.map((s) => s.performed_on)).size, series: t.series, reps: t.reps, volumen: t.volumen };
}

// Progresión: por cada ejercicio trabajado en el período, cambio de volumen de su ÚLTIMA sesión del período contra la sesión
// anterior de ESE ejercicio (puede ser de antes del período). Sin sesión previa o sin peso: «sin base», nunca 0.
function progresionGym(sesiones, sets, ejercicios, p) {
  const nombre = new Map((ejercicios ?? []).map((e) => [e.id, e.name]));
  const idsPeriodo = new Set(sesiones.filter((s) => enRango(s.performed_on, p)).map((s) => s.id));
  const ejer = [...new Set(sets.filter((x) => idsPeriodo.has(x.session_id)).map((x) => x.exercise_id))];
  const out = { mejoraron: [], bajaron: [], iguales: 0, sinBase: 0 };
  for (const id of ejer) {
    const fila = progresionEjercicio(sesiones, sets, id).filter((f) => enRango(f.fecha, p)).pop();
    const n = nombre.get(id) ?? 'Ejercicio';
    if (!fila || fila.deltaVolumen == null) out.sinBase++;
    else if (fila.deltaVolumen > 0) out.mejoraron.push({ nombre: n, delta: fila.deltaVolumen });
    else if (fila.deltaVolumen < 0) out.bajaron.push({ nombre: n, delta: fila.deltaVolumen });
    else out.iguales++;
  }
  out.mejoraron.sort((a, b) => b.delta - a.delta);
  out.bajaron.sort((a, b) => a.delta - b.delta);
  return out;
}

function pasosArea(defs, logs, periodo, anterior) {
  const hab = buscarHabitoPasos(defs, periodo.hasta);
  if (!hab.versiones.length) return null;
  const a = resumenPasos(hab.versiones, logs, periodo.desde, periodo.hasta);
  const b = resumenPasos(hab.versiones, logs, anterior.desde, anterior.hasta);
  const dias = Math.round((new Date(periodo.hasta) - new Date(periodo.desde)) / 86400000) + 1;
  return { actual: { promedio: a.promedio, conDato: a.conDato, mejor: a.mejor, dias }, anterior: { promedio: b.promedio, conDato: b.conDato } };
}

function cuerpoArea(medidas, hasta) {
  if (!medidas) return null;
  const peso = tendenciaMedidas(medidas, 'weight_kg', hasta, 30);
  const cintura = tendenciaMedidas(medidas, 'waist_cm', hasta, 30);
  return peso.ultimo || cintura.ultimo ? { peso, cintura } : { peso: null, cintura: null };
}

function promedioPorDia(porDia, p, valorDe) {
  let n = 0, suma = 0, mejor = null, faltantes = 0, conComidas = 0;
  for (const [f, t] of porDia) {
    if (!enRango(f, p)) continue;
    conComidas++;
    if (t.sinProteina > 0) faltantes++;
    const v = valorDe(t);
    if (v == null) continue;
    n++; suma += v;
    if (!mejor || v > mejor.valor) mejor = { fecha: f, valor: v };
  }
  return { conDato: n, promedio: n ? suma / n : null, mejor, diasConFaltantes: faltantes, diasConRegistro: conComidas };
}

function nutriArea(defs, comidas, tomas, periodo, anterior) {
  if (!comidas && !tomas) return null;
  const out = { proteina: null, agua: null };
  if (comidas) {
    const por = comidasPorDia(comidas);
    const p = promedioPorDia(por, periodo, (t) => t.total), a = promedioPorDia(por, anterior, (t) => t.total);
    const v = buscarHabitoProteina(defs, periodo.hasta).version;
    out.proteina = { actual: { ...p, promedio: p.promedio == null ? null : r1(p.promedio) }, anterior: { promedio: a.promedio == null ? null : r1(a.promedio), conDato: a.conDato }, meta: v ? Number(v.target_value) : null };
  }
  if (tomas) {
    const por = tomasPorDia(tomas);
    const p = promedioPorDia(por, periodo, (t) => t.ml), a = promedioPorDia(por, anterior, (t) => t.ml);
    const v = buscarHabitoAgua(defs, periodo.hasta).version;
    out.agua = { actual: { ...p, promedio: p.promedio == null ? null : Math.round(p.promedio) }, anterior: { promedio: a.promedio == null ? null : Math.round(a.promedio), conDato: a.conDato }, metaMl: v ? metaEnMl(v) : null };
  }
  return out;
}

// datos: { sesiones, sets, ejercicios, comidas, tomas, medidas } — cada uno puede ser null si no se pudo leer.
export function calcularAreas({ series, logs, datos = {}, periodo, anterior }) {
  const defs = [...series.values()].flat();
  const { sesiones = null, sets = null, ejercicios = null, comidas = null, tomas = null, medidas = null } = datos;
  const gymOk = sesiones != null && sets != null;
  return {
    gym: gymOk ? { actual: agregadoGym(sesiones, sets, periodo), anterior: agregadoGym(sesiones, sets, anterior), progresion: progresionGym(sesiones, sets, ejercicios, periodo) } : null,
    pasos: pasosArea(defs, logs, periodo, anterior),
    cuerpo: cuerpoArea(medidas, periodo.hasta),
    nutri: nutriArea(defs, comidas, tomas, periodo, anterior),
    periodo,
    faltantes: [
      ...(!gymOk ? ['entrenamientos de Gym'] : []), ...(comidas == null ? ['comidas de Nutri'] : []),
      ...(tomas == null ? ['agua de Nutri'] : []), ...(medidas == null ? ['peso y cintura'] : [])
    ]
  };
}

// ---------- textos ----------
const textoPeso = (c) => {
  if (!c?.peso?.ultimo) return null;
  const d = c.peso.deltaSemana != null ? ` (${formatoDelta(c.peso.deltaSemana, 'kg')} vs semana previa)` : '';
  return `peso ${formatoNumero(c.peso.ultimo.valor)} kg${d}`;
};

// ¿Hay algo real para mostrar de este módulo?
export function hayDatosArea(areas, modulo) {
  if (!areas) return false;
  if (modulo === 'gym') return !!(areas.gym && (areas.gym.actual.sesiones || areas.gym.anterior.sesiones)) || !!areas.pasos?.actual.conDato || !!areas.cuerpo?.peso;
  if (modulo === 'nutri') return !!(areas.nutri?.proteina?.actual.conDato || areas.nutri?.agua?.actual.conDato);
  return false;
}

// Fragmentos cortos para la línea del módulo en el INFORME GENERAL (no agregan líneas, solo texto a la misma).
export function fragmentosCortos(areas, modulo) {
  if (!areas) return [];
  const f = [];
  if (modulo === 'gym') {
    const g = areas.gym;
    if (g && (g.actual.sesiones || g.anterior.sesiones)) {
      f.push(g.actual.sesiones ? `${pl(g.actual.sesiones, 'entreno', 'entrenos')} (ant. ${g.anterior.sesiones || 'sin registro'})` : 'sin entrenos registrados');
    }
    if (areas.pasos?.actual.promedio != null) f.push(`pasos ${miles(areas.pasos.actual.promedio)}/día`);
    const p = textoPeso(areas.cuerpo);
    if (p) f.push(p);
  }
  if (modulo === 'nutri') {
    const n = areas.nutri;
    if (n?.proteina?.actual.promedio != null) f.push(`proteína ${formatoNumero(n.proteina.actual.promedio)} g/día`);
    if (n?.agua?.actual.promedio != null) f.push(`agua ${formatoMl(n.agua.actual.promedio)}/día`);
  }
  return f;
}

function lineasCuerpo(areas) {
  const c = areas.cuerpo;
  if (c == null) return [];
  const una = (t, nombre, u) => {
    if (!t?.ultimo) return `- ${nombre}: sin mediciones registradas`;
    const hace = t.diasDesdeUltimo > 0 ? `, hace ${pl(t.diasDesdeUltimo, 'día', 'días')}` : '';
    const p7 = t.promedio7 ? ` · promedio 7 días ${formatoNumero(t.promedio7.valor)} ${u}${t.deltaSemana != null ? ` (${formatoDelta(t.deltaSemana, u)} vs 7 días previos)` : ''}` : '';
    const c30 = t.cambioPeriodo != null ? ` · ${formatoDelta(t.cambioPeriodo, u)} en 30 días (${pl(t.n, 'medición', 'mediciones')})` : '';
    return `- ${nombre}: último ${formatoNumero(t.ultimo.valor)} ${u} (${ddmm(t.ultimo.fecha)}${hace})${p7}${c30}`;
  };
  const L = [una(c.peso, 'Peso', 'kg')];
  if (c.cintura?.ultimo) L.push(una(c.cintura, 'Cintura', 'cm'));
  return L;
}

function lineasGym(areas) {
  const L = [];
  const g = areas.gym;
  if (g) {
    const a = g.actual, b = g.anterior;
    if (!a.sesiones) L.push('- Entrenamientos: sin sesiones registradas en el período (si no las cargaste, es dato faltante, no incumplimiento).');
    else {
      const ant = b.sesiones ? `; período anterior: ${pl(b.sesiones, 'sesión', 'sesiones')}, ${pl(b.series, 'serie', 'series')}, volumen ${miles(b.volumen)} kg` : '; período anterior: sin sesiones registradas';
      L.push(`- Entrenamientos: ${pl(a.sesiones, 'sesión', 'sesiones')} en ${pl(a.dias, 'día', 'días')} · ${pl(a.series, 'serie', 'series')} · volumen ${miles(a.volumen)} kg${ant}`);
      const p = g.progresion;
      L.push(`- Progresión (volumen vs la sesión anterior del mismo ejercicio): ${p.mejoraron.length} mejoraron, ${p.bajaron.length} bajaron, ${p.iguales} igual, ${p.sinBase} sin base de comparación`);
      const nom = (l) => l.slice(0, 3).map((x) => `${recortar(x.nombre, 40)} ${conSigno(x.delta)} %`).join(', ');
      if (p.mejoraron.length) L.push(`  - Mejoraron: ${nom(p.mejoraron)}`);
      if (p.bajaron.length) L.push(`  - Bajaron: ${nom(p.bajaron)}`);
    }
  }
  const ps = areas.pasos;
  if (ps) {
    const a = ps.actual;
    if (a.promedio == null) L.push('- Pasos: sin datos cargados en el período');
    else L.push(`- Pasos: promedio ${miles(a.promedio)}/día en ${pl(a.conDato, 'día', 'días')} con dato de ${a.dias} · mejor día ${miles(a.mejor.valor)} (${ddmm(a.mejor.fecha)})${ps.anterior.promedio != null ? ` · período anterior: ${miles(ps.anterior.promedio)}/día` : ''}`);
  }
  return L;
}

function lineasNutri(areas) {
  const n = areas.nutri;
  const L = [];
  if (!n) return L;
  if (n.proteina) {
    const a = n.proteina.actual, b = n.proteina.anterior;
    if (a.promedio == null) L.push(`- Proteína: sin proteína cargada en el período${a.diasConRegistro ? ` (${pl(a.diasConRegistro, 'día', 'días')} con comidas pero sin dato de proteína)` : ''}`);
    else {
      const meta = n.proteina.meta != null ? ` · meta ${formatoNumero(n.proteina.meta)} g` : '';
      const falt = a.diasConFaltantes ? ` · ${pl(a.diasConFaltantes, 'día', 'días')} con comidas sin proteína cargada (el promedio solo suma lo cargado)` : '';
      L.push(`- Proteína: promedio ${formatoNumero(a.promedio)} g/día sobre ${pl(a.conDato, 'día', 'días')} con dato${meta} · mejor día ${formatoNumero(a.mejor.valor)} g (${ddmm(a.mejor.fecha)})${b.promedio != null ? ` · período anterior: ${formatoNumero(b.promedio)} g/día` : ''}${falt}`);
    }
  }
  if (n.agua) {
    const a = n.agua.actual, b = n.agua.anterior;
    if (a.promedio == null) L.push('- Agua: sin tomas registradas en el período');
    else {
      const meta = n.agua.metaMl != null ? ` · meta ${formatoMl(n.agua.metaMl)}` : '';
      L.push(`- Agua: promedio ${formatoMl(a.promedio)}/día sobre ${pl(a.conDato, 'día', 'días')} con tomas${meta} · mejor día ${formatoMl(a.mejor.valor)} (${ddmm(a.mejor.fecha)})${b.promedio != null ? ` · período anterior: ${formatoMl(b.promedio)}/día` : ''}`);
    }
  }
  return L;
}

const faltantesTexto = (areas, claves) => {
  const f = areas.faltantes.filter((x) => claves.some((c) => x.includes(c)));
  return f.length ? [`- _No se pudieron leer: ${f.join(', ')}. No significa que no existan._`] : [];
};

// Para «Indicadores por área» y las notas: líneas con «- ». incluirCuerpo=false evita repetir peso en el bloque de Nutri.
export function lineasArea(areas, modulo, { incluirCuerpo = true } = {}) {
  if (!areas) return [];
  if (modulo === 'gym') return [...lineasGym(areas), ...(incluirCuerpo ? lineasCuerpo(areas) : []), ...faltantesTexto(areas, ['Gym', 'peso'])];
  if (modulo === 'nutri') return [...lineasNutri(areas), ...(incluirCuerpo ? lineasCuerpo(areas) : []), ...faltantesTexto(areas, ['Nutri', ...(incluirCuerpo ? ['peso'] : [])])];
  return [];
}

// Para la comparación semanal: una línea por métrica, solo si hay dato en alguno de los dos períodos.
export function lineasComparacion(areas) {
  if (!areas) return [];
  const L = [];
  const g = areas.gym;
  if (g && (g.actual.sesiones || g.anterior.sesiones)) {
    L.push(`- Gym: ${pl(g.actual.sesiones, 'sesión', 'sesiones')} vs ${g.anterior.sesiones ? pl(g.anterior.sesiones, 'sesión', 'sesiones') : 'sin sesiones registradas'} · volumen ${miles(g.actual.volumen)} kg vs ${g.anterior.sesiones ? miles(g.anterior.volumen) + ' kg' : 'sin base'}`);
  }
  const ps = areas.pasos;
  if (ps && (ps.actual.promedio != null || ps.anterior.promedio != null)) {
    L.push(`- Pasos (promedio/día): ${ps.actual.promedio != null ? miles(ps.actual.promedio) : 'sin datos'} vs ${ps.anterior.promedio != null ? miles(ps.anterior.promedio) : 'sin datos'}`);
  }
  const p = areas.nutri?.proteina;
  if (p && (p.actual.promedio != null || p.anterior.promedio != null)) {
    L.push(`- Proteína (promedio/día): ${p.actual.promedio != null ? formatoNumero(p.actual.promedio) + ' g' : 'sin datos'} vs ${p.anterior.promedio != null ? formatoNumero(p.anterior.promedio) + ' g' : 'sin datos'}`);
  }
  const a = areas.nutri?.agua;
  if (a && (a.actual.promedio != null || a.anterior.promedio != null)) {
    L.push(`- Agua (promedio/día): ${a.actual.promedio != null ? formatoMl(a.actual.promedio) : 'sin datos'} vs ${a.anterior.promedio != null ? formatoMl(a.anterior.promedio) : 'sin datos'}`);
  }
  const t = areas.cuerpo?.peso;
  if (t?.promedio7) L.push(`- Peso (promedio 7 días): ${formatoNumero(t.promedio7.valor)} kg${t.promedio7Previo ? ` vs ${formatoNumero(t.promedio7Previo.valor)} kg` : ' (sin base de comparación)'}`);
  return L;
}

// Para el registro diario: lo cargado ESE día en Gym y Nutri. Sin dato ese día, no se dice nada.
export function lineasDia({ fecha, datos = {} }) {
  const L = [];
  const { sesiones, sets, comidas, tomas, medidas } = datos;
  for (const s of (sesiones ?? []).filter((x) => x.performed_on === fecha)) {
    const t = totales((sets ?? []).filter((x) => x.session_id === s.id));
    L.push(`- Gym: entrenó${s.routine_name ? ' ' + recortar(s.routine_name, 40) : ''} · ${pl(t.series, 'serie', 'series')} · volumen ${miles(t.volumen)} kg`);
  }
  const cs = (comidas ?? []).filter((x) => x.eaten_on === fecha);
  if (cs.length) {
    const con = cs.filter((c) => c.protein_g != null);
    const total = con.reduce((a, c) => a + Number(c.protein_g), 0);
    const av = aviso({ sinProteina: cs.length - con.length });
    L.push(`- Nutri: ${pl(cs.length, 'comida', 'comidas')} · proteína ${con.length ? formatoNumero(r1(total)) + ' g' : 'sin cargar'}${av ? ' · ' + av : ''}`);
  }
  const ts = (tomas ?? []).filter((x) => x.drunk_on === fecha);
  if (ts.length) L.push(`- Agua: ${formatoMl(ts.reduce((a, t) => a + Number(t.ml), 0))} en ${pl(ts.length, 'toma', 'tomas')}`);
  const m = (medidas ?? []).find((x) => x.measured_on === fecha);
  if (m && (m.weight_kg != null || m.waist_cm != null)) {
    L.push(`- Cuerpo: ${[m.weight_kg != null ? `peso ${formatoNumero(m.weight_kg)} kg` : null, m.waist_cm != null ? `cintura ${formatoNumero(m.waist_cm)} cm` : null].filter(Boolean).join(' · ')}`);
  }
  return L;
}
