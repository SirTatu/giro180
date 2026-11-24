// Núcleo de INFORMES (lógica pura, sin pantalla ni base de datos).
// Arma períodos, comparaciones, indicadores y los textos en Markdown para pegar en los chats de ChatGPT.
// Respeta la regla de los 4 estados: la decisión de qué es cumplido / incumplido / sin registrar vive en
// estados.js; acá solo se leen sus resultados. Un dato sin registrar NUNCA se presenta como incumplimiento.
import { diaISO, sumarDias, rango, etiquetaLarga } from './fechas.js';
import { NOMBRES_MODULO, ORDEN_MODULOS } from './constantes.js';
import { ESTADO, estadoDia, logsDeSerie, resumenSerie, resumenGlobal, textoObjetivo } from './estados.js';
import { fragmentosCortos, hayDatosArea, lineasArea, lineasComparacion, lineasDia } from './areas.js';

// Chats especialistas. El Pedagogo cubre el módulo Estudio.
export const ESPECIALISTAS = [
  { id: 'central', nombre: 'Central', modulos: ['central'] },
  { id: 'gym', nombre: 'Gym', modulos: ['gym'] },
  { id: 'nutri', nombre: 'Nutri', modulos: ['nutri'] },
  { id: 'vida', nombre: 'Vida', modulos: ['vida'] },
  { id: 'pedagogo', nombre: 'Pedagogo', modulos: ['estudio'] },
  { id: 'derma', nombre: 'Derma', modulos: ['derma'] }
];

export const MAX_LINEAS_GENERAL = 15;

