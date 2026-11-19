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

// ---- Prioridades (máximo 3 activas: lo controla un trigger en la base) ----
export const listarPrioridades = () =>
  supabase.from('priorities').select('*')
    .order('started_on', { ascending: false }).order('created_at', { ascending: false }).then(ok);

export const crearPrioridad = (campos) =>
  supabase.from('priorities').insert(campos).select().single().then(ok);

export const cerrarPrioridad = (id, ended_on) =>
  supabase.from('priorities').update({ ended_on }).eq('id', id).select().single().then(ok);

// ---- Objetivos ----
export const listarObjetivos = () => supabase.from('goals').select('*').order('created_at').then(ok);

export const crearObjetivo = (campos) =>
  supabase.from('goals').insert(campos).select().single().then(ok);

export const actualizarObjetivo = (id, campos) =>
  supabase.from('goals').update(campos).eq('id', id).select().single().then(ok);

// ---- Historial de decisiones (solo se agrega) ----
export const listarDecisiones = (limite = 30) =>
  supabase.from('decision_log').select('*')
    .order('decided_on', { ascending: false }).order('created_at', { ascending: false })
    .limit(limite).then(ok);

export const registrarDecision = (campos) => supabase.from('decision_log').insert(campos).then(ok);

// ---- Compromisos / turnos ----
export const listarCompromisos = () => supabase.from('appointments').select('*').order('starts_at').then(ok);

export const proximosCompromisos = (n = 5) =>
  supabase.from('appointments').select('*').eq('status', 'pending')
    .gte('starts_at', new Date().toISOString()).order('starts_at').limit(n).then(ok);

export const crearCompromiso = (campos) =>
  supabase.from('appointments').insert(campos).select().single().then(ok);

export const actualizarCompromiso = (id, campos) =>
  supabase.from('appointments').update(campos).eq('id', id).select().single().then(ok);

export const eliminarCompromiso = (id) => supabase.from('appointments').delete().eq('id', id).then(ok);

// ---- Revisión semanal ----
export const entradasEntre = (desde, hasta) =>
  supabase.from('daily_entries').select('*').gte('entry_date', desde).lte('entry_date', hasta).then(ok);

export const leerRevision = (weekStart) =>
  supabase.from('weekly_reviews').select('*').eq('week_start', weekStart).maybeSingle().then(ok);

export const guardarRevision = (campos) =>
  supabase.from('weekly_reviews').upsert(campos, { onConflict: 'user_id,week_start' }).select().single().then(ok);

// ---- Informes guardados ----
export const listarInformes = (limite = 20) =>
  supabase.from('saved_reports').select('*').order('created_at', { ascending: false }).limit(limite).then(ok);

export const guardarInforme = (campos) =>
  supabase.from('saved_reports').insert(campos).select().single().then(ok);

export const eliminarInforme = (id) => supabase.from('saved_reports').delete().eq('id', id).then(ok);
