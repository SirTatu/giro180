-- =====================================================================
-- Giro 180 — 005_agua.sql  (Etapa 3, hito 3-4b: botellas y tomas de agua)
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run.
-- Es seguro volver a ejecutarla (usa "if not exists" y recrea políticas y triggers).
-- ANTES: hacé una exportación de respaldo desde Ajustes → Exportar tus datos.
-- DESPUÉS: ejecutá 006_test_rls_agua.sql (prueba de seguridad).
-- RESULTADO esperado: "Success. No rows returned".
-- No toca ninguna tabla ni dato existente.
-- =====================================================================

-- ---------- NUTRI: botellas / recipientes ----------
-- Cada recipiente (botella de la oficina, jarra, termo, vaso...) con su volumen en ml.
-- Se ARCHIVAN, no se borran (así se pueden recuperar). El nombre no se repite (sin importar mayúsculas).
create table if not exists public.water_containers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0 and length(name) <= 60),
  volume_ml integer not null check (volume_ml between 1 and 20000),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists water_containers_nombre_uq on public.water_containers (user_id, lower(btrim(name)));

-- ---------- NUTRI: tomas de agua ----------
-- Una fila por toma. El total del día es la suma; sin filas = no registrado (nunca 0).
-- container_name es una FOTO del nombre: borrar o renombrar una botella no altera el historial.
-- La meta de agua sigue siendo un hábito de cantidad (Central → Hábitos); acá solo se guardan las tomas.
create table if not exists public.water_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  drunk_on date not null,
  ml integer not null check (ml between 1 and 10000),
  container_id uuid references public.water_containers(id) on delete set null,
  container_name text check (container_name is null or length(container_name) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists water_intakes_fecha_idx on public.water_intakes (user_id, drunk_on);

-- ---------- RLS + permisos + updated_at (misma plantilla que 001 y 003) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'water_containers','water_intakes'
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
