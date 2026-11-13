// Acceso a la base de datos para Central. Todas las funciones lanzan error si Supabase falla.
import { supabase } from '../../supabase.js';
import { sumarDias } from '../../core/fechas.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };

// ---- Hábitos (versiones) ----
export const listarHabitos = () =>
  supabase.from('habit_definitions').select('*').order('name').order('valid_from').then(ok);

export const crearHabito = (campos) =>
  supabase.from('habit_definitions').insert(campos).select().single().then(ok);

export const corregirHabito = (id, campos) =>      // solo si la versión no tiene registros
  supabase.from('habit_definitions').update(campos).eq('id', id).select().single().then(ok);

export const cerrarHabito = (id, valid_to) =>
  supabase.from('habit_definitions').update({ valid_to }).eq('id', id).select().single().then(ok);

export async function contarLogs(habitId) {
  const { count, error } = await supabase.from('habit_logs')
    .select('id', { count: 'exact', head: true }).eq('habit_id', habitId);
  if (error) throw error;
  return count ?? 0;
}

export async function eliminarHabito(id) {
  const { error } = await supabase.from('habit_definitions').delete().eq('id', id);
  if (error?.code === '23503') throw new Error('Tiene registros: no se puede eliminar. Archivala en su lugar.');
  if (error) throw error;
}

// Cambio con historial: cierra la versión vieja el día anterior y crea la nueva.
export async function nuevaVersion(anterior, cambios, desde) {
  await cerrarHabito(anterior.id, sumarDias(desde, -1));
  try {
    return await crearHabito({
      series_id: anterior.series_id, module: anterior.module, locked: false,
      ...cambios, valid_from: desde
    });
  } catch (e) {
    await cerrarHabito(anterior.id, anterior.valid_to).catch(() => {});   // deshace el cierre
    throw e;
  }
}

// ---- Registros diarios de hábitos ----
export const logsEntre = (desde, hasta) =>
  supabase.from('habit_logs').select('*').gte('log_date', desde).lte('log_date', hasta).then(ok);

export const guardarLog = ({ habit_id, log_date, status, value }) =>
  supabase.from('habit_logs')
    .upsert({ habit_id, log_date, status, value: value ?? null }, { onConflict: 'habit_id,log_date' })
    .select().single().then(ok);

export const borrarLog = (id) => supabase.from('habit_logs').delete().eq('id', id).then(ok);

// ---- Registro del día (ánimo, energía, notas) ----
export const leerEntrada = (fecha) =>
  supabase.from('daily_entries').select('*').eq('entry_date', fecha).maybeSingle().then(ok);

export const guardarEntrada = (campos) =>
  supabase.from('daily_entries').upsert(campos, { onConflict: 'user_id,entry_date' }).select().single().then(ok);

// ---- Ajustes ----
export async function leerAjustes() {
  const data = await supabase.from('user_settings').select('settings').maybeSingle().then(ok);
  return data?.settings ?? {};
}

export const guardarAjustes = (userId, settings) =>
  supabase.from('user_settings').upsert({ user_id: userId, settings }, { onConflict: 'user_id' }).then(ok);
