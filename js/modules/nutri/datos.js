// Nutri: acceso a la tabla meals. Las funciones lanzan error si algo falla.
import { supabase } from '../../supabase.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };
const LIMITE = 1000;                                     // Supabase corta en 1000 filas: preferimos fallar a mostrar datos cortados

export const comidasDelDia = (fecha) =>
  supabase.from('meals').select('*').eq('eaten_on', fecha).order('created_at', { ascending: true }).then(ok);

export async function comidasEntre(desde, hasta) {
  const filas = await supabase.from('meals').select('*').gte('eaten_on', desde).lte('eaten_on', hasta)
    .order('eaten_on', { ascending: true }).limit(LIMITE).then(ok);
  if (filas.length >= LIMITE) throw new Error('Hay demasiadas comidas en ese período para leerlas de una vez. Elegí un período más corto.');
  return filas;
}

export const crearComida = (campos) => supabase.from('meals').insert(campos).select().single().then(ok);
export const actualizarComida = (id, campos) => supabase.from('meals').update(campos).eq('id', id).select().single().then(ok);
export const borrarComida = (id) => supabase.from('meals').delete().eq('id', id).then(ok);

// ---------- agua: botellas y tomas (migración 005) ----------
export const listarBotellas = () => supabase.from('water_containers').select('*').order('name', { ascending: true }).then(ok);
export const crearBotella = (campos) => supabase.from('water_containers').insert(campos).select().single().then(ok);
export const actualizarBotella = (id, campos) => supabase.from('water_containers').update(campos).eq('id', id).select().single().then(ok);

export const tomasDelDia = (fecha) =>
  supabase.from('water_intakes').select('*').eq('drunk_on', fecha).order('created_at', { ascending: true }).then(ok);

export async function tomasEntre(desde, hasta) {
  const filas = await supabase.from('water_intakes').select('*').gte('drunk_on', desde).lte('drunk_on', hasta)
    .order('drunk_on', { ascending: true }).limit(LIMITE).then(ok);
  if (filas.length >= LIMITE) throw new Error('Hay demasiadas tomas de agua en ese período para leerlas de una vez. Elegí un período más corto.');
  return filas;
}
export const crearToma = (campos) => supabase.from('water_intakes').insert(campos).select().single().then(ok);
export const borrarToma = (id) => supabase.from('water_intakes').delete().eq('id', id).then(ok);
