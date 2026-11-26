// Objetivos de las 4 macros (hito 3-6c2): configuración, estado del día, cumplido/excedido automáticos y cierre del día.
// Lógica pura: sin pantalla ni base de datos. Pruebas en tests/macros.test.mjs.
// Cada macro con objetivo es un hábito de cantidad del módulo Nutri (versionado, como todos los hábitos):
//   «al menos X» = X sin máximo · «como máximo Y» = mínimo 0 y máximo Y · «entre X e Y» = los dos.
// Quién decide cumplido / incumplido / excedido es SIEMPRE estados.js (evaluar); acá solo se decide cuándo escribir un
// registro y qué mostrar. Reglas acordadas:
//   · Por debajo del mínimo con el día abierto = «sin completar»: NUNCA se marca incumplido solo.
//   · «Al menos» y «entre»: al llegar al mínimo se marca cumplido solo; al pasar el máximo, excedido solo (se recalcula
//     mientras el día esté abierto).
//   · «Como máximo»: NO se marca cumplido durante el día (con el primer bocado ya estarías «dentro»): lo decide el cierre.
//     Pasarse del máximo sí marca excedido enseguida.
//   · «Cerrar el día» es siempre a mano, y un solo botón cierra todas las macros con objetivo y datos.
import { evaluar, tipoObjetivo } from './estados.js';
import { sumarDias } from './fechas.js';
import { parsearNumero, buscarHabitoDeModulo, formatoNumero } from './entrenos.js';
import { MACROS } from './alimentos.js';
import { NOTA_CIERRE } from './nutri.js';

export { NOTA_CIERRE };

export const PATRON_HABITO = { kcal: /calor|kcal/, carbs: /carbo|hidrat/, protein: /prote/, fat: /grasa|lipid/ };
// Marca del registro automático de cada macro (la de proteína es la de siempre, para no tocar registros existentes).
export const NOTA_AUTO_MACRO = { kcal: 'auto-calorias', carbs: 'auto-carbohidratos', protein: 'auto-proteina', fat: 'auto-grasas' };
export const LIMITE_OBJETIVO = { kcal: 20000, carbs: 2000, protein: 1000, fat: 1000 };
export const TIPOS_OBJETIVO = [
  { id: 'ninguno', nombre: 'Sin objetivo' }, { id: 'al_menos', nombre: 'Al menos' },
  { id: 'maximo', nombre: 'Como máximo' }, { id: 'entre', nombre: 'Entre un mínimo y un máximo' }
];

const r1 = (n) => Math.round(n * 10) / 10;
const macroDe = (id) => MACROS.find((m) => m.id === id);

// Hábito de una macro: módulo Nutri, cantidad, nombre reconocible. Estricto: no adivina (también existe el de agua).
export const buscarHabitoMacro = (defs, fecha, macroId) =>
  buscarHabitoDeModulo(defs, fecha, 'nutri', 'quantity', PATRON_HABITO[macroId], true);

// ---------- configuración del objetivo ----------
export function validarObjetivo({ macroId, tipo, minimo, maximo }) {
  const macro = macroDe(macroId);
  if (!macro) return { error: 'Macro desconocida.' };
  if (!TIPOS_OBJETIVO.some((t) => t.id === tipo)) return { error: 'Elegí el tipo de objetivo.' };
  if (tipo === 'ninguno') return { error: null, datos: null };
  const tope = LIMITE_OBJETIVO[macroId];
  const num = (texto, que) => {
    const v = parsearNumero(texto);
    if (v === null) return { error: `Escribí ${que}.` };
    if (Number.isNaN(v) || v <= 0 || v > tope || Math.round(v * 10) / 10 !== v) {
      return { error: `Revisá ${que}: un número mayor que 0 y hasta ${formatoNumero(tope)}, con un decimal como máximo.` };
    }
    return { v };
  };
  if (tipo === 'al_menos') {
    const m = num(minimo, 'el mínimo'); if (m.error) return { error: m.error };
    return { error: null, datos: { target_value: m.v, target_max: null } };
  }
  if (tipo === 'maximo') {
    const x = num(maximo, 'el máximo'); if (x.error) return { error: x.error };
    return { error: null, datos: { target_value: 0, target_max: x.v } };
  }
  const m = num(minimo, 'el mínimo'); if (m.error) return { error: m.error };
  const x = num(maximo, 'el máximo'); if (x.error) return { error: x.error };
  if (x.v < m.v) return { error: 'El máximo no puede ser menor que el mínimo.' };
  return { error: null, datos: { target_value: m.v, target_max: x.v } };
}

