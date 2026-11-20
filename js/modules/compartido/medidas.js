// Peso y cintura: UNA sola fuente (tabla body_measurements) para Gym y Nutri. Una fila por día.
import { supabase } from '../../supabase.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };

export const medidasDesde = (desde) =>
  supabase.from('body_measurements').select('*').gte('measured_on', desde).order('measured_on', { ascending: true }).then(ok);
export const medidaDelDia = (fecha) =>
  supabase.from('body_measurements').select('*').eq('measured_on', fecha).maybeSingle().then(ok);

// Crea la medición del día o, si ya existe (id), la actualiza. Peso y cintura pueden ser null (uno solo alcanza).
export function guardarMedida({ id = null, fecha, peso, cintura, notas }) {
  const campos = { weight_kg: peso, waist_cm: cintura, notes: notas };
  return id
    ? supabase.from('body_measurements').update(campos).eq('id', id).select().single().then(ok)
    : supabase.from('body_measurements').insert({ measured_on: fecha, ...campos }).select().single().then(ok);
}
export const borrarMedida = (id) => supabase.from('body_measurements').delete().eq('id', id).then(ok);
