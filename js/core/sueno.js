// Lógica pura del SUEÑO (hito 4-1a): registros de noche y siesta con hora de inicio y de fin. Sin pantalla ni base de datos.
// Pruebas en tests/sueno.test.mjs. Cada registro es una fila de sleep_sessions: tipo (night / nap), started_at, ended_at
// (null = en curso) y nota. Puede haber VARIOS por día (noche + siestas), pero solo uno en curso a la vez.
// Reglas que respeta:
// - Todas las horas se muestran y se escriben en hora de Argentina (UTC-3 todo el año, sin horario de verano desde 2009);
//   en la base se guardan como instantes (timestamptz). Las cuentas son aritmética pura: se ven igual en cualquier navegador.
// - Un registro cuenta para el día en que TERMINÓ (la noche de ayer a hoy cuenta para hoy). Un registro en curso todavía no
//   cuenta para ningún día.
// - Un día sin registros es «sin dato» (null), nunca 0 horas.
// - Las funciones reciben «ahora» como texto ISO (por ejemplo new Date().toISOString()) para poder probarlas con horas fijas.
import { sumarDias } from './fechas.js';

const TIPOS = ['night', 'nap'];
export const ETIQUETA_TIPO = { night: 'Noche', nap: 'Siesta' };
export const ACCION_INICIO = { night: 'Me acuesto', nap: 'Empiezo una siesta' };
export const ACCION_FIN = { night: 'Me levanté', nap: 'Terminé la siesta' };
export const MAX_HORAS = 24;                             // coincide con el check de la tabla (011_sueno.sql)
export const MAX_NOTA = 500;

const OFFSET_MS = 3 * 3600000;                           // Argentina = UTC-3
const MINUTO = 60000;
const TOLERANCIA_FUTURO = MINUTO;                        // el reloj del celular y los minutos enteros del formulario no coinciden al segundo

const aMs = (iso) => {
  if (iso == null || iso === '') return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
};

// ---------- horas ----------
// Instante (ISO) -> «AAAA-MM-DDTHH:MM» en hora de Argentina (el formato de <input type="datetime-local">). null si no es válido.
export function instanteALocal(iso) {
  const ms = aMs(iso);
  return ms === null ? null : new Date(ms - OFFSET_MS).toISOString().slice(0, 16);
}