// ---------- Utilidades de formato ----------
const ddmm = (f) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}`; };
// Singular/plural: 1 día, 2 días.
export const pl = (n, sing, plur) => `${n} ${n === 1 ? sing : plur}`;
const una_linea = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();      // el texto libre no rompe el formato
const recortar = (t, n) => { const s = una_linea(t); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export const fmtPct = (n) => (n == null ? 'sin datos' : `${n} %`);
export const fmtDelta = (n) => (n == null ? 'sin datos para comparar' : n === 0 ? 'igual' : `${n > 0 ? '+' : ''}${n} pts`);
const fmtNum = (n) => (n == null ? 'sin datos' : String(n).replace('.', ','));
export const fmtEscala = (n) => (n == null ? 'sin datos' : `${fmtNum(n)}/5`);        // ánimo / energía sobre 5

// ---------- Prioridades de una fecha ----------
// Las prioridades que regían al final de un período (no las de hoy): empezaron antes o ese día
// y todavía no estaban cerradas. Sirve para que una semana pasada muestre lo que valía entonces.
export function prioridadesAl(prioridades, fecha) {
  return prioridades
    .filter((p) => p.started_on <= fecha && (p.ended_on == null || p.ended_on > fecha))
    .sort((a, b) => (a.started_on < b.started_on ? -1 : a.started_on > b.started_on ? 1 : 0));
}

// ---------- Períodos ----------
// Devuelve el período de la semana elegida y el período anterior COMPARABLE:
//  - semana cerrada: se comparan las dos semanas completas;
//  - semana en curso: lunes a hoy contra el mismo tramo de la semana anterior (comparación justa);
//  - semana futura: devuelve null (todavía no hay nada que evaluar).
export function periodosSemana(lunes, hoyStr) {
  if (diaISO(lunes) !== 1) throw new Error('periodosSemana espera un lunes: ' + lunes);
  if (lunes > hoyStr) return null;
  const domingo = sumarDias(lunes, 6);
  const enCurso = hoyStr < domingo;
  const hasta = enCurso ? hoyStr : domingo;
  const dias = rango(lunes, hasta).length;
  const lunesAnt = sumarDias(lunes, -7);
  return {
    actual: { desde: lunes, hasta, domingo, enCurso, dias },
    anterior: { desde: lunesAnt, hasta: sumarDias(lunesAnt, dias - 1) }
  };
}

// ---------- Comparación ----------
export const diferencia = (a, b) => (a == null || b == null ? null : a - b);

export function promedio(valores) {
  const v = valores.filter((x) => x != null && !Number.isNaN(Number(x))).map(Number);
  if (!v.length) return null;
  return Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10;
}

// Ánimo y energía de un período (solo cuenta los días con dato; sin datos devuelve null, no 0).
export function resumenAnimo(entradas, desde, hasta) {
  const en = entradas.filter((e) => e.entry_date >= desde && e.entry_date <= hasta);
  return {
    animo: promedio(en.map((e) => e.mood)),
    energia: promedio(en.map((e) => e.energy)),
    dias: en.filter((e) => e.mood != null || e.energy != null).length
  };
}

// Compara dos resúmenes (de resumenSerie / combinar). Los deltas son null si falta alguno de los dos.
export function compararResumenes(actual, anterior) {
  return {
    pct: { actual: actual.pct, anterior: anterior.pct, delta: diferencia(actual.pct, anterior.pct) },
    cobertura: { actual: actual.cobertura, anterior: anterior.cobertura, delta: diferencia(actual.cobertura, anterior.cobertura) },
    cumplidos: { actual: actual.cumplidos, anterior: anterior.cumplidos, delta: actual.cumplidos - anterior.cumplidos },
    noRegistrados: { actual: actual.noRegistrados, anterior: anterior.noRegistrados, delta: actual.noRegistrados - anterior.noRegistrados }
  };
}

// Calcula todo lo necesario de una semana. `logs` y `entradas` pueden cubrir más fechas que la semana
// (cada cálculo se limita a su rango). Devuelve null si la semana es futura.
export function calcularSemana({ series, logs, entradas = [], lunes, hoy: hoyStr }) {
  const p = periodosSemana(lunes, hoyStr);
  if (!p) return null;
  const actual = resumenGlobal(series, logs, p.actual.desde, p.actual.hasta);
  const anterior = resumenGlobal(series, logs, p.anterior.desde, p.anterior.hasta);
  const porModulo = new Map();
  for (const [m, r] of actual.porModulo) {
    const ant = anterior.porModulo.get(m);
    if (ant) porModulo.set(m, compararResumenes(r, ant));
  }
  return {
    periodo: p.actual,
    periodoAnterior: p.anterior,
    actual,
    anterior,
    comparacion: { total: compararResumenes(actual.total, anterior.total), porModulo },
    animo: {
      actual: resumenAnimo(entradas, p.actual.desde, p.actual.hasta),
      anterior: resumenAnimo(entradas, p.anterior.desde, p.anterior.hasta)
    }
  };
}

// Versión SOLO con datos simples (sin Map) para guardar como foto en weekly_reviews.indicators (jsonb).
export function aIndicadores(sem) {
  const plano = (r) => ({
    cumplidos: r.cumplidos, incumplidos: r.incumplidos, excedidos: r.excedidos ?? 0, noRegistrados: r.noRegistrados,
    sinActividad: r.sinActividad, programados: r.programados, pct: r.pct, cobertura: r.cobertura
  });
  return {
    periodo: { desde: sem.periodo.desde, hasta: sem.periodo.hasta, enCurso: sem.periodo.enCurso },
    total: plano(sem.actual.total),
    totalAnterior: plano(sem.anterior.total),
    porModulo: Object.fromEntries([...sem.actual.porModulo].map(([m, r]) => [m, plano(r)])),
    animo: sem.animo.actual
  };
}

// ---------- Detalle por hábito ----------
export function detalleHabitos(series, logs, desde, hasta, modulos = null) {
  const lista = [];
  for (const versiones of series.values()) {
    const ultima = versiones[versiones.length - 1];
    if (modulos && !modulos.includes(ultima.module)) continue;
    lista.push({ nombre: ultima.name, module: ultima.module, ...resumenSerie(versiones, logs, desde, hasta) });
  }
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Estado de cada hábito en un día (para el registro diario consolidado).
// Omite los hábitos sin actividad ese día (salvo que tengan un registro extra).
export function filasDelDia(series, logs, fecha) {
  const filas = [];
  for (const versiones of series.values()) {
    const d = estadoDia(versiones, logsDeSerie(versiones, logs), fecha);
    if (d.estado === ESTADO.SIN_ACTIVIDAD) continue;
    const v = d.version ?? versiones[versiones.length - 1];
    filas.push({
      nombre: v.name, module: v.module, estado: d.estado, extra: d.extra,
      valor: d.log?.value ?? null, meta: v.kind !== 'boolean' ? v.target_value : null, unidad: v.unit ?? '',
      max: v.kind !== 'boolean' ? v.target_max ?? null : null
    });
  }
  const orden = (m) => ORDEN_MODULOS.indexOf(m);
  return filas.sort((a, b) => orden(a.module) - orden(b.module) || a.nombre.localeCompare(b.nombre, 'es'));
}

// ---------- Textos en Markdown ----------
const TEXTO_ESTADO = {
  [ESTADO.CUMPLIDO]: 'cumplido',
  [ESTADO.INCUMPLIDO]: 'NO cumplido',
  [ESTADO.EXCEDIDO]: 'EXCEDIDO (pasó el máximo; no cuenta como incumplimiento)',
  [ESTADO.NO_REGISTRADO]: 'sin registrar'
};

function textoPeriodo(p) {
  const base = `${ddmm(p.desde)} al ${ddmm(p.hasta)}`;
  return p.enCurso ? `${base} (semana en curso, ${p.dias} de 7 días)` : base;
}

// Describe el estado de un módulo SIN confundir "no hay datos" con "incumplió".
function lineaModulo(nombre, r, cmp) {
  if (!r) return `${nombre}: sin hábitos definidos todavía`;
  if (!r.programados) return `${nombre}: sin actividad programada en el período`;
  const exc = r.excedidos ? ` · ${pl(r.excedidos, 'día excedido', 'días excedidos')} (no cuenta como incumplimiento)` : '';
  if (r.cumplidos + r.incumplidos === 0 && !r.excedidos) return `${nombre}: sin registros (${r.noRegistrados} sin registrar; no cuenta como incumplimiento)`;
  if (r.cumplidos + r.incumplidos === 0) return `${nombre}: sin días evaluables${exc} · ${r.noRegistrados} sin registrar`;
  const comp = cmp ? ` · vs anterior: ${fmtDelta(cmp.pct.delta)}` : '';
  return `${nombre}: ${fmtPct(r.pct)} cumplido (${r.cumplidos} de ${r.cumplidos + r.incumplidos} registrados) · registrado ${fmtPct(r.cobertura)}${exc}${comp}`;
}

// 1) Registro diario consolidado
export function registroDiarioMd({ fecha, filas, entrada, extras = [] }) {
  const L = [`## Registro diario · ${etiquetaLarga(fecha)}`];
  if (!filas.length) L.push('- No había hábitos programados ese día.');
  let moduloActual = null;
  for (const f of filas) {
    if (f.module !== moduloActual) { moduloActual = f.module; L.push(`**${NOMBRES_MODULO[f.module] ?? f.module}**`); }
    let detalle = TEXTO_ESTADO[f.estado];
    const objetivo = f.max != null ? ` · objetivo ${textoObjetivo({ target_value: f.meta, target_max: f.max, unit: f.unidad })}` : f.meta != null ? ` · meta ${f.meta}` : '';
    if (f.valor != null) detalle += ` (${f.valor}${f.unidad ? ' ' + f.unidad : ''}${objetivo})`;
    if (f.extra) detalle += ' · día no programado';
    L.push(`- ${una_linea(f.nombre)}: ${detalle}`);
  }
  const pend = filas.filter((f) => f.estado === ESTADO.NO_REGISTRADO).length;
  if (pend) L.push(`- _${pend} sin registrar: es dato faltante, no incumplimiento._`);
  if (extras.length) { L.push('**Gym y Nutri (cargado ese día)**'); L.push(...extras); }
  const animo = entrada?.mood != null ? `${entrada.mood}/5` : 'sin registrar';
  const energia = entrada?.energy != null ? `${entrada.energy}/5` : 'sin registrar';
  L.push(`**Ánimo:** ${animo} · **Energía:** ${energia}`);
  if (entrada?.notes && una_linea(entrada.notes)) L.push(`**Notas:** ${una_linea(entrada.notes)}`);
  return L.join('\n');
}