// Para rellenar el formulario con el objetivo actual.
export function objetivoDeVersion(version) {
  if (!version) return { tipo: 'ninguno', minimo: '', maximo: '' };
  const tipo = { al_menos: 'al_menos', maximo: 'maximo', entre: 'entre' }[tipoObjetivo(version)];
  return {
    tipo,
    minimo: tipo === 'maximo' ? '' : String(Number(version.target_value)),
    maximo: version.target_max == null ? '' : String(Number(version.target_max))
  };
}

// Qué operación hay que hacer sobre los hábitos para dejar el objetivo pedido. Mismas reglas de versionado que Central:
// si la versión actual ya tiene registros, el cambio crea una versión nueva desde una fecha posterior y el historial no cambia.
export function planObjetivo({ macroId, hab, tipo, datos, desde, hoyFecha, tieneLogs }) {
  const macro = macroDe(macroId);
  if (hab.motivo === 'ambiguo') return { error: `Hay más de un hábito de ${macro.nombre.toLowerCase()} en Nutri. Dejá uno solo (Central → Hábitos) y volvé a intentar.` };
  const versiones = hab.versiones ?? [];
  const ultima = versiones[versiones.length - 1] ?? null;
  const vigente = hab.version ?? null;

  if (tipo === 'ninguno') {
    if (!vigente) return { error: null, accion: 'ninguna', mensaje: 'No tenías un objetivo vigente para esta macro.' };
    if (!desde || desde <= vigente.valid_from) {
      return { error: `Para quitar el objetivo elegí una fecha posterior al inicio de la versión actual (${vigente.valid_from}). Si lo creaste hoy por error, borralo desde Central → Hábitos.` };
    }
    return { error: null, accion: 'cerrar', id: vigente.id, valid_to: sumarDias(desde, -1), mensaje: `Objetivo de ${macro.nombre.toLowerCase()} quitado desde el ${desde}. El historial no cambia.` };
  }
  if (!datos) return { error: 'Faltan los valores del objetivo.' };

  if (!ultima) {
    if (!desde) return { error: 'Elegí desde cuándo rige.' };
    return {
      error: null, accion: 'crear', mensaje: `Objetivo de ${macro.nombre.toLowerCase()} creado.`,
      campos: { module: 'nutri', name: macro.nombre, kind: 'quantity', unit: macro.unidad, ...datos, scheduled_days: [1, 2, 3, 4, 5, 6, 7], valid_from: desde, locked: false }
    };
  }
  if (!vigente) {
    if (ultima.valid_to != null && ultima.valid_to < hoyFecha) {
      if (!desde || desde <= ultima.valid_to) return { error: `La nueva vigencia debe ser posterior al fin del objetivo anterior (${ultima.valid_to}).` };
      // Misma serie (mismo hábito): si se creara otro, quedarían dos hábitos de la misma macro y la app no sabría cuál usar.
      return {
        error: null, accion: 'reabrir_serie', mensaje: `Objetivo de ${macro.nombre.toLowerCase()} activado desde el ${desde}.`,
        campos: { series_id: ultima.series_id, module: 'nutri', name: ultima.name, kind: 'quantity', unit: ultima.unit ?? macro.unidad, ...datos, scheduled_days: ultima.scheduled_days, valid_from: desde, locked: false }
      };
    }
    return { error: 'Hay un objetivo que todavía no empezó a regir. Editalo desde Central → Hábitos.' };
  }
  if (Number(vigente.target_value) === datos.target_value && (vigente.target_max == null ? null : Number(vigente.target_max)) === datos.target_max) {
    return { error: null, accion: 'ninguna', mensaje: 'Ese ya es tu objetivo actual.' };
  }
  if (!tieneLogs) {
    return { error: null, accion: 'corregir', id: vigente.id, campos: { ...datos }, mensaje: `Objetivo de ${macro.nombre.toLowerCase()} actualizado.` };
  }
  if (!desde || desde <= vigente.valid_from) return { error: `La nueva vigencia debe ser posterior al inicio de la versión actual (${vigente.valid_from}).` };
  return {
    error: null, accion: 'nueva_version', anterior: vigente, desde,
    campos: { name: vigente.name, kind: 'quantity', unit: vigente.unit, scheduled_days: vigente.scheduled_days, ...datos },
    mensaje: `Objetivo de ${macro.nombre.toLowerCase()} actualizado desde el ${desde}. El historial no cambia.`
  };
}

