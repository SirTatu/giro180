-- =====================================================================
-- Giro 180 — 006_test_rls_agua.sql  (prueba de seguridad y reglas de 005)
-- 1) Ejecutá ANTES 005_agua.sql.
-- 2) Reemplazá PEGAR-AQUI-TU-USER-UID (en la línea "yo uuid := ...") por el "User UID" de tu usuario
--    (Supabase → Authentication → Users). Es el mismo que usaste en 002 y 004.
-- 3) Ejecutá en SQL Editor.
-- RESULTADO: "Success. No rows returned" = todo bien.
--            Un error que empiece con "FALLO" = algo está mal: no sigas y avisame con el texto completo.
-- No deja datos de prueba: se borra todo al final.
-- =====================================================================
do $$
declare
  yo uuid := 'e20c4dd1-2554-4fc1-b3fe-2506b338bc97'::uuid;
  ajeno uuid := gen_random_uuid();
  n int;
  fallo boolean;
  v_bot uuid;
  v_toma uuid;
begin
  -- ===== Me hago pasar por mí =====
  perform set_config('request.jwt.claims', json_build_object('sub', yo, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Botellas: alta, nombre repetido (sin importar mayúsculas), volumen inválido, nombre vacío
  insert into public.water_containers (name, volume_ml) values ('prueba-botella', 750) returning id into v_bot;
  fallo := false;
  begin
    insert into public.water_containers (name, volume_ml) values ('  PRUEBA-BOTELLA ', 500);
  exception when unique_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 1: se permitió una botella con nombre repetido'; end if;
  fallo := false;
  begin
    insert into public.water_containers (name, volume_ml) values ('prueba-cero', 0);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 2: se aceptó una botella de 0 ml'; end if;
  fallo := false;
  begin
    insert into public.water_containers (name, volume_ml) values ('prueba-enorme', 20001);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 3: se aceptó una botella de más de 20000 ml'; end if;
  fallo := false;
  begin
    insert into public.water_containers (name, volume_ml) values ('   ', 500);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 4: se aceptó una botella sin nombre'; end if;

  -- Tomas: alta con botella, sin botella, y valores inválidos
  insert into public.water_intakes (drunk_on, ml, container_id, container_name) values ('2000-01-01', 750, v_bot, 'prueba-botella') returning id into v_toma;
  insert into public.water_intakes (drunk_on, ml) values ('2000-01-01', 250);
  fallo := false;
  begin
    insert into public.water_intakes (drunk_on, ml) values ('2000-01-01', 0);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 5: se aceptó una toma de 0 ml'; end if;
  fallo := false;
  begin
    insert into public.water_intakes (drunk_on, ml) values ('2000-01-01', 10001);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 6: se aceptó una toma de más de 10000 ml'; end if;
  select count(*) into n from public.water_intakes where drunk_on = '2000-01-01';
  if n <> 2 then raise exception 'FALLO 7: se esperaban 2 tomas y hay %', n; end if;

  -- Borrar una botella NO borra las tomas: conservan la foto del nombre
  delete from public.water_containers where id = v_bot;
  select count(*) into n from public.water_intakes where id = v_toma and container_id is null and container_name = 'prueba-botella' and ml = 750;
  if n <> 1 then raise exception 'FALLO 8: al borrar la botella se alteró el historial de tomas (%)', n; end if;

  -- Una botella para las pruebas de ajeno
  insert into public.water_containers (name, volume_ml) values ('prueba-botella-2', 500);

  -- ===== Un usuario ajeno =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ajeno, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.water_containers where name like 'prueba-%';
  if n <> 0 then raise exception 'FALLO 9: un ajeno ve mis botellas (%)', n; end if;
  select count(*) into n from public.water_intakes where drunk_on = '2000-01-01';
  if n <> 0 then raise exception 'FALLO 10: un ajeno ve mis tomas de agua (%)', n; end if;
  update public.water_intakes set ml = 1 where drunk_on = '2000-01-01';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 11: un ajeno pudo modificar mis tomas (%)', n; end if;
  delete from public.water_containers where name like 'prueba-%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 12: un ajeno pudo borrar mis botellas (%)', n; end if;
  fallo := false;
  begin
    insert into public.water_intakes (user_id, drunk_on, ml) values (yo, '2000-01-02', 100);
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 13: un ajeno pudo escribir tomas en mi cuenta'; end if;
  fallo := false;
  begin
    insert into public.water_containers (user_id, name, volume_ml) values (yo, 'prueba-intruso', 100);
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 14: un ajeno pudo crear botellas en mi cuenta'; end if;

  -- ===== Sin sesión (rol anónimo) =====
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  fallo := false;
  begin
    select count(*) into n from public.water_containers;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 15: el acceso anónimo pudo leer botellas'; end if;
  fallo := false;
  begin
    select count(*) into n from public.water_intakes;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 16: el acceso anónimo pudo leer tomas de agua'; end if;

  -- ===== Limpieza =====
  reset role;
  delete from public.water_intakes where drunk_on = '2000-01-01' and user_id = yo;
  delete from public.water_containers where name like 'prueba-%' and user_id = yo;
end $$;
