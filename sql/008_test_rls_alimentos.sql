-- =====================================================================
-- Giro 180 — 008_test_rls_alimentos.sql  (prueba de seguridad y reglas de 007)
-- 1) Ejecutá ANTES 007_alimentos.sql.
-- 2) Reemplazá PEGAR-AQUI-TU-USER-UID (en la línea "yo uuid := ...") por el "User UID" de tu usuario
--    (Supabase → Authentication → Users). Es el mismo que usaste en 002, 004 y 006.
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
  v_food uuid;
  v_food2 uuid;
  v_meal uuid;
begin
  -- ===== Me hago pasar por mí =====
  perform set_config('request.jwt.claims', json_build_object('sub', yo, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Alimentos: alta y reglas
  insert into public.foods (name, base_unit, kcal_100, carbs_100, protein_100, fat_100)
    values ('prueba-pollo', 'g', 165, 0, 31, 3.6) returning id into v_food;
  insert into public.foods (name, base_unit, kcal_100, carbs_100, protein_100, fat_100)
    values ('prueba-leche', 'ml', 61, 4.8, 3.2, 3.3) returning id into v_food2;
  fallo := false;
  begin
    insert into public.foods (name, kcal_100, carbs_100, protein_100, fat_100) values ('  PRUEBA-POLLO ', 1, 0, 0, 0);
  exception when unique_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 1: se permitió un alimento con nombre repetido'; end if;
  fallo := false;
  begin
    insert into public.foods (name, kcal_100, carbs_100, protein_100, fat_100) values ('prueba-neg', -1, 0, 0, 0);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 2: se aceptaron calorías negativas'; end if;
  fallo := false;
  begin
    insert into public.foods (name, kcal_100, carbs_100, protein_100, fat_100) values ('prueba-enorme', 1001, 0, 0, 0);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 3: se aceptaron más de 1000 kcal por 100 g'; end if;
  fallo := false;
  begin
    insert into public.foods (name, kcal_100, carbs_100, protein_100, fat_100) values ('prueba-suma', 400, 60, 30, 20);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 4: se aceptó un alimento cuyas macros pasan de 100 g por 100 g'; end if;
  fallo := false;
  begin
    insert into public.foods (name, kcal_100, carbs_100, protein_100, fat_100) values ('   ', 1, 0, 0, 0);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 5: se aceptó un alimento sin nombre'; end if;
  fallo := false;
  begin
    insert into public.foods (name, base_unit, kcal_100, carbs_100, protein_100, fat_100) values ('prueba-unidad', 'kg', 1, 0, 0, 0);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 6: se aceptó una unidad base inválida'; end if;
  fallo := false;
  begin
    insert into public.foods (name, kcal_100, carbs_100, protein_100) values ('prueba-sin-grasa', 1, 0, 0);
  exception when not_null_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 7: se aceptó un alimento sin una de las 4 macros'; end if;

  -- Porciones
  insert into public.food_portions (food_id, name, amount) values (v_food, 'pechuga chica', 120);
  insert into public.food_portions (food_id, name, amount) values (v_food2, 'vaso', 200);
  fallo := false;
  begin
    insert into public.food_portions (food_id, name, amount) values (v_food, ' PECHUGA CHICA', 100);
  exception when unique_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 8: se permitió una porción repetida en el mismo alimento'; end if;
  fallo := false;
  begin
    insert into public.food_portions (food_id, name, amount) values (v_food, 'cero', 0);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 9: se aceptó una porción de 0'; end if;
  fallo := false;
  begin
    insert into public.food_portions (food_id, name, amount) values (v_food, 'enorme', 5001);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 10: se aceptó una porción de más de 5000'; end if;
  fallo := false;
  begin
    insert into public.food_portions (food_id, name, amount) values (v_food, '   ', 50);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 11: se aceptó una porción sin nombre'; end if;

  -- Comidas con macros y con foto del alimento
  insert into public.meals (eaten_on, meal_type, description, protein_g, calories_kcal, carbs_g, fat_g, food_id, food_name, amount)
    values ('2000-01-01', 'almuerzo', 'prueba-pollo', 37.2, 198, 0, 4.3, v_food, 'prueba-pollo', 120) returning id into v_meal;
  insert into public.meals (eaten_on, meal_type, description) values ('2000-01-01', 'cena', 'prueba-sin-macros');
  select count(*) into n from public.meals where eaten_on = '2000-01-01' and calories_kcal is null and carbs_g is null and fat_g is null and protein_g is null;
  if n <> 1 then raise exception 'FALLO 12: una comida sin macros debe quedar con todo en NULL (sin dato), no en 0 (%)', n; end if;
  fallo := false;
  begin
    insert into public.meals (eaten_on, meal_type, description, calories_kcal) values ('2000-01-01', 'cena', 'prueba-neg', -5);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 13: se aceptaron calorías negativas en una comida'; end if;
  fallo := false;
  begin
    insert into public.meals (eaten_on, meal_type, description, amount) values ('2000-01-01', 'cena', 'prueba-cantidad', 0);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 14: se aceptó una cantidad de 0 en una comida'; end if;
  fallo := false;
  begin
    insert into public.meals (eaten_on, meal_type, description, food_id) values ('2000-01-01', 'cena', 'prueba-fk', gen_random_uuid());
  exception when foreign_key_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 15: se aceptó un food_id que no existe'; end if;

  -- Borrar un alimento: borra sus porciones, pero las comidas conservan la foto
  delete from public.foods where id = v_food;
  select count(*) into n from public.food_portions where food_id = v_food;
  if n <> 0 then raise exception 'FALLO 16: al borrar el alimento no se borraron sus porciones (%)', n; end if;
  select count(*) into n from public.meals where id = v_meal and food_id is null and food_name = 'prueba-pollo' and calories_kcal = 198 and amount = 120;
  if n <> 1 then raise exception 'FALLO 17: al borrar el alimento se alteró el historial de la comida (%)', n; end if;

  -- ===== Un usuario ajeno =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ajeno, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.foods where name like 'prueba-%';
  if n <> 0 then raise exception 'FALLO 18: un ajeno ve mis alimentos (%)', n; end if;
  select count(*) into n from public.food_portions;
  if n <> 0 then raise exception 'FALLO 19: un ajeno ve mis porciones (%)', n; end if;
  select count(*) into n from public.meals where eaten_on = '2000-01-01';
  if n <> 0 then raise exception 'FALLO 20: un ajeno ve mis comidas con macros (%)', n; end if;
  update public.foods set kcal_100 = 1 where name like 'prueba-%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 21: un ajeno pudo modificar mis alimentos (%)', n; end if;
  delete from public.food_portions;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 22: un ajeno pudo borrar mis porciones (%)', n; end if;
  fallo := false;
  begin
    insert into public.foods (user_id, name, kcal_100, carbs_100, protein_100, fat_100) values (yo, 'prueba-intruso', 1, 0, 0, 0);
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 23: un ajeno pudo crear alimentos en mi cuenta'; end if;
  fallo := false;
  begin
    insert into public.meals (user_id, eaten_on, meal_type, description, calories_kcal) values (yo, '2000-01-02', 'cena', 'prueba-intruso', 100);
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 24: un ajeno pudo escribir comidas en mi cuenta'; end if;

  -- ===== Sin sesión (rol anónimo) =====
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  fallo := false;
  begin
    select count(*) into n from public.foods;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 25: el acceso anónimo pudo leer alimentos'; end if;
  fallo := false;
  begin
    select count(*) into n from public.food_portions;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 26: el acceso anónimo pudo leer porciones'; end if;

  -- ===== Limpieza =====
  reset role;
  delete from public.meals where eaten_on = '2000-01-01' and user_id = yo;
  delete from public.foods where name like 'prueba-%' and user_id = yo;
end $$;
