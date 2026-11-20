// Acceso a la base de datos para Gym (ejercicios y rutinas). Todas las funciones lanzan error si Supabase falla.
import { supabase } from '../../supabase.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };

// ---- Ejercicios (se archivan, no se borran) ----
export const listarEjercicios = () => supabase.from('exercises').select('*').order('name').then(ok);
export const crearEjercicio = (campos) => supabase.from('exercises').insert(campos).select().single().then(ok);
export const crearEjercicios = (lista) =>
  lista.length ? supabase.from('exercises').insert(lista).select().then(ok) : Promise.resolve([]);
export const actualizarEjercicio = (id, campos) =>
  supabase.from('exercises').update(campos).eq('id', id).select().single().then(ok);
export const desarchivarEjercicios = (ids) =>
  ids.length ? supabase.from('exercises').update({ archived: false }).in('id', ids).then(ok) : Promise.resolve();

// ---- Rutinas (se archivan, no se borran) ----
export const listarRutinas = () => supabase.from('routines').select('*').order('name').then(ok);
export const crearRutina = (campos) => supabase.from('routines').insert(campos).select().single().then(ok);
export const actualizarRutina = (id, campos) =>
  supabase.from('routines').update(campos).eq('id', id).select().single().then(ok);

// ---- Ejercicios dentro de una rutina ----
export const listarItems = () =>
  supabase.from('routine_exercises').select('*').order('routine_id').order('sort_order').then(ok);
export const crearItem = (campos) => supabase.from('routine_exercises').insert(campos).select().single().then(ok);
export const actualizarItem = (id, campos) =>
  supabase.from('routine_exercises').update(campos).eq('id', id).select().single().then(ok);
export const quitarItem = (id) => supabase.from('routine_exercises').delete().eq('id', id).then(ok);

// Borra una rutina recién creada (solo para deshacer una importación que falló a medias).
const deshacerRutina = (id) => supabase.from('routines').delete().eq('id', id).then(ok);

// Guarda lo que devuelve resolverImportacion (js/core/gym.js). No es atómico entre rutinas:
// si una rutina falla, se deshace esa rutina y se informa cuáles ya se habían guardado.
export async function importar(resuelto) {
  const guardadas = [];
  try {
    await desarchivarEjercicios(resuelto.desarchivar);
    const creados = await crearEjercicios(resuelto.ejerciciosNuevos.map((e) => ({ name: e.nombre })));
    const idPorClave = new Map();
    resuelto.ejerciciosNuevos.forEach((e) => {
      const fila = creados.find((c) => c.name === e.nombre);
      if (fila) idPorClave.set(e.clave, fila.id);
    });
    for (const r of resuelto.rutinas) {
      const rutina = await crearRutina({ name: r.nombre, weekday: r.weekday });
      try {
        await supabase.from('routine_exercises').insert(r.items.map((it) => ({
          routine_id: rutina.id,
          exercise_id: it.id ?? idPorClave.get(it.clave),
          sort_order: it.sort_order, target_sets: it.target_sets,
          reps_min: it.reps_min, reps_max: it.reps_max, notes: it.notes
        }))).then(ok);
      } catch (e) {
        await deshacerRutina(rutina.id).catch(() => {});
        throw e;
      }
      guardadas.push(r.nombre);
    }
  } catch (e) {
    e.guardadas = guardadas;
    throw e;
  }
  return { rutinas: guardadas.length, ejercicios: resuelto.ejerciciosNuevos.length };
}