// 2) Resumen semanal
export function resumenSemanalMd(sem, { revision = null, prioridades = [] } = {}) {
  const t = sem.actual.total;
  const L = [`## Resumen semanal · ${textoPeriodo(sem.periodo)}`];
  if (!t.programados) {
    L.push('- No hay hábitos programados en este período.');
  } else {
    L.push(`- **Cumplimiento:** ${fmtPct(t.pct)} (${pl(t.cumplidos, 'cumplido', 'cumplidos')}, ${pl(t.incumplidos, 'no cumplido', 'no cumplidos')})${t.excedidos ? ` · ${pl(t.excedidos, 'día excedido', 'días excedidos')}: no cuentan como no cumplidos` : ''}`);
    L.push(`- **Registrado:** ${fmtPct(t.cobertura)} · ${t.noRegistrados} sin registrar (dato faltante, no incumplimiento)`);
  }
  const a = sem.animo.actual;
  L.push(`- **Ánimo:** ${fmtEscala(a.animo)} · **Energía:** ${fmtEscala(a.energia)} (${pl(a.dias, 'día', 'días')} con registro)`);
  if (prioridades.length) L.push(`- **Prioridades vigentes:** ${prioridades.map((p, i) => `${i + 1}) ${recortar(p, 60)}`).join(' · ')}`);
  if (revision?.summary && una_linea(revision.summary)) L.push(`- **Mi resumen:** ${una_linea(revision.summary)}`);
  if (revision?.decisions && una_linea(revision.decisions)) L.push(`- **Decisiones:** ${una_linea(revision.decisions)}`);
  return L.join('\n');
}

