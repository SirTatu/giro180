-- =====================================================================
-- Giro 180 — 007_alimentos.sql  (Etapa 3, ampliación 3-6a: base de alimentos y macros)
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run.
-- Es seguro volver a ejecutarla (usa "if not exists" y recrea políticas y triggers).
-- ANTES: hacé una exportación de respaldo desde Ajustes → Exportar tus datos.
-- DESPUÉS: ejecutá 008_test_rls_alimentos.sql (prueba de seguridad).
-- RESULTADO esperado: "Success. No rows returned".
-- No borra ni cambia ningún dato existente: solo crea 2 tablas y AGREGA columnas vacías (NULL = «sin dato») a meals.
-- =====================================================================

-- ---------- NUTRI: alimentos ----------
-- Valores nutricionales POR 100 g (o por 100 ml, según base_unit), como figuran en la etiqueta.
-- Se ARCHIVAN, no se borran. El nombre no se repite (sin importar mayúsculas).
-- Las 4 macros son obligatorias en un alimento (si es cero se escribe 0); en las comidas siguen pudiendo faltar.
-- Carbos + proteínas + grasas no pueden pasar de 100 g por 100 g (con una tolerancia de 0,5 por redondeos).
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0 and length(name) <= 80),
  base_unit text not null default 'g' check (base_unit in ('g','ml')),
  kcal_100 numeric(6,1) not null check (kcal_100 >= 0 and kcal_100 <= 1000),
  carbs_100 numeric(5,1) not null check (carbs_100 >= 0 and carbs_100 <= 100),
  protein_100 numeric(5,1) not null check (protein_100 >= 0 and protein_100 <= 100),
  fat_100 numeric(5,1) not null check (fat_100 >= 0 and fat_100 <= 100),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_macros_suma_ck check (carbs_100 + protein_100 + fat_100 <= 100.5)
);
create unique index if not exists foods_nombre_uq on public.foods (user_id, lower(btrim(name)));

-- ---------- NUTRI: porciones de un alimento ----------
-- Ejemplos: «1 huevo» = 50 g, «1 vaso» = 200 ml. Las comidas guardan una FOTO de lo calculado, así que
-- borrar o cambiar una porción no altera el historial. Si se borra el alimento, se borran sus porciones.
create table if not exists public.food_portions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0 and length(name) <= 40),
  amount numeric(7,1) not null check (amount > 0 and amount <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists food_portions_nombre_uq on public.food_portions (food_id, lower(btrim(name)));
create index if not exists food_portions_food_idx on public.food_portions (food_id);

-- ---------- NUTRI: macros en las comidas ----------
-- Columnas nuevas, todas opcionales: NULL = «sin dato» (nunca 0). Las comidas anteriores quedan igual (solo proteína).
-- food_name y amount son una FOTO de lo que se comió: cambiar o borrar el alimento no altera el historial.
alter table public.meals add column if not exists calories_kcal numeric(7,1) check (calories_kcal >= 0 and calories_kcal <= 10000);
alter table public.meals add column if not exists carbs_g numeric(6,1) check (carbs_g >= 0 and carbs_g <= 1000);
alter table public.meals add column if not exists fat_g numeric(6,1) check (fat_g >= 0 and fat_g <= 1000);
alter table public.meals add column if not exists food_id uuid references public.foods(id) on delete set null;
alter table public.meals add column if not exists food_name text check (food_name is null or length(food_name) <= 80);
alter table public.meals add column if not exists amount numeric(7,1) check (amount > 0 and amount <= 10000);

-- ---------- RLS + permisos + updated_at (misma plantilla que 001, 003 y 005) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'foods','food_portions'
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
