// Acceso a hábitos y sus registros desde módulos que no son Central (Nutri). Mismas tablas que usa Gym en pasos.
import { supabase } from '../../supabase.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };

export const listarDefiniciones = () =>
  supabase.from('habit_definitions').select('*').order('name').order('valid_from').then(ok);
export const logsEntre = (desde, hasta) =>
  supabase.from('habit_logs').select('*').gte('log_date', desde).lte('log_date', hasta).then(ok);
// status se calcula contra la meta de la versión vigente ESE día. note marca si es automático o cierre manual.
export const guardarLog = ({ habit_id, log_date, status, value, note }) =>
  supabase.from('habit_logs').upsert({ habit_id, log_date, status, value, note }, { onConflict: 'habit_id,log_date' }).select().single().then(ok);
export const borrarLog = (id) => supabase.from('habit_logs').delete().eq('id', id).then(ok);