// 3) Comparación con la semana anterior
export function comparacionMd(sem, areas = null) {
  const L = [
    '## Comparación con la semana anterior',
    `- Esta semana: ${textoPeriodo(sem.periodo)}`,
    `- Semana anterior: ${ddmm(sem.periodoAnterior.desde)} al ${ddmm(sem.periodoAnterior.hasta)}${sem.periodo.enCurso ? ' (mismo tramo de días)' : ''}`
  ];
  const c = sem.comparacion.total;
  L.push(`- **Cumplimiento:** ${fmtPct(c.pct.actual)} vs ${fmtPct(c.pct.anterior)} → ${fmtDelta(c.pct.delta)}`);
  L.push(`- **Registrado:** ${fmtPct(c.cobertura.actual)} vs ${fmtPct(c.cobertura.anterior)} → ${fmtDelta(c.cobertura.delta)}`);
  const an = sem.animo;
  L.push(`- **Ánimo:** ${fmtNum(an.actual.animo)} vs ${fmtNum(an.anterior.animo)} · **Energía:** ${fmtNum(an.actual.energia)} vs ${fmtNum(an.anterior.energia)}`);
  for (const m of ORDEN_MODULOS) {
    const cm = sem.comparacion.porModulo.get(m);
    if (cm) L.push(`- ${NOMBRES_MODULO[m]}: ${fmtPct(cm.pct.actual)} vs ${fmtPct(cm.pct.anterior)} → ${fmtDelta(cm.pct.delta)}`);
  }
  L.push(...lineasComparacion(areas));
  if (sem.anterior.total.cumplidos + sem.anterior.total.incumplidos === 0) {
    L.push('- _La semana anterior no tiene registros: no hay base de comparación (no es un 0 %)._');
  }
  return L.join('\n');
}

// 4) Indicadores por área
export function indicadoresAreaMd(sem, series, logs, areas = null) {
  const L = [`## Indicadores por área · ${textoPeriodo(sem.periodo)}`];
  for (const m of ORDEN_MODULOS) {
    const r = sem.actual.porModulo.get(m);
    L.push(`**${lineaModulo(NOMBRES_MODULO[m], r, sem.comparacion.porModulo.get(m))}**`);
    if (r) {
      for (const d of detalleHabitos(series, logs, sem.periodo.desde, sem.periodo.hasta, [m])) {
        if (!d.programados) continue;
        const extra = (d.excedidos ? `, ${pl(d.excedidos, 'excedido', 'excedidos')}` : '') + (d.noRegistrados ? `, ${d.noRegistrados} sin registrar` : '');
        L.push(`- ${una_linea(d.nombre)}: ${pl(d.cumplidos, 'cumplido', 'cumplidos')}, ${pl(d.incumplidos, 'no cumplido', 'no cumplidos')}${extra}`);
      }
    }
    L.push(...lineasArea(areas, m, { incluirCuerpo: m === 'gym' }));
  }
  return L.join('\n');
}

// 5) Nota para un especialista
const REGLAS_FIJAS = {
  gym: 'Regla fija (innegociable, no modificar): entrenamiento 5 días por semana, de martes a sábado.'
};

export function notaEspecialistaMd(esp, sem, series, logs, { prioridades = [], areas = null } = {}) {
  const L = [`## Nota para ${esp.nombre} · ${textoPeriodo(sem.periodo)}`];
  if (REGLAS_FIJAS[esp.id]) L.push(`- ${REGLAS_FIJAS[esp.id]}`);
  for (const m of esp.modulos) {
    const r = sem.actual.porModulo.get(m);
    L.push(`- ${lineaModulo(NOMBRES_MODULO[m], r, sem.comparacion.porModulo.get(m))}`);
    if (r) {
      for (const d of detalleHabitos(series, logs, sem.periodo.desde, sem.periodo.hasta, [m])) {
        if (!d.programados) continue;
        L.push(`  - ${una_linea(d.nombre)}: ${pl(d.cumplidos, 'cumplido', 'cumplidos')}, ${pl(d.incumplidos, 'no cumplido', 'no cumplidos')}${d.excedidos ? `, ${pl(d.excedidos, 'excedido', 'excedidos')}` : ''}, ${d.noRegistrados} sin registrar`);
      }
    }
    L.push(...lineasArea(areas, m));
  }
  const a = sem.animo.actual;
  L.push(`- Contexto general: ánimo ${fmtEscala(a.animo)}, energía ${fmtEscala(a.energia)} (${pl(a.dias, 'día', 'días')} con registro)`);
  if (prioridades.length) L.push(`- Prioridades vigentes: ${prioridades.map((p, i) => `${i + 1}) ${recortar(p, 60)}`).join(' · ')}`);
  const conDatosReales = areas && esp.modulos.some((m) => m === 'gym' || m === 'nutri');
  L.push(conDatosReales
    ? '- Lo que no figura no fue registrado o no se pudo leer (no asumir incumplimiento). Promedios solo sobre días con dato.'
    : '- Los datos de esta área en la app por ahora son solo hábitos; lo que no figura no fue registrado (no asumir incumplimiento).');
  return L.join('\n');
}

