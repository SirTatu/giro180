-- =====================================================================
-- Giro 180 — 001_core.sql  (núcleo: Etapas 1 y 2)
-- Ejecutar en Supabase → SQL Editor. Se puede volver a ejecutar sin romper nada.
-- Convenciones:
--   * Fechas de registro = tipo date (día local). Horarios exactos = timestamptz.
--   * Todas las tablas tienen RLS: cada usuario solo ve/toca sus filas.
--   * "No registrado" = NO existe fila en habit_logs. Nunca se guarda un "faltante".
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- Configuración del usuario (umbrales editables) ----------
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Hábitos / metas medibles, con versiones ----------
-- series_id identifica "el mismo hábito" a lo largo de sus versiones.
-- Cambiar una meta = cerrar la versión vieja (valid_to) y crear otra. Nunca editar el pasado.
-- scheduled_days: ISO, 1 = lunes ... 7 = domingo.
create table if not exists public.habit_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  series_id uuid not null default gen_random_uuid(),
  module text not null check (module in ('central','gym','nutri','vida','estudio','derma')),
  name text not null,
  kind text not null check (kind in ('boolean','quantity','duration')),
  target_value numeric,
  unit text,
  scheduled_days smallint[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(scheduled_days) > 0 and scheduled_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  valid_from date not null,
  valid_to date,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

-- Registro: solo existe fila si el día se evaluó. status se guarda al registrar
-- (contra la meta vigente ese día), por eso cambios futuros no alteran el historial.
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habit_definitions(id) on delete restrict,
  log_date date not null,
  status text not null check (status in ('done','missed')),
  value numeric,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index if not exists habit_logs_fecha_idx on public.habit_logs (log_date);

-- ---------- Objetivos ----------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_goal_id uuid references public.goals(id) on delete set null,
  scope text not null check (scope in ('general','specific')),
  module text check (module in ('central','gym','nutri','vida','estudio','derma')),
  title text not null,
  description text,
  target_date date,
  status text not null default 'active' check (status in ('active','achieved','dropped')),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Prioridades (máximo 3 activas) ----------
create table if not exists public.priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  started_on date not null,
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

-- ---------- Registro diario, revisiones, informes, compromisos, medidas ----------
create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,                 -- lunes de esa semana
  summary text,
  indicators jsonb not null default '{}'::jsonb,
  decisions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_type text not null,
  period_start date,
  period_end date,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module text check (module in ('central','gym','nutri','vida','estudio','derma')),
  title text not null,
  starts_at timestamptz not null,
  location text,
  notes text,
  status text not null default 'pending' check (status in ('pending','done','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_fecha_idx on public.appointments (starts_at);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5,2),
  waist_cm numeric(5,1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- ---------- Historial de decisiones (solo agregar, nunca editar ni borrar) ----------
create table if not exists public.decision_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  decided_on date not null,
  area text,
  decision text not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- Triggers de reglas de negocio ----------
-- Máximo 3 prioridades activas (ended_on null).
create or replace function public.limit_active_priorities()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.ended_on is null and (
    select count(*) from public.priorities
    where user_id = new.user_id and ended_on is null and id <> new.id
  ) >= 3 then
    raise exception 'Ya hay 3 prioridades activas. Cerrá una antes de agregar otra.';
  end if;
  return new;
end $$;
drop trigger if exists trg_limit_priorities on public.priorities;
create trigger trg_limit_priorities before insert or update on public.priorities
  for each row execute function public.limit_active_priorities();

-- Hábitos bloqueados (ej. gimnasio martes a sábado): no se editan ni borran
-- salvo desbloqueo explícito (ver DATABASE.md).
create or replace function public.protect_locked_habit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.locked and coalesce(current_setting('giro180.allow_locked_change', true), 'off') <> 'on' then
    raise exception 'Hábito bloqueado (%): requiere desbloqueo explícito y registro en decision_log.', old.name;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists trg_protect_locked on public.habit_definitions;
create trigger trg_protect_locked before update or delete on public.habit_definitions
  for each row execute function public.protect_locked_habit();

-- ---------- RLS + permisos (plantilla única) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','habit_definitions','habit_logs','goals','priorities',
    'daily_entries','weekly_reviews','saved_reports','appointments','body_measurements'
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

-- decision_log: solo lectura e inserción
alter table public.decision_log enable row level security;
revoke all on public.decision_log from anon, authenticated;
grant select, insert on public.decision_log to authenticated;
drop policy if exists own_select on public.decision_log;
drop policy if exists own_insert on public.decision_log;
create policy own_select on public.decision_log for select to authenticated using (user_id = (select auth.uid()));
create policy own_insert on public.decision_log for insert to authenticated with check (user_id = (select auth.uid()));
