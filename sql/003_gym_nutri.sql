-- =====================================================================
-- Giro 180 — 003_gym_nutri.sql  (Etapa 3: tablas de Gym y Nutri)
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run.
-- Es seguro volver a ejecutarla (usa "if not exists" y recrea políticas y triggers).
-- ANTES: hacé una exportación de respaldo desde Ajustes → Exportar tus datos.
-- DESPUÉS: ejecutá 004_test_rls_gym_nutri.sql (prueba de seguridad).
-- RESULTADO esperado: "Success. No rows returned".
-- No toca ninguna tabla ni dato existente.
-- =====================================================================

-- ---------- GYM: catálogo de ejercicios ----------
-- Los ejercicios se ARCHIVAN, no se borran: el historial de series los referencia (on delete restrict).
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  muscle_group text check (muscle_group in ('pecho','espalda','hombros','biceps','triceps','piernas','core','otro')),
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists exercises_nombre_uq on public.exercises (user_id, lower(btrim(name)));

-- ---------- GYM: rutinas ----------
-- weekday (1 = lunes ... 7 = domingo) es solo el día sugerido: la app propone esa rutina ese día,
-- pero siempre podés elegir otra. Nunca modifica el hábito bloqueado de gimnasio (martes a sábado).
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  weekday smallint check (weekday between 1 and 7),
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists routines_nombre_uq on public.routines (user_id, lower(btrim(name)));

-- Ejercicios de cada rutina con su objetivo: series x rango de repeticiones (ej. 4 x 6-8).
-- Un mismo ejercicio puede tener objetivos distintos en rutinas distintas.
create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order smallint not null default 1 check (sort_order > 0),
  target_sets smallint not null check (target_sets between 1 and 20),
  reps_min smallint check (reps_min between 1 and 200),
  reps_max smallint check (reps_max between 1 and 200),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reps_min is null or reps_max is null or reps_max >= reps_min)
);
create index if not exists routine_exercises_rutina_idx on public.routine_exercises (routine_id, sort_order);

-- ---------- GYM: entrenamientos realizados ----------
-- routine_name es una foto del nombre al entrenar: si después renombrás o borrás la rutina,
-- el historial no cambia (si se borra, routine_id queda en null).
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  performed_on date not null,
  routine_id uuid references public.routines(id) on delete set null,
  routine_name text,
  duration_min smallint check (duration_min between 1 and 600),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_sessions_fecha_idx on public.workout_sessions (user_id, performed_on);

-- Una fila por serie REALIZADA. Las columnas target_* son la foto del objetivo vigente cuando
-- se registró (igual que el status de los hábitos): cambiar la rutina después no altera el historial.
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_no smallint not null check (set_no > 0),
  reps smallint not null check (reps between 0 and 500),
  weight_kg numeric(6,2) check (weight_kg >= 0),
  target_sets smallint,
  target_reps_min smallint,
  target_reps_max smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, exercise_id, set_no)
);
create index if not exists workout_sets_ejercicio_idx on public.workout_sets (exercise_id, session_id);

-- ---------- NUTRI: comidas ----------
-- protein_g NULL = proteína NO cargada (dato faltante). Nunca equivale a 0 g:
-- el total del día suma solo lo cargado y la app avisa cuántas comidas quedaron sin proteína.
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eaten_on date not null,
  meal_type text not null check (meal_type in ('desayuno','almuerzo','merienda','cena','colacion','otro')),
  description text not null check (length(btrim(description)) > 0),
  protein_g numeric(6,1) check (protein_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meals_fecha_idx on public.meals (user_id, eaten_on);

-- ---------- RLS + permisos + updated_at (misma plantilla que 001) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'exercises','routines','routine_exercises','workout_sessions','workout_sets','meals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists own_select on public.%I', t);
    execute format('drop policy if exists own_insert on public.%I', t);
    execute format('drop policy if exists own_update on public.%I', t);
    execute format('drop policy if exists own_delete on public.%I', t);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('drop trigger if exists trg_updated_at on public.%I', t);
    execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- Guardar un entrenamiento completo de forma ATÓMICA ----------
-- Un entrenamiento tiene decenas de series: guardarlo en varios pasos podría dejarlo a medias si se corta
-- la conexión. Esta función hace todo en una sola transacción (o se guarda todo, o no se guarda nada).
--   p_session_id  null = entrenamiento nuevo; con id = reemplaza las series de ese entrenamiento.
--   p_sets        arreglo JSON: [{"exercise_id":"...","set_no":1,"reps":8,"weight_kg":80,
--                                 "target_sets":4,"target_reps_min":6,"target_reps_max":8}, ...]
--   p_habit_id    opcional: id del hábito "Entrenar" vigente ese día. Si viene, ese día queda
--                 marcado como cumplido en habit_logs (en la misma transacción).
-- Corre con los permisos de quien llama (security invoker): la RLS sigue protegiendo todo.
create or replace function public.guardar_entrenamiento(
  p_session_id uuid,
  p_performed_on date,
  p_routine_id uuid,
  p_routine_name text,
  p_duration_min smallint,
  p_notes text,
  p_sets jsonb,
  p_habit_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_performed_on is null then
    raise exception 'Falta la fecha del entrenamiento.';
  end if;
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then
    raise exception 'El entrenamiento no tiene series.';
  end if;

  if p_session_id is null then
    insert into public.workout_sessions (performed_on, routine_id, routine_name, duration_min, notes)
    values (p_performed_on, p_routine_id, nullif(btrim(p_routine_name), ''), p_duration_min, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    update public.workout_sessions
       set performed_on = p_performed_on,
           routine_id = p_routine_id,
           routine_name = nullif(btrim(p_routine_name), ''),
           duration_min = p_duration_min,
           notes = nullif(btrim(p_notes), '')
     where id = p_session_id
    returning id into v_id;
    if v_id is null then
      raise exception 'No se encontró ese entrenamiento.';
    end if;
    delete from public.workout_sets where session_id = v_id;
  end if;

  insert into public.workout_sets
    (session_id, exercise_id, set_no, reps, weight_kg, target_sets, target_reps_min, target_reps_max)
  select v_id,
         (s ->> 'exercise_id')::uuid,
         (s ->> 'set_no')::smallint,
         (s ->> 'reps')::smallint,
         nullif(s ->> 'weight_kg', '')::numeric,
         nullif(s ->> 'target_sets', '')::smallint,
         nullif(s ->> 'target_reps_min', '')::smallint,
         nullif(s ->> 'target_reps_max', '')::smallint
    from jsonb_array_elements(p_sets) as s;

  if p_habit_id is not null then
    insert into public.habit_logs (habit_id, log_date, status)
    values (p_habit_id, p_performed_on, 'done')
    on conflict (habit_id, log_date) do update set status = 'done';
  end if;

  return v_id;
end $$;

revoke all on function public.guardar_entrenamiento(uuid, date, uuid, text, smallint, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.guardar_entrenamiento(uuid, date, uuid, text, smallint, text, jsonb, uuid) to authenticated;
