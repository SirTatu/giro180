-- =====================================================================
-- Giro 180 — 012_test_rls_sueno.sql  (prueba de seguridad y reglas de 011)
-- 1) Ejecutá ANTES 011_sueno.sql.
-- 2) Reemplazá PEGAR-AQUI-TU-USER-UID (en la línea "yo uuid := ...") por el "User UID" de tu usuario
--    (Supabase → Authentication → Users). Es el mismo que usaste en 002, 004, 006, 008 y 010.
-- 3) Ejecutá en SQL Editor. Hacelo ANTES de usar el sueño en la app (si tenés un registro en curso, la prueba te avisa).
-- RESULTADO: "Success. No rows returned" = todo bien.
--            Un error que empiece con "FALLO" = algo está mal: no sigas y avisame con el texto completo.
-- No deja datos de prueba: se borra todo al final (usa fechas del año 2000).
-- =====================================================================
do $$
declare
  yo uuid := 'PEGAR-AQUI-TU-USER-UID'::uuid;
  ajeno uuid := gen_random_uuid();
  n int;
  fallo boolean;
  v_noche uuid;
begin
  -- ===== Me hago pasar por mí =====
  perform set_config('request.jwt.claims', json_build_object('sub', yo, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Si ya tenés un registro de sueño en curso real, esta prueba lo confundiría: terminalo en la app y volvé a correrla.
  select count(*) into n from public.sleep_sessions where ended_at is null;
  if n <> 0 then raise exception 'ANTES DE PROBAR: hay un registro de sueño en curso. Terminalo en la app (Vida → Sueño) y volvé a ejecutar esta prueba.'; end if;

  -- Altas correctas: una noche, una siesta y un registro de exactamente 24 horas (el máximo permitido)
  insert into public.sleep_sessions (kind, started_at, ended_at) values ('night', '2000-01-01 02:00+00', '2000-01-01 10:00+00') returning id into v_noche;
  insert into public.sleep_sessions (kind, started_at, ended_at, note) values ('nap', '2000-01-01 15:00+00', '2000-01-01 15:45+00', 'prueba');
  insert into public.sleep_sessions (started_at, ended_at) values ('2000-01-05 00:00+00', '2000-01-06 00:00+00');
  select count(*) into n from public.sleep_sessions where started_at < '2001-01-01' and ended_at is not null;
  if n <> 3 then raise exception 'FALLO 1: se esperaban 3 registros cerrados y hay %', n; end if;
  select count(*) into n from public.sleep_sessions where id = v_noche and kind = 'night';
  if n <> 1 then raise exception 'FALLO 2: la noche no quedó guardada como noche'; end if;
  -- El tipo por defecto es noche
  select count(*) into n from public.sleep_sessions where started_at = '2000-01-05 00:00+00' and kind = 'night';
  if n <> 1 then raise exception 'FALLO 3: el tipo por defecto no es noche'; end if;

  -- Reglas de los datos
  fallo := false;
  begin
    insert into public.sleep_sessions (kind, started_at, ended_at) values ('dormir', '2000-02-01 02:00+00', '2000-02-01 10:00+00');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 4: se aceptó un tipo que no es noche ni siesta'; end if;
  fallo := false;
  begin
    insert into public.sleep_sessions (kind, started_at, ended_at) values ('night', '2000-02-01 10:00+00', '2000-02-01 10:00+00');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 5: se aceptó un registro que termina en el mismo instante en que empieza'; end if;
  fallo := false;
  begin
    insert into public.sleep_sessions (kind, started_at, ended_at) values ('night', '2000-02-01 10:00+00', '2000-02-01 02:00+00');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 6: se aceptó un registro que termina antes de empezar'; end if;
  fallo := false;
  begin
    insert into public.sleep_sessions (kind, started_at, ended_at) values ('night', '2000-02-01 00:00+00', '2000-02-02 00:01+00');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 7: se aceptó un registro de más de 24 horas'; end if;
  fallo := false;
  begin
    insert into public.sleep_sessions (kind, started_at, ended_at, note) values ('night', '2000-02-01 02:00+00', '2000-02-01 10:00+00', repeat('x', 501));
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 8: se aceptó una nota de más de 500 caracteres'; end if;
  fallo := false;
  begin
    insert into public.sleep_sessions (kind, started_at) values ('night', null);
  exception when not_null_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 9: se aceptó un registro sin hora de inicio'; end if;

  -- Un solo registro en curso a la vez
  insert into public.sleep_sessions (kind, started_at) values ('night', '2000-01-10 00:00+00');
  fallo := false;
  begin
    insert into public.sleep_sessions (kind, started_at) values ('nap', '2000-01-10 12:00+00');
  exception when unique_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 10: se permitieron dos registros de sueño en curso a la vez'; end if;
  -- Un registro en curso no se puede cerrar antes de empezar
  fallo := false;
  begin
    update public.sleep_sessions set ended_at = '2000-01-09 23:00+00' where ended_at is null and started_at = '2000-01-10 00:00+00';
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 11: se pudo cerrar un registro antes de su inicio'; end if;
  -- Al cerrarlo se puede empezar otro
  update public.sleep_sessions set ended_at = '2000-01-10 08:00+00' where ended_at is null and started_at = '2000-01-10 00:00+00';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO 12: no se pudo cerrar el registro en curso (%)', n; end if;
  insert into public.sleep_sessions (kind, started_at) values ('nap', '2000-01-10 12:00+00');
  select count(*) into n from public.sleep_sessions where ended_at is null;
  if n <> 1 then raise exception 'FALLO 13: se esperaba 1 registro en curso y hay %', n; end if;

  -- ===== Un usuario ajeno =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ajeno, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.sleep_sessions where started_at < '2001-01-01';
  if n <> 0 then raise exception 'FALLO 14: un ajeno ve mis registros de sueño (%)', n; end if;
  update public.sleep_sessions set note = 'hackeado' where started_at < '2001-01-01';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 15: un ajeno pudo modificar mis registros de sueño (%)', n; end if;
  delete from public.sleep_sessions where started_at < '2001-01-01';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 16: un ajeno pudo borrar mis registros de sueño (%)', n; end if;
  fallo := false;
  begin
    insert into public.sleep_sessions (user_id, kind, started_at, ended_at) values (yo, 'night', '2000-03-01 02:00+00', '2000-03-01 10:00+00');
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 17: un ajeno pudo escribir registros de sueño en mi cuenta'; end if;

  -- ===== Sin sesión (rol anónimo) =====
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  fallo := false;
  begin
    select count(*) into n from public.sleep_sessions;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 18: el acceso anónimo pudo leer registros de sueño'; end if;

  -- ===== Limpieza =====
  reset role;
  delete from public.sleep_sessions where started_at < '2001-01-01' and user_id = yo;
end $$;
