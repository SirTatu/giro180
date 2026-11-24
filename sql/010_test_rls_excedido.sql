-- =====================================================================
-- Giro 180 — 010_test_rls_excedido.sql  (prueba de reglas y seguridad de 009)
-- 1) Ejecutá ANTES 009_excedido.sql.
-- 2) Reemplazá PEGAR-AQUI-TU-USER-UID (en la línea "yo uuid := ...") por el "User UID" de tu usuario
--    (Supabase → Authentication → Users). Es el mismo que usaste en 002, 004, 006 y 008.
-- 3) Ejecutá en SQL Editor.
-- RESULTADO: "Success. No rows returned" = todo bien.
--            Un error que empiece con "FALLO" = algo está mal: no sigas y avisame con el texto completo.
-- No deja datos de prueba: se borra todo al final.
-- =====================================================================
do $$
declare
  yo uuid := 'PEGAR-AQUI-TU-USER-UID'::uuid;
  ajeno uuid := gen_random_uuid();
  n int;
  fallo boolean;
  v_h uuid;
  v_hmax uuid;
  v_hbool uuid;
begin
  -- ===== Me hago pasar por mí =====
  perform set_config('request.jwt.claims', json_build_object('sub', yo, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Hábito de siempre (sin máximo) y hábito con rango
  insert into public.habit_definitions (module, name, kind, target_value, unit, valid_from)
    values ('nutri', 'prueba-excedido-sin-max', 'quantity', 120, 'g', '2000-01-01') returning id into v_h;
  insert into public.habit_definitions (module, name, kind, target_value, target_max, unit, valid_from)
    values ('nutri', 'prueba-excedido-rango', 'quantity', 1500, 2000, 'kcal', '2000-01-01') returning id into v_hmax;
  insert into public.habit_definitions (module, name, kind, target_value, target_max, unit, valid_from)
    values ('nutri', 'prueba-excedido-maximo', 'quantity', 0, 2000, 'kcal', '2000-01-01');
  insert into public.habit_definitions (module, name, kind, valid_from)
    values ('nutri', 'prueba-excedido-booleano', 'boolean', '2000-01-01') returning id into v_hbool;
  select count(*) into n from public.habit_definitions where name = 'prueba-excedido-sin-max' and target_max is null;
  if n <> 1 then raise exception 'FALLO 1: un hábito existente debe quedar sin máximo (NULL) (%)', n; end if;
  fallo := false;
  begin
    insert into public.habit_definitions (module, name, kind, target_value, target_max, unit, valid_from) values ('nutri', 'prueba-excedido-menor', 'quantity', 100, 50, 'g', '2000-01-01');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 2: se aceptó un máximo menor que la meta'; end if;
  fallo := false;
  begin
    insert into public.habit_definitions (module, name, kind, target_value, target_max, unit, valid_from) values ('nutri', 'prueba-excedido-cero', 'quantity', 0, 0, 'g', '2000-01-01');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 3: se aceptó un máximo de 0'; end if;
  fallo := false;
  begin
    insert into public.habit_definitions (module, name, kind, target_max, valid_from) values ('nutri', 'prueba-excedido-bool', 'boolean', 10, '2000-01-01');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 4: se aceptó un máximo en un hábito de sí/no'; end if;
  fallo := false;
  begin
    insert into public.habit_definitions (module, name, kind, target_max, unit, valid_from) values ('nutri', 'prueba-excedido-sinmeta', 'quantity', 10, 'g', '2000-01-01');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 5: se aceptó un máximo sin meta'; end if;

  -- Registros: los tres estados y uno inválido
  insert into public.habit_logs (habit_id, log_date, status, value) values (v_hmax, '2000-01-01', 'done', 1800);
  insert into public.habit_logs (habit_id, log_date, status, value) values (v_hmax, '2000-01-02', 'missed', 900);
  insert into public.habit_logs (habit_id, log_date, status, value) values (v_hmax, '2000-01-03', 'exceeded', 2400);
  fallo := false;
  begin
    insert into public.habit_logs (habit_id, log_date, status, value) values (v_hmax, '2000-01-04', 'exceso', 2400);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 6: se aceptó un estado inventado'; end if;
  fallo := false;
  begin
    insert into public.habit_logs (habit_id, log_date, status) values (v_hmax, '2000-01-05', 'EXCEEDED');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 7: se aceptó el estado en mayúsculas'; end if;
  select count(*) into n from public.habit_logs where habit_id = v_hmax and status = 'exceeded';
  if n <> 1 then raise exception 'FALLO 8: el estado excedido no se guardó (%)', n; end if;
  fallo := false;
  begin
    insert into public.habit_logs (habit_id, log_date, status) values (v_hmax, '2000-01-03', 'done');
  exception when unique_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 9: se aceptó dos registros del mismo hábito el mismo día'; end if;

  -- ===== Un usuario ajeno =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ajeno, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.habit_definitions where name like 'prueba-excedido-%';
  if n <> 0 then raise exception 'FALLO 10: un ajeno ve mis hábitos con rango (%)', n; end if;
  select count(*) into n from public.habit_logs where log_date between '2000-01-01' and '2000-01-05';
  if n <> 0 then raise exception 'FALLO 11: un ajeno ve mis registros excedidos (%)', n; end if;
  update public.habit_logs set status = 'done' where log_date = '2000-01-03';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 12: un ajeno pudo modificar mis registros (%)', n; end if;
  fallo := false;
  begin
    insert into public.habit_logs (user_id, habit_id, log_date, status) values (yo, v_hmax, '2000-01-06', 'exceeded');
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 13: un ajeno pudo escribir registros en mi cuenta'; end if;

  -- ===== Sin sesión (rol anónimo) =====
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  fallo := false;
  begin
    select count(*) into n from public.habit_logs;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 14: el acceso anónimo pudo leer registros'; end if;
  fallo := false;
  begin
    select count(*) into n from public.habit_definitions;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 15: el acceso anónimo pudo leer hábitos'; end if;

  -- ===== Limpieza =====
  reset role;
  delete from public.habit_logs where habit_id in (select id from public.habit_definitions where name like 'prueba-excedido-%' and user_id = yo);
  delete from public.habit_definitions where name like 'prueba-excedido-%' and user_id = yo;
end $$;
