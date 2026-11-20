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

// ---- Entrenamientos (hito 3-2) ----
export const listarHabitosDefiniciones = () =>
  supabase.from('habit_definitions').select('*').order('name').order('valid_from').then(ok);

// Sesiones desde una fecha (más nuevas primero) o todas las de un día.
export const listarSesiones = (desde) =>
  supabase.from('workout_sessions').select('*').gte('performed_on', desde).order('performed_on', { ascending: false }).then(ok);
export const sesionesDelDia = (fecha) =>
  supabase.from('workout_sessions').select('*').eq('performed_on', fecha).order('created_at', { ascending: false }).then(ok);
// Las últimas n sesiones ANTERIORES a una fecha (para «la última vez»).
export const sesionesAnteriores = (antesDe, n = 20) =>
  supabase.from('workout_sessions').select('*').lt('performed_on', antesDe).order('performed_on', { ascending: false }).limit(n).then(ok);

// Series de varias sesiones, en tandas chicas para no pasar el límite de 1000 filas por consulta
// ni el largo de la dirección. Si una tanda llega al límite, falla en vez de entregar datos cortados.
export async function setsDe(sessionIds, tanda = 25) {
  const todas = [];
  for (let i = 0; i < sessionIds.length; i += tanda) {
    const filas = await supabase.from('workout_sets').select('*').in('session_id', sessionIds.slice(i, i + tanda)).then(ok);
    if (filas.length >= 1000) throw new Error('Demasiadas series en una consulta: se cancela para no mostrar datos incompletos.');
    todas.push(...filas);
  }
  return todas;
}

// Guarda o reemplaza un entrenamiento completo en UNA transacción (función guardar_entrenamiento) y, si viene
// habitId, marca ese día como cumplido en el mismo paso.
export const guardarEntrenamiento = ({ sessionId = null, fecha, routineId = null, routineName = null, duracion = null, notas = null, sets, habitId = null }) =>
  supabase.rpc('guardar_entrenamiento', {
    p_session_id: sessionId, p_performed_on: fecha, p_routine_id: routineId, p_routine_name: routineName,
    p_duration_min: duracion, p_notes: notas, p_sets: sets, p_habit_id: habitId
  }).then(ok);

// Borra un entrenamiento y sus series. NO desmarca el hábito «Entrenar» (decisión tomada).
export const borrarSesion = (id) => supabase.from('workout_sessions').delete().eq('id', id).then(ok);

// ---- Pasos: son un hábito de cantidad; el registro vive en habit_logs (igual que en Central → Hoy) ----
export const logsEntre = (desde, hasta) =>
  supabase.from('habit_logs').select('*').gte('log_date', desde).lte('log_date', hasta).then(ok);
// status se calcula contra la meta de la versión vigente ESE día (así un cambio futuro de meta no altera el pasado).
export const guardarLogPasos = ({ habit_id, log_date, status, value }) =>
  supabase.from('habit_logs').upsert({ habit_id, log_date, status, value }, { onConflict: 'habit_id,log_date' }).select().single().then(ok);
export const borrarLogPasos = (id) => supabase.from('habit_logs').delete().eq('id', id).then(ok);
