-- =====================================================================
-- Giro 180 — 004_test_rls_gym_nutri.sql  (prueba de seguridad y reglas de 003)
-- 1) Ejecutá ANTES 003_gym_nutri.sql.
-- 2) Reemplazá PEGAR-AQUI-TU-USER-UID por el "User UID" de tu usuario
--    (Supabase → Authentication → Users). Es el mismo que usaste en 002.
-- 3) Ejecutá en SQL Editor.
-- RESULTADO: "Success. No rows returned" = todo bien.
--            Un error que empiece con "FALLO" = algo está mal: no sigas y avisame con el texto completo.
-- No deja datos de prueba: todo corre en una sola transacción y además se borra al final.
-- =====================================================================
do $$
declare
  yo uuid := 'e20c4dd1-2554-4fc1-b3fe-2506b338bc97'::uuid;
  ajeno uuid := gen_random_uuid();
  n int;
  fallo boolean;
  v_ej1 uuid;
  v_ej2 uuid;
  v_rutina uuid;
  v_habito uuid;
  v_sesion uuid;
begin
  -- ===== Me hago pasar por mí =====
  perform set_config('request.jwt.claims', json_build_object('sub', yo, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Ejercicios: alta, nombre repetido (sin importar mayúsculas) y grupo muscular inválido
  insert into public.exercises (name, muscle_group) values ('prueba-ej1', 'pecho') returning id into v_ej1;
  insert into public.exercises (name, muscle_group) values ('prueba-ej2', 'triceps') returning id into v_ej2;
  fallo := false;
  begin
    insert into public.exercises (name) values ('  PRUEBA-EJ1 ');
  exception when unique_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 1: se permitió un ejercicio con nombre repetido'; end if;
  fallo := false;
  begin
    insert into public.exercises (name, muscle_group) values ('prueba-ej3', 'cabeza');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 2: se aceptó un grupo muscular inválido'; end if;

  -- Rutina y sus ejercicios (objetivo series x rango de repeticiones)
  insert into public.routines (name, weekday) values ('prueba-rutina', 2) returning id into v_rutina;
  insert into public.routine_exercises (routine_id, exercise_id, sort_order, target_sets, reps_min, reps_max)
    values (v_rutina, v_ej1, 1, 4, 6, 8), (v_rutina, v_ej2, 2, 3, 12, 15);
  fallo := false;
  begin
    insert into public.routine_exercises (routine_id, exercise_id, target_sets, reps_min, reps_max)
      values (v_rutina, v_ej1, 3, 10, 8);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 3: se aceptó un rango de repeticiones invertido (10-8)'; end if;
  fallo := false;
  begin
    insert into public.routines (name, weekday) values ('prueba-dia-malo', 9);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 4: se aceptó un día de la semana inválido (9)'; end if;

  -- Hábito "Entrenar" de prueba (no bloqueado, para poder limpiarlo)
  insert into public.habit_definitions (module, name, kind, scheduled_days, valid_from)
    values ('gym', 'prueba-entrenar', 'boolean', '{1,2,3,4,5,6,7}', '2000-01-01') returning id into v_habito;

  -- Guardar un entrenamiento nuevo (3 series) y marcar el hábito, todo junto
  select public.guardar_entrenamiento(
    null::uuid, date '2000-01-03', v_rutina, 'prueba-rutina', 60::smallint, 'prueba-rls',
    jsonb_build_array(
      jsonb_build_object('exercise_id', v_ej1, 'set_no', 1, 'reps', 8, 'weight_kg', 80,   'target_sets', 4, 'target_reps_min', 6, 'target_reps_max', 8),
      jsonb_build_object('exercise_id', v_ej1, 'set_no', 2, 'reps', 7, 'weight_kg', 82.5, 'target_sets', 4, 'target_reps_min', 6, 'target_reps_max', 8),
      jsonb_build_object('exercise_id', v_ej2, 'set_no', 1, 'reps', 12, 'weight_kg', null)
    ), v_habito) into v_sesion;
  select count(*) into n from public.workout_sessions where id = v_sesion and routine_name = 'prueba-rutina';
  if n <> 1 then raise exception 'FALLO 5: no se guardó el entrenamiento (sesiones: %)', n; end if;
  select count(*) into n from public.workout_sets where session_id = v_sesion;
  if n <> 3 then raise exception 'FALLO 6: se esperaban 3 series y hay %', n; end if;
  select count(*) into n from public.workout_sets where session_id = v_sesion and weight_kg = 82.5 and target_reps_max = 8;
  if n <> 1 then raise exception 'FALLO 7: no se guardaron peso decimal y foto del objetivo (%)', n; end if;
  select count(*) into n from public.habit_logs where habit_id = v_habito and log_date = '2000-01-03' and status = 'done';
  if n <> 1 then raise exception 'FALLO 8: el hábito no quedó marcado como cumplido (%)', n; end if;

  -- Editar el mismo entrenamiento: reemplaza las series y NO duplica el registro del hábito
  perform public.guardar_entrenamiento(
    v_sesion, date '2000-01-03', v_rutina, 'prueba-rutina', 55::smallint, 'prueba-rls',
    jsonb_build_array(jsonb_build_object('exercise_id', v_ej1, 'set_no', 1, 'reps', 9, 'weight_kg', 80)), v_habito);
  select count(*) into n from public.workout_sets where session_id = v_sesion;
  if n <> 1 then raise exception 'FALLO 9: al editar debían quedar 1 serie y hay %', n; end if;
  select count(*) into n from public.habit_logs where habit_id = v_habito;
  if n <> 1 then raise exception 'FALLO 10: al editar se duplicó el registro del hábito (%)', n; end if;
  select count(*) into n from public.workout_sessions where performed_on = '2000-01-03' and notes = 'prueba-rls';
  if n <> 1 then raise exception 'FALLO 11: al editar se duplicó el entrenamiento (%)', n; end if;

  -- Atomicidad: series repetidas => error y NO queda un entrenamiento a medias
  fallo := false;
  begin
    perform public.guardar_entrenamiento(
      null::uuid, date '2000-01-04', v_rutina, 'prueba-rutina', null, 'prueba-rls',
      jsonb_build_array(
        jsonb_build_object('exercise_id', v_ej1, 'set_no', 1, 'reps', 8),
        jsonb_build_object('exercise_id', v_ej1, 'set_no', 1, 'reps', 9)), null::uuid);
  exception when unique_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 12: se aceptaron dos series con el mismo número'; end if;
  select count(*) into n from public.workout_sessions where performed_on = '2000-01-04';
  if n <> 0 then raise exception 'FALLO 13: quedó un entrenamiento a medias tras el error (%)', n; end if;

  -- Sin series, o editando uno que no existe => error claro
  fallo := false;
  begin
    perform public.guardar_entrenamiento(null::uuid, date '2000-01-05', null::uuid, null, null, null, '[]'::jsonb, null::uuid);
  exception when raise_exception then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 14: se aceptó un entrenamiento sin series'; end if;
  fallo := false;
  begin
    perform public.guardar_entrenamiento(gen_random_uuid(), date '2000-01-05', null::uuid, null, null, null,
      jsonb_build_array(jsonb_build_object('exercise_id', v_ej1, 'set_no', 1, 'reps', 8)), null::uuid);
  exception when raise_exception then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 15: se pudo "editar" un entrenamiento inexistente'; end if;

  -- Reps negativas rechazadas
  fallo := false;
  begin
    insert into public.workout_sets (session_id, exercise_id, set_no, reps) values (v_sesion, v_ej2, 5, -1);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 16: se aceptaron repeticiones negativas'; end if;

  -- Un ejercicio usado en el historial no se puede borrar (se archiva)
  fallo := false;
  begin
    delete from public.exercises where id = v_ej1;
  exception when foreign_key_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 17: se pudo borrar un ejercicio con historial'; end if;

  -- Comidas: proteína sin cargar (null) es válida; negativa o tipo inválido, no
  insert into public.meals (eaten_on, meal_type, description, protein_g) values ('2000-01-03', 'almuerzo', 'prueba-comida', null);
  insert into public.meals (eaten_on, meal_type, description, protein_g) values ('2000-01-03', 'cena', 'prueba-comida', 32.5);
  select count(*) into n from public.meals where description = 'prueba-comida' and protein_g is null;
  if n <> 1 then raise exception 'FALLO 18: la proteína sin cargar no quedó como null (%)', n; end if;
  fallo := false;
  begin
    insert into public.meals (eaten_on, meal_type, description, protein_g) values ('2000-01-03', 'cena', 'prueba-comida', -5);
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 19: se aceptó proteína negativa'; end if;
  fallo := false;
  begin
    insert into public.meals (eaten_on, meal_type, description) values ('2000-01-03', 'brunch', 'prueba-comida');
  exception when check_violation then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 20: se aceptó un tipo de comida inválido'; end if;

  -- ===== Me hago pasar por otra persona =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ajeno, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.exercises where name like 'prueba-%';
  if n <> 0 then raise exception 'FALLO 21: un ajeno ve mis ejercicios (%)', n; end if;
  select count(*) into n from public.routines where name like 'prueba-%';
  if n <> 0 then raise exception 'FALLO 22: un ajeno ve mis rutinas (%)', n; end if;
  select count(*) into n from public.routine_exercises;
  if n <> 0 then raise exception 'FALLO 23: un ajeno ve los ejercicios de mis rutinas (%)', n; end if;
  select count(*) into n from public.workout_sessions where notes = 'prueba-rls';
  if n <> 0 then raise exception 'FALLO 24: un ajeno ve mis entrenamientos (%)', n; end if;
  select count(*) into n from public.workout_sets;
  if n <> 0 then raise exception 'FALLO 25: un ajeno ve mis series (%)', n; end if;
  select count(*) into n from public.meals where description = 'prueba-comida';
  if n <> 0 then raise exception 'FALLO 26: un ajeno ve mis comidas (%)', n; end if;

  update public.meals set description = 'intruso' where description = 'prueba-comida';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 27: un ajeno pudo modificar mis comidas (%)', n; end if;
  delete from public.exercises where name like 'prueba-%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO 28: un ajeno pudo borrar mis ejercicios (%)', n; end if;

  fallo := false;
  begin
    insert into public.meals (user_id, eaten_on, meal_type, description) values (yo, '2000-01-02', 'cena', 'intruso');
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 29: un ajeno pudo escribir comidas en mi cuenta'; end if;

  -- Un ajeno no puede editar mi entrenamiento a través de la función
  fallo := false;
  begin
    perform public.guardar_entrenamiento(v_sesion, date '2000-01-03', null::uuid, 'intruso', null, null,
      jsonb_build_array(jsonb_build_object('exercise_id', v_ej1, 'set_no', 1, 'reps', 1)), null::uuid);
  exception when raise_exception then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 30: un ajeno pudo editar mi entrenamiento con la función'; end if;

  -- ===== Sin sesión (rol anónimo) =====
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  fallo := false;
  begin
    select count(*) into n from public.workout_sessions;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 31: el acceso anónimo pudo leer entrenamientos'; end if;
  fallo := false;
  begin
    select count(*) into n from public.meals;
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 32: el acceso anónimo pudo leer comidas'; end if;
  fallo := false;
  begin
    perform public.guardar_entrenamiento(null::uuid, date '2000-01-06', null::uuid, null, null, null,
      jsonb_build_array(jsonb_build_object('exercise_id', v_ej1, 'set_no', 1, 'reps', 1)), null::uuid);
  exception when insufficient_privilege then fallo := true;
  end;
  if not fallo then raise exception 'FALLO 33: el acceso anónimo pudo ejecutar guardar_entrenamiento'; end if;

  -- ===== De vuelta yo: borrar una rutina conserva el historial =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', yo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.routines where id = v_rutina;
  select count(*) into n from public.routine_exercises where routine_id = v_rutina;
  if n <> 0 then raise exception 'FALLO 34: al borrar la rutina quedaron sus ejercicios (%)', n; end if;
  select count(*) into n from public.workout_sessions where id = v_sesion and routine_id is null and routine_name = 'prueba-rutina';
  if n <> 1 then raise exception 'FALLO 35: al borrar la rutina se alteró el historial del entrenamiento (%)', n; end if;
  select count(*) into n from public.workout_sets where session_id = v_sesion;
  if n <> 1 then raise exception 'FALLO 36: al borrar la rutina se perdieron series del historial (%)', n; end if;

  -- ===== Limpieza =====
  reset role;
  delete from public.meals where description = 'prueba-comida' and user_id = yo;
  delete from public.workout_sessions where notes = 'prueba-rls' and user_id = yo;       -- borra sus series en cascada
  delete from public.routines where name like 'prueba-%' and user_id = yo;
  delete from public.exercises where name like 'prueba-%' and user_id = yo;
  delete from public.habit_logs where habit_id = v_habito;
  delete from public.habit_definitions where id = v_habito;
end $$;
