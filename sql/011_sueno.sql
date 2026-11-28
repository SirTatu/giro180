-- =====================================================================
-- Giro 180 — 011_sueno.sql  (Etapa 4, hito 4-1a: registros de sueño)
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run.
-- Es seguro volver a ejecutarla (usa "if not exists" y recrea políticas y triggers).
-- ANTES: hacé una exportación de respaldo desde Ajustes → Exportar tus datos.
-- DESPUÉS: ejecutá 012_test_rls_sueno.sql (prueba de seguridad).
-- RESULTADO esperado: "Success. No rows returned".
-- No toca ninguna tabla ni dato existente.
-- =====================================================================

-- ---------- VIDA: registros de sueño ----------
-- Una fila por registro: la noche y cada siesta son filas distintas, así que un día puede tener varias.
-- started_at / ended_at son instantes (timestamptz); la app los muestra en hora de Argentina.
-- ended_at null = registro EN CURSO (te acostaste y todavía no te levantaste). Solo puede haber uno en curso a la vez.
-- Un registro cuenta para el día en que terminó. Un día sin filas es "sin dato" (nunca 0 horas).
create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'night' check (kind in ('night','nap')),
  started_at timestamptz not null,
  ended_at timestamptz,
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_sessions_fin_ck check (ended_at is null or (ended_at > started_at and ended_at - started_at <= interval '24 hours'))
);
-- Un solo registro en curso por usuario (si se toca "Me acuesto" dos veces, la segunda falla en lugar de duplicar).
create unique index if not exists sleep_sessions_abierta_uq on public.sleep_sessions (user_id) where ended_at is null;
create index if not exists sleep_sessions_fin_idx on public.sleep_sessions (user_id, ended_at);

-- ---------- RLS + permisos + updated_at (misma plantilla que 001, 003 y 005) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'sleep_sessions'
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