// «AAAA-MM-DDTHH:MM» en hora de Argentina -> instante ISO (UTC). null si está vacío, mal escrito o es un día que no existe (30/2).
export function localAInstante(texto) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(String(texto ?? '').trim());
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}:00Z`);
  if (Number.isNaN(ms)) return null;
  const iso = new Date(ms + OFFSET_MS).toISOString();
  return instanteALocal(iso) === `${m[1]}T${m[2]}` ? iso : null;     // ida y vuelta: rechaza 2026-02-30 y horas 25:00
}

// «HH:MM:SS» en hora de Argentina (para mostrar con qué precisión se capturó una hora).
export function horaSegundos(iso) {
  const ms = aMs(iso);
  return ms === null ? null : new Date(ms - OFFSET_MS).toISOString().slice(11, 19);
}

export const fechaDeInstante = (iso) => instanteALocal(iso)?.slice(0, 10) ?? null;     // «AAAA-MM-DD»
export const horaTexto = (iso) => instanteALocal(iso)?.slice(11, 16) ?? null;          // «HH:MM»

// «18/11 23:40» (día y hora de Argentina), para mensajes.
export function etiquetaInstante(iso) {
  const l = instanteALocal(iso);
  return l ? `${Number(l.slice(8, 10))}/${Number(l.slice(5, 7))} ${l.slice(11, 16)}` : '';
}

// Instantes de inicio y fin (exclusivo) de un día de Argentina, para pedirle a la base «lo que terminó ese día».
export const limitesDelDia = (fecha) => ({ desde: localAInstante(`${fecha}T00:00`), hasta: localAInstante(`${sumarDias(fecha, 1)}T00:00`) });

// ---------- duraciones ----------
export function minutosEntre(inicio, fin) {
  const a = aMs(inicio), b = aMs(fin);
  return a === null || b === null ? null : Math.round((b - a) / MINUTO);
}

// 450 -> «7 h 30 min» · 480 -> «8 h» · 45 -> «45 min» · null -> «sin dato»
export function formatoDuracion(min) {
  if (min == null || Number.isNaN(min)) return 'sin dato';
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Duración de un registro: cerrado = fin - inicio; en curso = hasta «ahora» (si se pasa); si no, null.
export const duracionMin = (s, ahora = null) => (s?.ended_at ? minutosEntre(s.started_at, s.ended_at) : ahora ? minutosEntre(s?.started_at, ahora) : null);

export const sesionAbierta = (sesiones) => (sesiones ?? []).find((s) => !s.ended_at) ?? null;

// ---------- validación ----------
// Datos del formulario manual -> campos listos para guardar. Reglas: tipo válido, inicio y fin válidos (el fin puede faltar solo
// al corregir un registro que sigue en curso), nada en el futuro, fin posterior al inicio, máximo 24 h, nota de hasta 500
// caracteres y sin superponerse con otro registro (otras = los demás registros; el que se edita se pasa en idActual).
export function validarSesion({ tipo, inicio, fin, nota }, { ahora, otras = [], permitirAbierta = false, idActual = null } = {}) {
  if (!TIPOS.includes(tipo)) return { error: 'Elegí si es noche o siesta.', datos: null };
  const ini = localAInstante(inicio);
  if (!ini) return { error: String(inicio ?? '').trim() ? 'La hora de inicio no es válida.' : 'Completá la hora de inicio.', datos: null };
  const hay = String(fin ?? '').trim() !== '';
  const fn = hay ? localAInstante(fin) : null;
  if (hay && !fn) return { error: 'La hora de fin no es válida.', datos: null };
  if (!hay && !permitirAbierta) return { error: 'Completá la hora de fin.', datos: null };
  if (aMs(ahora) === null) return { error: 'No pude leer la hora del dispositivo.', datos: null };
  const tope = aMs(ahora) + TOLERANCIA_FUTURO;
  if (aMs(ini) > tope) return { error: 'La hora de inicio no puede estar en el futuro.', datos: null };
  if (fn && aMs(fn) > tope) return { error: 'La hora de fin no puede estar en el futuro.', datos: null };
  if (fn && aMs(fn) <= aMs(ini)) return { error: 'La hora de fin tiene que ser posterior a la de inicio.', datos: null };
  if (fn && aMs(fn) - aMs(ini) > MAX_HORAS * 3600000) return { error: `Un registro no puede durar más de ${MAX_HORAS} horas.`, datos: null };
  const textoNota = String(nota ?? '').trim();
  if (textoNota.length > MAX_NOTA) return { error: `La nota no puede pasar de ${MAX_NOTA} caracteres.`, datos: null };
  const hastaEfectivo = fn ?? ahora;                                   // un registro en curso se considera hasta ahora
  for (const o of otras) {
    if (idActual && o.id === idActual) continue;
    const oFin = o.ended_at ?? ahora;
    if (aMs(ini) < aMs(oFin) && aMs(o.started_at) < aMs(hastaEfectivo)) {
      return { error: `Se superpone con otro registro de sueño (${ETIQUETA_TIPO[o.kind] ?? 'sueño'} de ${etiquetaInstante(o.started_at)}${o.ended_at ? ` a ${etiquetaInstante(o.ended_at)}` : ', en curso'}).`, datos: null };
    }
  }
  return { error: null, datos: { kind: tipo, started_at: ini, ended_at: fn, note: textoNota || null } };
}

// Valores iniciales del formulario para corregir un registro.
export const formularioDeSesion = (s) => ({
  tipo: s.kind, inicio: instanteALocal(s.started_at) ?? '', fin: s.ended_at ? (instanteALocal(s.ended_at) ?? '') : '', nota: s.note ?? ''
});

// ---------- botones «Me acuesto» / «Me levanté» ----------
// Empezar: toma la hora de «ahora». No deja empezar si ya hay uno en curso.
export function decidirInicio({ tipo, ahora, sesiones }) {
  if (!TIPOS.includes(tipo)) return { error: 'Elegí si es noche o siesta.', datos: null };
  if (aMs(ahora) === null) return { error: 'No pude leer la hora del dispositivo.', datos: null };
  const abierta = sesionAbierta(sesiones);
  if (abierta) return { error: `Ya hay un registro en curso desde ${etiquetaInstante(abierta.started_at)}. Terminalo antes de empezar otro.`, datos: null };
  return { error: null, datos: { kind: tipo, started_at: new Date(aMs(ahora)).toISOString() } };
}

// Terminar: toma la hora de «ahora». Falla si no hay nada en curso, si el reloj quedó antes del inicio o si pasaron más de 24 h
// (en ese caso se corrige a mano con la hora real: la base no acepta registros de más de 24 h).
export function decidirFin({ sesion, ahora }) {
  if (!sesion || sesion.ended_at) return { error: 'No hay un registro en curso.', datos: null, minutos: null };
  if (aMs(ahora) === null) return { error: 'No pude leer la hora del dispositivo.', datos: null, minutos: null };
  if (aMs(ahora) <= aMs(sesion.started_at)) return { error: 'La hora actual es anterior al inicio del registro: corregí la hora de inicio.', datos: null, minutos: null };
  if (aMs(ahora) - aMs(sesion.started_at) > MAX_HORAS * 3600000) {
    return { error: `Pasaron más de ${MAX_HORAS} horas desde que empezó (${etiquetaInstante(sesion.started_at)}). Usá «Corregir» para poner la hora de fin real.`, datos: null, minutos: null };
  }
  const fin = new Date(aMs(ahora)).toISOString();
  return { error: null, datos: { ended_at: fin }, minutos: minutosEntre(sesion.started_at, fin) };
}

// ---------- resumen por día ----------
// Registros CERRADOS que terminaron ese día. Sin registros todo es null (sin dato), nunca 0. Ordenados por hora de inicio.
export function resumenDia(sesiones, fecha) {
  const delDia = (sesiones ?? []).filter((s) => s.ended_at && fechaDeInstante(s.ended_at) === fecha)
    .sort((a, b) => aMs(a.started_at) - aMs(b.started_at));
  const suma = (tipo) => {
    const l = delDia.filter((s) => s.kind === tipo);
    return l.length ? l.reduce((t, s) => t + minutosEntre(s.started_at, s.ended_at), 0) : null;
  };
  const noche = suma('night'), siesta = suma('nap');
  return { fecha, cantidad: delDia.length, noche_min: noche, siesta_min: siesta,
    total_min: noche === null && siesta === null ? null : (noche ?? 0) + (siesta ?? 0), sesiones: delDia };
}
