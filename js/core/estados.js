// Lógica central de los ESTADOS. Es el único lugar donde se decide qué significa cada día.
//   cumplido       -> hay registro con status 'done'
//   incumplido     -> hay registro con status 'missed'
//   excedido       -> hay registro con status 'exceeded': se pasó del MÁXIMO del objetivo. Cuenta como registrado, pero NO como
//                     no cumplido: queda fuera del porcentaje (ni suma ni resta) y se muestra aparte.
//   no_registrado  -> día programado SIN registro (nunca cuenta como incumplimiento)
//   sin_actividad  -> el hábito no estaba programado ese día (o todavía no existía)
// Objetivo de un hábito de cantidad/duración: target_value = mínimo (como siempre) y target_max = máximo opcional.
//   «al menos X» = X sin máximo · «como máximo Y» = mínimo 0 y máximo Y · «entre X e Y» = los dos.
import { diaISO, rango } from './fechas.js';

export const ESTADO = Object.freeze({
  CUMPLIDO: 'cumplido',
  INCUMPLIDO: 'incumplido',
  EXCEDIDO: 'excedido',
  NO_REGISTRADO: 'no_registrado',
  SIN_ACTIVIDAD: 'sin_actividad'
});

// Agrupa las versiones de cada hábito (misma series_id), ordenadas por fecha de inicio.
export function agruparPorSerie(defs) {
  const mapa = new Map();
  for (const d of defs) {
    if (!mapa.has(d.series_id)) mapa.set(d.series_id, []);
    mapa.get(d.series_id).push(d);
  }
  for (const v of mapa.values()) v.sort((a, b) => (a.valid_from < b.valid_from ? -1 : a.valid_from > b.valid_from ? 1 : 0));
  return mapa;
}

// La versión del hábito que regía en una fecha (la meta de ESE día, no la actual).
export function versionVigente(versiones, fecha) {
  return versiones.find((v) => v.valid_from <= fecha && (v.valid_to == null || v.valid_to >= fecha)) ?? null;
}

// Registros de una serie, indexados por fecha.
export function logsDeSerie(versiones, logs) {
  const ids = new Set(versiones.map((v) => v.id));
  const mapa = new Map();
  for (const l of logs) if (ids.has(l.habit_id)) mapa.set(l.log_date, l);
  return mapa;
}

export function estadoDia(versiones, logsPorFecha, fecha) {
  const version = versionVigente(versiones, fecha);
  const programado = !!version && version.scheduled_days.includes(diaISO(fecha));
  const log = logsPorFecha.get(fecha) ?? null;
  if (log) {
    return {
      estado: log.status === 'done' ? ESTADO.CUMPLIDO : log.status === 'exceeded' ? ESTADO.EXCEDIDO : ESTADO.INCUMPLIDO,
      version, log, extra: !programado   // extra = registro en un día no programado
    };
  }
  if (!programado) return { estado: ESTADO.SIN_ACTIVIDAD, version, log: null, extra: false };
  return { estado: ESTADO.NO_REGISTRADO, version, log: null, extra: false };
}

// Para hábitos de cantidad/duración: el estado se decide con el objetivo de la versión vigente.
// Sin máximo (target_max null) se comporta exactamente como siempre: llegar a la meta = cumplido, si no, incumplido.
// Con máximo: más que el máximo = 'exceeded'; entre el mínimo y el máximo (inclusive) = 'done'; menos que el mínimo = 'missed'.
export function evaluar(version, valor) {
  const v = Number(valor);
  if (version.target_max != null && v > Number(version.target_max)) return 'exceeded';
  return v >= Number(version.target_value) ? 'done' : 'missed';
}

// Tipo de objetivo según sus números: 'al_menos' | 'maximo' | 'entre'.
export function tipoObjetivo(version) {
  if (version.target_max == null) return 'al_menos';
  return Number(version.target_value) > 0 ? 'entre' : 'maximo';
}

// «120 g o más» · «como máximo 2000 kcal» · «entre 1500 y 2000 kcal»
export function textoObjetivo(version) {
  const u = version.unit ? ` ${version.unit}` : '';
  const t = tipoObjetivo(version);
  if (t === 'maximo') return `como máximo ${Number(version.target_max)}${u}`;
  if (t === 'entre') return `entre ${Number(version.target_value)} y ${Number(version.target_max)}${u}`;
  return `${version.target_value}${u} o más`;
}

// Resumen de un período. Pasar un "hasta" que NO supere el día de hoy (los días futuros no se evalúan).
// % de cumplimiento = cumplidos / (cumplidos + incumplidos): los no registrados NO penalizan y los EXCEDIDOS tampoco
// (ni suman ni restan). La cobertura indica cuánto de lo programado quedó registrado (los excedidos cuentan como registrados).
export function resumenSerie(versiones, logs, desde, hasta) {
  const porFecha = logsDeSerie(versiones, logs);
  const r = { cumplidos: 0, incumplidos: 0, excedidos: 0, noRegistrados: 0, sinActividad: 0, extras: 0 };
  for (const f of rango(desde, hasta)) {
    const d = estadoDia(versiones, porFecha, f);
    if (d.extra) { r.extras++; continue; }
    if (d.estado === ESTADO.CUMPLIDO) r.cumplidos++;
    else if (d.estado === ESTADO.INCUMPLIDO) r.incumplidos++;
    else if (d.estado === ESTADO.EXCEDIDO) r.excedidos++;
    else if (d.estado === ESTADO.NO_REGISTRADO) r.noRegistrados++;
    else r.sinActividad++;
  }
  return completar(r);
}

function completar(r) {
  r.programados = r.cumplidos + r.incumplidos + r.excedidos + r.noRegistrados;
  const evaluados = r.cumplidos + r.incumplidos;                         // base del % de cumplimiento (sin excedidos)
  const registrados = evaluados + r.excedidos;                           // base de la cobertura (con excedidos)
  r.pct = evaluados ? Math.round((100 * r.cumplidos) / evaluados) : null;
  r.cobertura = r.programados ? Math.round((100 * registrados) / r.programados) : null;
  return r;
}

// Suma varios resúmenes y recalcula los porcentajes sobre el total (no promedia porcentajes).
export function combinar(resumenes) {
  const r = { cumplidos: 0, incumplidos: 0, excedidos: 0, noRegistrados: 0, sinActividad: 0, extras: 0 };
  for (const x of resumenes) for (const k of Object.keys(r)) r[k] += x[k] ?? 0;
  return completar(r);
}

// Resumen de todos los hábitos en un período: total y por módulo.
export function resumenGlobal(series, logs, desde, hasta) {
  const todos = [];
  const porModulo = new Map();
  for (const versiones of series.values()) {
    const r = resumenSerie(versiones, logs, desde, hasta);
    todos.push(r);
    const m = versiones[versiones.length - 1].module;
    if (!porModulo.has(m)) porModulo.set(m, []);
    porModulo.get(m).push(r);
  }
  return {
    total: combinar(todos),
    porModulo: new Map([...porModulo].map(([m, lista]) => [m, combinar(lista)]))
  };
}
