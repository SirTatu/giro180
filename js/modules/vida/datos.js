// Vida: acceso a la tabla sleep_sessions (migración 011). Las funciones lanzan error si algo falla.
import { supabase } from '../../supabase.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };
const LIMITE = 1000;                                     // Supabase corta en 1000 filas: preferimos fallar a mostrar datos cortados

// El registro en curso (sin hora de fin), o null. La base garantiza que hay uno solo como máximo.
export const sesionEnCurso = () =>
  supabase.from('sleep_sessions').select('*').is('ended_at', null).limit(1).then(ok).then((filas) => filas[0] ?? null);

// Registros CERRADOS que terminaron entre dos instantes (desde inclusive, hasta exclusivo).
export async function sesionesQueTerminaronEntre(desde, hasta) {
  const filas = await supabase.from('sleep_sessions').select('*').gte('ended_at', desde).lt('ended_at', hasta)
    .order('started_at', { ascending: true }).limit(LIMITE).then(ok);
  if (filas.length >= LIMITE) throw new Error('Hay demasiados registros de sueño en ese período para leerlos de una vez. Elegí un período más corto.');
  return filas;
}

export const crearSesion = (campos) => supabase.from('sleep_sessions').insert(campos).select().single().then(ok);
export const actualizarSesion = (id, campos) => supabase.from('sleep_sessions').update(campos).eq('id', id).select().single().then(ok);

// Cierra un registro SOLO si sigue en curso (si ya se cerró desde otro lado, avisa en lugar de pisar la hora de fin).
export async function cerrarSesion(id, finISO) {
  const filas = await supabase.from('sleep_sessions').update({ ended_at: finISO }).eq('id', id).is('ended_at', null).select().then(ok);
  if (!filas.length) throw new Error('Ese registro ya estaba cerrado o no existe. Actualizá la pantalla.');
  return filas[0];
}

export const borrarSesion = (id) => supabase.from('sleep_sessions').delete().eq('id', id).then(ok);

// Para validar superposiciones al cargar a mano: registros cercanos a un rango (± un día alrededor) y el que está en curso.
export async function sesionesCercanas(desde, hasta) {
  const [cerradas, abierta] = await Promise.all([sesionesQueTerminaronEntre(desde, hasta), sesionEnCurso()]);
  return abierta ? [...cerradas, abierta] : cerradas;
}
