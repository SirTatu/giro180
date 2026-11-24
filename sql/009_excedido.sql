-- =====================================================================
-- Giro 180 — 009_excedido.sql  (Etapa 3, ampliación 3-6c1: objetivos con máximo y estado «excedido»)
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run.
-- Es seguro volver a ejecutarla.
-- ANTES: hacé una exportación de respaldo desde Ajustes → Exportar tus datos.
-- DESPUÉS: ejecutá 010_test_rls_excedido.sql (prueba de reglas y seguridad).
-- RESULTADO esperado: "Success. No rows returned".
-- No borra ni cambia ningún dato: agrega una columna vacía (NULL = sin máximo, como hasta ahora) y permite un
-- tercer estado en los registros. Todos los hábitos y registros existentes quedan exactamente igual.
-- =====================================================================

-- ---------- máximo opcional en el objetivo de un hábito ----------
-- «Al menos X»  = target_value X, sin máximo (como hasta ahora).
-- «Como máximo Y» = target_value 0 y target_max Y.
-- «Entre X e Y» = target_value X y target_max Y.
alter table public.habit_definitions add column if not exists target_max numeric;

alter table public.habit_definitions drop constraint if exists habit_definitions_target_max_ck;
alter table public.habit_definitions add constraint habit_definitions_target_max_ck check (
  target_max is null
  or (kind in ('quantity','duration') and target_value is not null and target_max > 0 and target_max >= target_value)
);

-- ---------- nuevo estado «excedido» en los registros ----------
-- Se pasó del máximo del objetivo. No cuenta como no cumplido: queda fuera del porcentaje, pero sí como registrado.
-- Se reemplaza la restricción de status buscándola por su contenido (no por un nombre que pueda variar).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.habit_logs'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%' and pg_get_constraintdef(oid) ilike '%done%'
  loop
    execute format('alter table public.habit_logs drop constraint %I', c.conname);
  end loop;
  alter table public.habit_logs add constraint habit_logs_status_check check (status in ('done','missed','exceeded'));
end $$;
