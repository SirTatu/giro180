// Lógica pura del AGUA (hito 3-4b): tomas, botellas, meta en litros, cierre del día. Sin pantalla ni base de datos.
// Pruebas en tests/agua.test.mjs. Los CUATRO ESTADOS los decide estados.js. La meta es un hábito de cantidad de
// Nutri (Central → Hábitos, nombre con «Agua», unidad L o ml); las tomas viven en water_intakes y su suma es el total del día.
// Igual que con la proteína: por debajo de la meta es «sin completar» (nunca incumplido solo); al llegar se marca
// cumplido solo (note «auto-agua»); «Cerrar el día» es a mano (note «cierre-dia»).
import { evaluar, resumenSerie, logsDeSerie } from './estados.js';
import { rango } from './fechas.js';
import { parsearNumero, buscarHabitoDeModulo } from './entrenos.js';
import { NOTA_CIERRE } from './nutri.js';

export const NOTA_AUTO_AGUA = 'auto-agua';
export { NOTA_CIERRE };
export const BOTONES_RAPIDOS = [250, 500, 1000];            // ml

// Hábito de agua: módulo Nutri, tipo cantidad, nombre con «agua». Estricto: no adivina (proteína también es de cantidad).
export const buscarHabitoAgua = (defs, fecha) => buscarHabitoDeModulo(defs, fecha, 'nutri', 'quantity', /agua/, true);

// ---------- unidades ----------
const FACTOR = { l: 1000, lt: 1000, lts: 1000, litro: 1000, litros: 1000, ml: 1 };
export const factorUnidad = (unit) => FACTOR[String(unit ?? '').trim().toLowerCase()] ?? null;
// Meta del hábito en ml (null si la unidad del hábito no es L ni ml: la pantalla lo explica).
export const metaEnMl = (version) => {
  const f = factorUnidad(version?.unit);
  return f == null ? null : Math.round(Number(version.target_value) * f);
};
// ml -> valor en la unidad del hábito (se guarda así en habit_logs.value, comparable con target_value).
export const mlAUnidad = (ml, unit) => Math.round((ml / factorUnidad(unit)) * 1000) / 1000;

// 750 -> «750 ml» · 1500 -> «1,5 L» · 2000 -> «2 L» · 1250 -> «1,25 L»
export function formatoMl(ml) {
  if (ml < 1000) return `${ml} ml`;
  return `${String(Math.round(ml) / 1000).replace('.', ',')} L`;
}

// ---------- validación ----------
// Texto + unidad ('ml' o 'l') -> ml enteros. «0,5» en litros = 500 ml. Máximo 10000 ml por toma (20000 en una botella).
export function validarCantidad(texto, unidad, maxMl = 10000) {
  const n = parsearNumero(texto);
  if (n === null) return { ml: null, error: 'Escribí la cantidad.' };
  if (Number.isNaN(n)) return { ml: null, error: 'Escribí un número (por ejemplo 500 o 0,5).' };
  if (unidad !== 'ml' && unidad !== 'l') return { ml: null, error: 'Elegí la unidad: ml o L.' };
  const ml = unidad === 'l' ? Math.round(n * 1000) : n;
  if (!Number.isInteger(ml) || ml < 1) return { ml: null, error: 'La cantidad debe ser al menos 1 ml (en ml, sin decimales).' };
  if (ml > maxMl) return { ml: null, error: `No puede pasar de ${maxMl / 1000} litros.` };
  return { ml, error: null };
}

export function validarBotella({ nombre, volumen, unidad }) {
  const n = String(nombre ?? '').trim();
  if (!n) return { error: 'Ponele un nombre a la botella.' };
  if (n.length > 60) return { error: 'El nombre es demasiado largo (máximo 60 caracteres).' };
  const v = validarCantidad(volumen, unidad, 20000);
  if (v.error) return { error: v.error };
  return { error: null, datos: { name: n, volume_ml: v.ml } };
}

// ---------- totales ----------
export function totalAgua(tomas) {
  let ml = 0;
  for (const t of tomas) ml += Number(t.ml);
  return { ml, cantidad: tomas.length };
}
export function totalesPorDia(tomas) {
  const por = new Map();
  for (const t of tomas) { if (!por.has(t.drunk_on)) por.set(t.drunk_on, []); por.get(t.drunk_on).push(t); }
  return new Map([...por].map(([f, l]) => [f, totalAgua(l)]));
}

// ---------- estado del día y cierre ----------
// log: registro del hábito ese día. «cerrado» = cualquier registro que no sea el automático.
export function estadoAgua(log, t) {
  if (log) return { estado: log.status === 'done' ? 'cumplido' : log.status === 'exceeded' ? 'excedido' : 'incumplido', cerrado: log.note !== NOTA_AUTO_AGUA };
  return { estado: t.cantidad > 0 ? 'sin_completar' : 'no_registrado', cerrado: false };
}

// Qué escribir tras cambiar las tomas (misma regla que la proteína).
export function decidirSincronizacionAgua({ version, totales, log }) {
  if (!version) return { accion: 'ninguna' };
  if (log && log.note !== NOTA_AUTO_AGUA) return { accion: 'ninguna' };            // cierre manual: no se toca
  if (factorUnidad(version.unit) == null) return { accion: 'ninguna' };
  const valor = totales.cantidad ? mlAUnidad(totales.ml, version.unit) : null;
  if (valor != null && valor >= Number(version.target_value)) {
    if (log && log.status === 'done' && Number(log.value) === valor) return { accion: 'ninguna' };
    return { accion: 'guardar', status: 'done', value: valor, note: NOTA_AUTO_AGUA };
  }
  return log ? { accion: 'quitar' } : { accion: 'ninguna' };
}

export function decidirCierreAgua({ version, totales, fecha, hoyFecha }) {
  if (!version) return { error: 'El hábito de agua no estaba vigente ese día.' };
  if (factorUnidad(version.unit) == null) return { error: 'La unidad del hábito de agua debe ser L o ml (Central → Hábitos).' };
  if (fecha > hoyFecha) return { error: 'No se puede cerrar un día que todavía no llegó.' };
  if (totales.cantidad === 0) return { error: 'No hay tomas de agua cargadas: el día queda «no registrado».' };
  const valor = mlAUnidad(totales.ml, version.unit);
  return { error: null, status: evaluar(version, valor), value: valor, note: NOTA_CIERRE };
}

// ---------- resumen de un período ----------
// Promedio solo sobre días con tomas (un día sin registro no cuenta como 0 ml).
export function resumenAgua(versiones, logs, tomas, desde, hasta) {
  const estados = resumenSerie(versiones, logs, desde, hasta);
  const porDia = totalesPorDia(tomas);
  const propios = logsDeSerie(versiones, logs);
  let conDato = 0, suma = 0, mejor = null, sinCompletar = 0;
  for (const f of rango(desde, hasta)) {
    const t = porDia.get(f);
    if (!t) continue;
    conDato++; suma += t.ml;
    if (!propios.has(f)) sinCompletar++;
    if (!mejor || t.ml > mejor.ml) mejor = { fecha: f, ml: t.ml };
  }
  return { estados, conDato, promedioMl: conDato ? Math.round(suma / conDato) : null, mejor, sinCompletar };
}
