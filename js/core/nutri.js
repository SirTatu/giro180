// Lógica pura de NUTRI (hito 3-4a): comidas, proteína del día, cierre del día. Sin pantalla ni base de datos.
// Pruebas en tests/nutri.test.mjs. Los CUATRO ESTADOS los decide siempre estados.js: acá solo se decide
// cuándo escribir un registro (cumplido automático al llegar a la meta, cierre manual) y se arman números.
// «Sin completar» NO es un estado nuevo: es un día con comidas y sin registro (para estados.js sigue siendo «no registrado»).
import { resumenSerie, logsDeSerie, evaluar } from './estados.js';
import { rango } from './fechas.js';
import { parsearNumero, buscarHabitoDeModulo } from './entrenos.js';

export const TIPOS_COMIDA = [
  { id: 'desayuno', nombre: 'Desayuno' }, { id: 'almuerzo', nombre: 'Almuerzo' }, { id: 'merienda', nombre: 'Merienda' },
  { id: 'cena', nombre: 'Cena' }, { id: 'colacion', nombre: 'Colación' }, { id: 'otro', nombre: 'Otro' }
];
export const nombreTipo = (id) => TIPOS_COMIDA.find((t) => t.id === id)?.nombre ?? id;

// Marcas en habit_logs.note: «auto» = llegó a la meta y se marcó solo (el día sigue abierto, se recalcula);
// cualquier otro registro (cierre manual o cargado desde Central → Hoy) es una decisión tuya y la app no lo toca.
export const NOTA_AUTO = 'auto-proteina';
export const NOTA_CIERRE = 'cierre-dia';

const r1 = (n) => Math.round(n * 10) / 10;

// Hábito de proteína: módulo Nutri, tipo cantidad, nombre con «prote».
export const buscarHabitoProteina = (defs, fecha) => buscarHabitoDeModulo(defs, fecha, 'nutri', 'quantity', /prote/, true);

// ---------- validación ----------
// Proteína opcional: vacío = null (NO cargada, nunca 0). Hasta 500 g con un decimal.
export function validarProteina(texto) {
  const n = parsearNumero(texto);
  if (n === null) return { valor: null, error: null };
  if (Number.isNaN(n) || n > 500 || Math.round(n * 10) / 10 !== n) {
    return { valor: null, error: 'La proteína debe ser un número entre 0 y 500 g, con un decimal como máximo (o dejala vacía).' };
  }
  return { valor: n, error: null };
}

// ---------- totales ----------
// Solo suma lo cargado. total = null si ninguna comida tiene proteína (no es lo mismo que 0 g).
export function totalDia(comidas) {
  let suma = 0, con = 0;
  for (const c of comidas) if (c.protein_g != null) { suma += Number(c.protein_g); con++; }
  return { total: con ? r1(suma) : null, cantidad: comidas.length, conProteina: con, sinProteina: comidas.length - con };
}

export function totalesPorDia(comidas) {
  const porDia = new Map();
  for (const c of comidas) {
    if (!porDia.has(c.eaten_on)) porDia.set(c.eaten_on, []);
    porDia.get(c.eaten_on).push(c);
  }
  return new Map([...porDia].map(([f, lista]) => [f, totalDia(lista)]));
}

export const aviso = (t) => t.sinProteina === 0 ? null
  : t.sinProteina === 1 ? '1 comida quedó sin proteína cargada.' : `${t.sinProteina} comidas quedaron sin proteína cargada.`;

// ---------- estado del día y cierre ----------
export const estaCerrado = (log, notaAuto = NOTA_AUTO) => !!log && log.note !== notaAuto;

// Qué mostrar. estado: cumplido · incumplido · sin_completar (hay comidas, sin registro) · no_registrado (nada cargado).
export function estadoProteina(log, t) {
  if (log) return { estado: log.status === 'done' ? 'cumplido' : 'incumplido', cerrado: estaCerrado(log) };
  return { estado: t.cantidad > 0 ? 'sin_completar' : 'no_registrado', cerrado: false };
}

// Después de cambiar comidas: ¿hay que escribir o quitar el registro automático?
// Solo el cumplido automático es automático; nunca se marca «incumplido» solo. Un registro de cierre no se toca.
export function decidirSincronizacion({ version, total, log, notaAuto = NOTA_AUTO }) {
  if (!version) return { accion: 'ninguna' };
  if (estaCerrado(log, notaAuto)) return { accion: 'ninguna' };
  if (total != null && total >= Number(version.target_value)) {
    if (log && log.status === 'done' && Number(log.value) === total && log.note === notaAuto) return { accion: 'ninguna' };
    return { accion: 'guardar', status: 'done', value: total, note: notaAuto };
  }
  return log ? { accion: 'quitar' } : { accion: 'ninguna' };
}

// «Cerrar el día»: solo a mano. Sin comidas o sin ninguna proteína cargada no se puede cerrar (faltaría el dato, no la meta).
// Con comidas sin proteína, pide confirmación. Los días futuros no se cierran.
export function decidirCierre({ version, totales, fecha, hoyFecha }) {
  if (!version) return { error: 'El hábito de proteína no estaba vigente ese día.' };
  if (fecha > hoyFecha) return { error: 'No se puede cerrar un día que todavía no llegó.' };
  if (totales.cantidad === 0) return { error: 'No hay comidas cargadas: el día queda «no registrado».' };
  if (totales.total == null) return { error: 'Ninguna comida tiene proteína cargada. Cargala antes de cerrar para no marcar un incumplimiento falso.' };
  const status = evaluar(version, totales.total);
  const a = aviso(totales);
  return {
    error: null, status, value: totales.total, note: NOTA_CIERRE,
    confirmar: a ? `${a} El total (${totales.total} g) solo suma lo cargado. ¿Cerrar el día como ${status === 'done' ? 'cumplido' : 'incumplido'} igual?` : null
  };
}

// ---------- resumen de un período ----------
// Estados vía estados.js; promedio de proteína SOLO sobre días con proteína cargada (un día sin dato no cuenta como 0).
export function resumenProteina(versiones, logs, comidas, desde, hasta) {
  const estados = resumenSerie(versiones, logs, desde, hasta);
  const porDia = totalesPorDia(comidas);
  const propios = logsDeSerie(versiones, logs);
  let conDato = 0, suma = 0, mejor = null, sinCompletar = 0, diasConFaltantes = 0, diasConComidas = 0;
  for (const f of rango(desde, hasta)) {
    const t = porDia.get(f);
    if (!t) continue;
    diasConComidas++;
    if (t.sinProteina > 0) diasConFaltantes++;
    if (!propios.has(f)) sinCompletar++;
    if (t.total != null) {
      conDato++; suma += t.total;
      if (!mejor || t.total > mejor.valor) mejor = { fecha: f, valor: t.total };
    }
  }
  return { estados, diasConComidas, conDato, promedio: conDato ? r1(suma / conDato) : null, mejor, sinCompletar, diasConFaltantes };
}
