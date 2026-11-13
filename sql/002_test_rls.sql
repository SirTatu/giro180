-- =====================================================================
-- Giro 180 — 002_test_rls.sql  (prueba de seguridad)
-- 1) Reemplazá PEGAR-AQUI-TU-USER-UID por el "User UID" de tu usuario
--    (Supabase → Authentication → Users).
-- 2) Ejecutá en SQL Editor.
-- RESULTADO: "Success. No rows returned" = todo bien.
--            Un error que empiece con "FALLO" = algo está mal: no sigas y avisame.
-- No deja datos de prueba (los borra al final).
-- =====================================================================
do $$
declare
  yo uuid := 'PEGAR-AQUI-TU-USER-UID'::uuid;
  ajeno uuid := gen_random_uuid();
  n int;
  fallo boolean;
begin
  -- Me hago pasar por mí
  perform set_config('request.jwt.claims', json_build_object('sub', yo, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.daily_entries (entry_date, notes) values ('2000-01-01', 'prueba-rls');
  select count(*) into n from public.daily_entries where notes = 'prueba-rls';
  if n <> 1 then raise exception 'FALLO 1: no veo mi propia fila (veo %)', n; end if;

  insert into public.priorities (title, started_on)
    values ('prueba-p1','2000-01-01'), ('prueba-p2','2000-01-01'), ('prueba-p3','2000-01-01');
  fallo := false;
  begin
    insert into public.priorities (title, started_on) values ('prueba-p4','2000-01-01');
  exception when raise_exception then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 2: se permitió una cuarta prioridad activa'; end if;

  insert into public.habit_definitions (module, name, kind, scheduled_days, valid_from, locked)
    values ('gym', 'prueba-gym', 'boolean', '{2,3,4,5,6}', '2000-01-01', true);
  fallo := false;
  begin
    delete from public.habit_definitions where name = 'prueba-gym';
  exception when raise_exception then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 3: se pudo borrar un hábito bloqueado'; end if;

  -- Me hago pasar por otra persona
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ajeno, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.daily_entries where notes = 'prueba-rls';
  if n <> 0 then raise exception 'FALLO 4: un usuario ajeno ve mis registros (ve %)', n; end if;
  select count(*) into n from public.priorities where title like 'prueba-%';
  if n <> 0 then raise exception 'FALLO 5: un usuario ajeno ve mis prioridades (ve %)', n; end if;

  fallo := false;
  begin
    insert into public.daily_entries (user_id, entry_date, notes) values (yo, '2000-01-02', 'intruso');
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 6: un ajeno pudo escribir en mi cuenta'; end if;

  -- Sin sesión (rol anónimo)
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  fallo := false;
  begin
    select count(*) into n from public.daily_entries;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 7: el acceso anónimo pudo leer datos'; end if;

  -- Limpieza
  reset role;
  perform set_config('giro180.allow_locked_change', 'on', true);
  delete from public.priorities where title like 'prueba-%' and user_id = yo;
  delete from public.habit_definitions where name = 'prueba-gym' and user_id = yo;
  delete from public.daily_entries where notes = 'prueba-rls' and user_id = yo;
  perform set_config('giro180.allow_locked_change', 'off', true);
end $$;