// Recorta a un máximo de líneas (garantía dura del INFORME GENERAL).
export function limitarLineas(texto, max = MAX_LINEAS_GENERAL) {
  const l = texto.split('\n');
  return l.length <= max ? texto : l.slice(0, max).join('\n');
}

// 6) INFORME GENERAL: máximo 15 líneas.
export function informeGeneralMd(sem, { prioridades = [], revision = null, areas = null } = {}) {
  const t = sem.actual.total;
  const c = sem.comparacion.total;
  const L = [`# INFORME GENERAL · semana ${textoPeriodo(sem.periodo)}`];
  if (!t.programados) {
    L.push('- Sin hábitos programados en el período.');
  } else {
    L.push(`- **Cumplimiento:** ${fmtPct(t.pct)} (registrado ${fmtPct(t.cobertura)}) · vs semana anterior: ${fmtDelta(c.pct.delta)}${t.excedidos ? ` · ${pl(t.excedidos, 'día excedido', 'días excedidos')} (no cuentan como no cumplidos)` : ''}`);
    L.push(`- **Sin registrar:** ${t.noRegistrados} de ${t.programados} programados (dato faltante, no incumplimiento)`);
  }
  const a = sem.animo.actual;
  L.push(`- **Ánimo:** ${fmtEscala(a.animo)} · **Energía:** ${fmtEscala(a.energia)} (${pl(a.dias, 'día', 'días')} con registro)`);
  L.push(`- **Prioridades:** ${prioridades.length ? prioridades.map((p, i) => `${i + 1}) ${recortar(p, 50)}`).join(' · ') : 'sin prioridades vigentes'}`);
  const conDatos = ORDEN_MODULOS.filter((m) => sem.actual.porModulo.get(m)?.programados > 0 || hayDatosArea(areas, m));
  if (conDatos.length) L.push('- **Por área:**');
  for (const m of conDatos) {
    const r = sem.actual.porModulo.get(m);
    const cm = sem.comparacion.porModulo.get(m);
    const base = r?.programados ? `${fmtPct(r.pct)} (reg. ${fmtPct(r.cobertura)}) · ${fmtDelta(cm?.pct.delta)}` : 'sin hábitos programados';
    L.push(`  - ${NOMBRES_MODULO[m]}: ${[base, ...fragmentosCortos(areas, m)].join(' · ')}`);
  }
  const sinDatos = ORDEN_MODULOS.filter((m) => !conDatos.includes(m)).map((m) => NOMBRES_MODULO[m]);
  if (sinDatos.length) L.push(`- **Sin datos aún:** ${sinDatos.join(', ')}`);
  if (revision?.decisions && una_linea(revision.decisions)) L.push(`- **Decisiones:** ${recortar(revision.decisions, 140)}`);
  return limitarLineas(L.join('\n'));
}

// ---------- Todos los informes juntos ----------
// Arma los seis textos de una vez. `fecha` es el día del registro diario; `especialista` es el id del chat
// (si no existe, se usa Central). Es lo único que necesita la pantalla de Informes.
export function armarInformes({ sem, series, logs, entradas = [], fecha, especialista, prioridades = [], revision = null, areas = null, datosAreas = null }) {
  const esp = ESPECIALISTAS.find((e) => e.id === especialista) ?? ESPECIALISTAS[0];
  const entrada = entradas.find((e) => e.entry_date === fecha) ?? null;
  return {
    general: informeGeneralMd(sem, { prioridades, revision, areas }),
    diario: registroDiarioMd({ fecha, filas: filasDelDia(series, logs, fecha), entrada, extras: datosAreas ? lineasDia({ fecha, datos: datosAreas }) : [] }),
    semanal: resumenSemanalMd(sem, { revision, prioridades }),
    comparacion: comparacionMd(sem, areas),
    areas: indicadoresAreaMd(sem, series, logs, areas),
    especialista: notaEspecialistaMd(esp, sem, series, logs, { prioridades, areas })
  };
}
