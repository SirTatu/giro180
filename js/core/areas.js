// Datos REALES de Gym y Nutri para los informes (hito 3-5a). Lógica pura: sin pantalla ni base de datos.
// Pruebas en tests/areas.test.mjs. Reglas: un dato que no se cargó o no se pudo leer NUNCA se muestra como 0 ni como
// incumplimiento; promedios solo sobre días con dato; todo lo que no se puede calcular es null y el texto lo dice.
import { totales, progresionEjercicio, formatoNumero, buscarHabitoEntrenar } from './entrenos.js';
import { resumenSerie, textoObjetivo } from './estados.js';
import { buscarHabitoPasos, resumenPasos, tendenciaMedidas, formatoDelta } from './cuerpo.js';
import { MACROS, totalesMacros, totalesMacrosPorDia } from './alimentos.js';
import { NOTA_AUTO_MACRO, buscarHabitoMacro, estadoMacro, notaMacro, resumenMacroPeriodo } from './macros.js';
import { buscarHabitoAgua, totalesPorDia as tomasPorDia, metaEnMl, formatoMl, totalAgua, estadoAgua } from './agua.js';

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

// Promedio de un valor por día SOLO sobre los días con dato (se usa para el agua; las macros usan resumenMacroPeriodo).
function promedioPorDia(porDia, p, valorDe) {
  let n = 0, suma = 0, mejor = null;
  for (const [f, t] of porDia) {
    if (!enRango(f, p)) continue;
    const v = valorDe(t);
    if (v == null) continue;
    n++; suma += v;
    if (!mejor || v > mejor.valor) mejor = { fecha: f, valor: v };
  }
  return { conDato: n, promedio: n ? suma / n : null, mejor };
}