// ---------- estado del día ----------
// Cómo está el total frente al objetivo, sin registrar nada: 'por_debajo' | 'dentro' | 'excedido' (null si no hay dato).
export function estadoVivo(version, total) {
  if (!version || total == null) return null;
  const e = evaluar(version, total);
  return e === 'exceeded' ? 'excedido' : e === 'done' ? 'dentro' : 'por_debajo';
}

export const estaCerradoMacro = (log, notaAuto) => !!log && log.note !== notaAuto;

// Lo que se muestra de una macro. estado: cumplido · incumplido · excedido (según el registro) · sin_completar ·
// dentro_del_limite · dentro_del_rango (en vivo, sin registro) · sin_dato · no_registrado · null (no hay objetivo).
export function estadoMacro({ version, total, log, notaAuto, hayComidas }) {
  if (!version) return { estado: null, cerrado: false };
  if (log) {
    return { estado: log.status === 'done' ? 'cumplido' : log.status === 'exceeded' ? 'excedido' : 'incumplido', cerrado: estaCerradoMacro(log, notaAuto) };
  }
  if (!hayComidas) return { estado: 'no_registrado', cerrado: false };
  if (total == null) return { estado: 'sin_dato', cerrado: false };
  const vivo = estadoVivo(version, total);
  if (vivo === 'por_debajo') return { estado: 'sin_completar', cerrado: false };
  if (vivo === 'excedido') return { estado: 'excedido', cerrado: false };
  return { estado: tipoObjetivo(version) === 'maximo' ? 'dentro_del_limite' : 'dentro_del_rango', cerrado: false };
}

// Nota corta debajo de cada macro (faltan / quedan / te pasaste). Solo números reales.
export function notaMacro({ version, total, estado, cerrado, unidad }) {
  if (!version || total == null) return '';
  const u = unidad ? ` ${unidad}` : '';
  const min = Number(version.target_value), max = version.target_max == null ? null : Number(version.target_max);
  const tipo = tipoObjetivo(version);
  let t = '';
  if (estado === 'excedido') t = `te pasaste por ${formatoNumero(r1(total - max))}${u}`;
  else if (estado === 'sin_completar') t = `faltan ${formatoNumero(r1(min - total))}${u} para el mínimo`;
  else if (estado === 'dentro_del_limite') t = `dentro del límite · quedan ${formatoNumero(r1(max - total))}${u}`;
  else if (estado === 'dentro_del_rango') t = 'dentro del rango';
  else if (estado === 'cumplido') t = tipo === 'maximo' ? 'dentro del límite' : tipo === 'entre' ? 'dentro del rango' : 'objetivo cumplido';
  else if (estado === 'incumplido') t = 'no llegaste al mínimo';
  return t && cerrado ? `${t} · día cerrado` : t;
}

// ---------- cumplido / excedido automáticos ----------
// Después de cambiar comidas: ¿hay que escribir o quitar el registro automático de esta macro?
// Nunca se marca «incumplido» solo. Un registro que no sea el automático (cierre u otro) no se toca.
export function decidirSincronizacionMacro({ version, total, log, notaAuto }) {
  if (!version) return { accion: 'ninguna' };
  if (estaCerradoMacro(log, notaAuto)) return { accion: 'ninguna' };
  const quitar = () => (log ? { accion: 'quitar' } : { accion: 'ninguna' });
  if (total == null) return quitar();
  const status = evaluar(version, total);
  if (status === 'missed') return quitar();
  if (status === 'done' && tipoObjetivo(version) === 'maximo') return quitar();        // «como máximo»: lo decide el cierre
  if (log && log.status === status && Number(log.value) === total && log.note === notaAuto) return { accion: 'ninguna' };
  return { accion: 'guardar', status, value: total, note: notaAuto };
}

// ---------- cierre del día (un solo botón para todas las macros con objetivo) ----------
// filas: [{ macroId, nombre, version, total, sinDato, log }]. Solo se cierran las macros con objetivo que tengan datos;
// las que no tienen ningún dato quedan sin registrar (faltaría el dato, no el objetivo). Los días futuros no se cierran.
export function decidirCierreMacros({ filas, hayComidas, fecha, hoyFecha }) {
  if (fecha > hoyFecha) return { error: 'No se puede cerrar un día que todavía no llegó.' };
  if (!hayComidas) return { error: 'No hay comidas cargadas: el día queda «no registrado».' };
  const conObjetivo = filas.filter((f) => f.version);
  if (!conObjetivo.length) return { error: 'No hay objetivos de macros vigentes ese día. Configuralos en la pestaña Objetivos.' };
  const abiertas = conObjetivo.filter((f) => !estaCerradoMacro(f.log, NOTA_AUTO_MACRO[f.macroId]));
  if (!abiertas.length) return { error: 'El día ya está cerrado. Si cambiaste comidas, reabrilo y volvé a cerrarlo.' };
  const escribir = [], omitidas = [], conFaltantes = [];
  for (const f of abiertas) {
    if (f.total == null) { omitidas.push(f.nombre); continue; }
    escribir.push({ macroId: f.macroId, nombre: f.nombre, habit_id: f.version.id, status: evaluar(f.version, f.total), value: f.total, note: NOTA_CIERRE });
    if (f.sinDato > 0) conFaltantes.push(f.nombre.toLowerCase());
  }
  if (!escribir.length) return { error: 'Ninguna macro con objetivo tiene datos cargados. Cargalos antes de cerrar para no marcar un incumplimiento falso.' };
  const avisos = [];
  if (conFaltantes.length) avisos.push(`Hay comidas sin dato de ${conFaltantes.join(', ')}: los totales solo suman lo cargado.`);
  if (omitidas.length) avisos.push(`Sin ningún dato y sin cerrar: ${omitidas.map((n) => n.toLowerCase()).join(', ')}.`);
  const cuenta = (s) => escribir.filter((e) => e.status === s).length;
  return {
    error: null, escribir, omitidas,
    resumen: { cumplidas: cuenta('done'), incumplidas: cuenta('missed'), excedidas: cuenta('exceeded') },
    confirmar: avisos.length ? `${avisos.join(' ')} ¿Cerrar el día igual?` : null
  };
}

export const textoResumenCierre = ({ cumplidas, incumplidas, excedidas }) => {
  const p = [];
  if (cumplidas) p.push(`${cumplidas} cumplida${cumplidas === 1 ? '' : 's'}`);
  if (incumplidas) p.push(`${incumplidas} incumplida${incumplidas === 1 ? '' : 's'}`);
  if (excedidas) p.push(`${excedidas} excedida${excedidas === 1 ? '' : 's'}`);
  return p.join(', ');
};

// Registros de macros que cuentan como cerrados (los que se borran al reabrir el día).
export const logsParaReabrir = (filas) =>
  filas.filter((f) => f.version && estaCerradoMacro(f.log, NOTA_AUTO_MACRO[f.macroId])).map((f) => f.log);