function nutriArea(defs, logs, comidas, tomas, periodo, anterior) {
  if (!comidas && !tomas) return null;
  const out = { macros: null, agua: null };
  if (comidas) {
    const porDia = totalesMacrosPorDia(comidas);
    out.macros = MACROS.map((m) => {
      const hab = buscarHabitoMacro(defs, periodo.hasta, m.id);
      const resumen = (p) => resumenMacroPeriodo({ versiones: hab.versiones, logs, porDia, macroId: m.id, desde: p.desde, hasta: p.hasta });
      const a = resumen(periodo), b = resumen(anterior);
      return {
        macro: m, objetivo: hab.version ? textoObjetivo(hab.version) : null,
        actual: a, anterior: { promedio: b.promedio, conDato: b.conDato }
      };
    });
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
    nutri: nutriArea(defs, logs, comidas, tomas, periodo, anterior),
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
  if (modulo === 'nutri') return !!(areas.nutri?.macros?.some((x) => x.actual.conDato) || areas.nutri?.agua?.actual.conDato);
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
    const etiqueta = { kcal: 'calorías', carbs: 'carbos', protein: 'proteína', fat: 'grasas' };
    for (const x of n?.macros ?? []) {
      if (x.actual.promedio != null) f.push(`${etiqueta[x.macro.id]} ${formatoNumero(x.actual.promedio)} ${x.macro.unidad}/día`);
    }
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
  for (const x of n.macros ?? []) {
    const m = x.macro, a = x.actual, u = m.unidad;
    if (!x.objetivo && !a.conDato) continue;                                  // sin objetivo y sin datos: no hay nada que contar
    const obj = x.objetivo ? ` · objetivo ${x.objetivo}` : '';
    if (!a.conDato) { L.push(`- ${m.nombre}: sin datos cargados en el período${obj}`); continue; }
    const e = a.estados;
    const estados = e
      ? ` · ${pl(e.cumplidos, 'cumplido', 'cumplidos')}, ${pl(e.incumplidos, 'no cumplido', 'no cumplidos')}, ${pl(e.excedidos, 'excedido', 'excedidos')}${e.excedidos ? ' (no cuentan como no cumplidos)' : ''}, ${pl(a.pendientes, 'día sin cerrar', 'días sin cerrar')}`
      : '';
    const ant = x.anterior.promedio != null ? ` · período anterior: ${formatoNumero(x.anterior.promedio)} ${u}/día` : '';
    const parc = a.diasParciales ? ` · ${pl(a.diasParciales, 'día', 'días')} con comidas sin dato de ${m.nombre.toLowerCase()} (el promedio solo suma lo cargado)` : '';
    L.push(`- ${m.nombre}: promedio ${formatoNumero(a.promedio)} ${u}/día sobre ${pl(a.conDato, 'día', 'días')} con dato${obj}${estados} · día más alto ${formatoNumero(a.mayor.valor)} ${u} (${ddmm(a.mayor.fecha)})${ant}${parc}`);
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
  for (const x of areas.nutri?.macros ?? []) {
    if (x.actual.promedio == null && x.anterior.promedio == null) continue;
    const u = x.macro.unidad;
    L.push(`- ${x.macro.nombre} (promedio/día): ${x.actual.promedio != null ? formatoNumero(x.actual.promedio) + ' ' + u : 'sin datos'} vs ${x.anterior.promedio != null ? formatoNumero(x.anterior.promedio) + ' ' + u : 'sin datos'}`);
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
    const tm = totalesMacros(cs);
    const abrev = { kcal: (v) => `${formatoNumero(v)} kcal`, carbs: (v) => `C ${formatoNumero(v)} g`, protein: (v) => `P ${formatoNumero(v)} g`, fat: (v) => `G ${formatoNumero(v)} g` };
    const partes = MACROS.filter((m) => tm[m.id].total != null).map((m) => abrev[m.id](tm[m.id].total));
    // Solo se avisa de las macros con datos a medias (algunas comidas sí, otras no): la que nunca se carga no es un faltante.
    const faltas = MACROS.filter((m) => tm[m.id].conDato > 0 && tm[m.id].sinDato > 0).map((m) => `${pl(tm[m.id].sinDato, 'comida', 'comidas')} sin dato de ${m.nombre.toLowerCase()}`);
    L.push(`- Nutri: ${pl(cs.length, 'comida', 'comidas')} · ${partes.length ? partes.join(' · ') : 'sin macros cargadas'}${faltas.length ? ' · ' + faltas.join(' · ') : ''}`);
  }
  const ts = (tomas ?? []).filter((x) => x.drunk_on === fecha);
  if (ts.length) L.push(`- Agua: ${formatoMl(ts.reduce((a, t) => a + Number(t.ml), 0))} en ${pl(ts.length, 'toma', 'tomas')}`);
  const m = (medidas ?? []).find((x) => x.measured_on === fecha);
  if (m && (m.weight_kg != null || m.waist_cm != null)) {
    L.push(`- Cuerpo: ${[m.weight_kg != null ? `peso ${formatoNumero(m.weight_kg)} kg` : null, m.waist_cm != null ? `cintura ${formatoNumero(m.waist_cm)} cm` : null].filter(Boolean).join(' · ')}`);
  }
  return L;
}

// ---------- Panel de Central (hito 3-5b) ----------
// Lo de hoy y de la semana en curso, de un vistazo. Cada parte es null si no se pudo leer (nunca un 0 inventado).
// «Entrenos» es la cantidad de entrenamientos REGISTRADOS esta semana; el hábito Entrenar (si existe) se muestra aparte.
export function indicadoresPanel({ defs, logs, fecha, lunes, sesiones = null, comidas = null, tomas = null }) {
  const out = { entrenos: null, macros: null, agua: null };
  const logDe = (hab) => (hab.versiones.length ? logs.find((l) => l.log_date === fecha && hab.versiones.some((v) => v.id === l.habit_id)) ?? null : null);
  if (sesiones) {
    const ses = sesiones.filter((x) => x.performed_on >= lunes && x.performed_on <= fecha);
    const hab = buscarHabitoEntrenar(defs, fecha);
    const r = hab.versiones.length ? resumenSerie(hab.versiones, logs, lunes, fecha) : null;
    out.entrenos = { n: ses.length, habito: r && r.programados > 0 ? { programados: r.programados, cumplidos: r.cumplidos } : null };
  }
  if (comidas) {
    const delDia = comidas.filter((c) => c.eaten_on === fecha);
    const tm = totalesMacros(delDia);
    out.macros = MACROS.map((m) => {
      const hab = buscarHabitoMacro(defs, fecha, m.id);
      const e = estadoMacro({ version: hab.version, total: tm[m.id].total, log: logDe(hab), notaAuto: NOTA_AUTO_MACRO[m.id], hayComidas: delDia.length > 0 });
      return { id: m.id, nombre: m.nombre, unidad: m.unidad, version: hab.version, total: tm[m.id].total, conDato: tm[m.id].conDato, sinDato: tm[m.id].sinDato, cantidad: delDia.length, ...e };
    });
  }
  if (tomas) {
    const t = totalAgua(tomas.filter((x) => x.drunk_on === fecha));
    const hab = buscarHabitoAgua(defs, fecha);
    const metaMl = hab.version ? metaEnMl(hab.version) : null;
    const e = metaMl != null ? estadoAgua(logDe(hab), t) : { estado: null, cerrado: false };
    out.agua = { ml: t.ml, cantidad: t.cantidad, metaMl, falta: metaMl != null && t.cantidad && t.ml < metaMl ? metaMl - t.ml : null, ...e };
  }
  return out;
}

// Texto del Panel: tres métricas y algunas notas cortas.
export function textoPanel(ind) {
  const metricas = [], notas = [], faltan = [];
  const e = ind.entrenos;
  if (!e) { metricas.push({ valor: '—', etiqueta: 'Entrenos de la semana', clase: 'warn' }); faltan.push('entrenamientos'); }
  else {
    metricas.push({ valor: String(e.n), etiqueta: 'Entrenos registrados esta semana', clase: e.n ? 'ok' : '' });
    if (e.habito) notas.push(`Hábito Entrenar: ${e.habito.cumplidos} de ${e.habito.programados} días programados cumplidos.`);
  }
  const macros = ind.macros;
  if (!macros) { metricas.push({ valor: '—', etiqueta: 'Proteína de hoy', clase: 'warn' }); faltan.push('comidas'); }
  else {
    const p = macros.find((x) => x.id === 'protein');
    metricas.push({
      valor: p.total == null ? '—' : `${formatoNumero(p.total)} ${p.unidad}`,
      etiqueta: `Proteína de hoy${p.version ? ` · objetivo ${textoObjetivo(p.version)}` : ''}`, clase: p.estado === 'cumplido' ? 'ok' : ''
    });
    if (p.cantidad === 0) notas.push('Todavía no cargaste comidas hoy.');
    else {
      for (const x of macros) {
        if (x.version) {
          const nota = x.estado === 'sin_dato' ? 'sin dato cargado hoy' : notaMacro({ version: x.version, total: x.total, estado: x.estado, cerrado: x.cerrado, unidad: x.unidad });
          if (nota) notas.push(`${x.nombre}: ${nota}.`);
        }
        if ((x.version || x.id === 'protein') && x.conDato > 0 && x.sinDato > 0) {
          notas.push(`${pl(x.sinDato, 'comida', 'comidas')} sin dato de ${x.nombre.toLowerCase()} (el total solo suma lo cargado).`);
        }
      }
    }
  }
  const a = ind.agua;
  if (!a) { metricas.push({ valor: '—', etiqueta: 'Agua de hoy', clase: 'warn' }); faltan.push('agua'); }
  else {
    metricas.push({ valor: a.cantidad ? formatoMl(a.ml) : '—', etiqueta: `Agua de hoy${a.metaMl != null ? ` · meta ${formatoMl(a.metaMl)}` : ''}`, clase: a.estado === 'cumplido' ? 'ok' : '' });
    if (a.estado === 'cumplido') notas.push('Agua: meta cumplida.');
    else if (a.estado === 'incumplido') notas.push('Agua: día cerrado como incumplido.');
    else if (a.estado === 'excedido') notas.push('Agua: pasó el máximo (excedido).');
    else if (a.estado === 'sin_completar') notas.push(`Agua: sin completar${a.falta != null ? ` · faltan ${formatoMl(a.falta)}` : ''}.`);
    else if (a.cantidad === 0) notas.push('Agua: todavía no cargaste tomas hoy.');
  }
  if (faltan.length) notas.push(`No se pudo leer: ${faltan.join(', ')}. Probá recargar.`);
  return { metricas, notas };
}
