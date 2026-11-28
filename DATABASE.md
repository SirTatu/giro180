# Base de datos (migración 001)

## Regla de los 4 estados
| Estado | Cómo se representa |
|---|---|
| Cumplido | fila en `habit_logs` con `status = 'done'` |
| Incumplido | fila en `habit_logs` con `status = 'missed'` |
| No registrado | **no hay fila** (nunca cuenta como incumplimiento) |
| Sin actividad programada | se calcula con `habit_definitions.scheduled_days` de la versión vigente ese día |

## Historial inmutable
`habit_definitions` es versionada (`series_id`, `valid_from`, `valid_to`). Cambiar una meta = cerrar
la versión vieja y crear otra. El `status` se guarda al registrar, contra la meta vigente ese día.

## Tablas
user_settings · habit_definitions · habit_logs · goals · priorities (máx. 3 activas, por trigger) ·
daily_entries · weekly_reviews · saved_reports · appointments · body_measurements ·
decision_log (solo agregar).

## Hábitos bloqueados (`locked = true`)
Un trigger impide editarlos o borrarlos. Para un cambio deliberado, en SQL Editor:
1. `select set_config('giro180.allow_locked_change','on', true);` (misma ejecución que el cambio)
2. Hacer el cambio.
3. Registrarlo en `decision_log`.
La app no ofrece este camino: es una barrera contra cambios accidentales o automáticos.

## Etapa 3: Gym y Nutri (migración 003)
Tablas: `exercises` (catálogo; se archivan, no se borran), `routines` (`weekday` es solo el día sugerido), `routine_exercises`
(series × rango de repeticiones, ej. 4 × 6-8; un mismo ejercicio puede tener objetivos distintos en rutinas distintas),
`workout_sessions` (un entrenamiento; `routine_name` es foto del nombre), `workout_sets` (una fila por serie realizada; las columnas
`target_*` son la foto del objetivo vigente al registrar) y `meals` (comidas; `protein_g` NULL = no cargada, no es 0).
Pasos y agua NO tienen tabla: son hábitos de cantidad (Hábitos). Peso y cintura usan `body_measurements` (una sola fuente para Gym y Nutri).
Historial: borrar una rutina deja los entrenamientos (su `routine_id` pasa a null); un ejercicio con series no se puede borrar.
`guardar_entrenamiento(...)`: guarda o reemplaza un entrenamiento y sus series de forma atómica; con `p_habit_id` marca ese día como
cumplido en `habit_logs` (si el día ya tenía registro, lo pasa a «cumplido»). Borrar un entrenamiento no desmarca el hábito.
Cómo aplicarla: exportar respaldo → ejecutar `003_gym_nutri.sql` → ejecutar `004_test_rls_gym_nutri.sql` (con tu User UID) → subir la app.
No hay PostgreSQL en el entorno de desarrollo: `tests/sql.test.mjs` solo hace un chequeo estático; la prueba real es el script 004 en Supabase.

## Exportación
La lista de tablas exportables está en `js/core/exportar.js` (`TABLAS_EXPORT`, con su columna de orden para paginar).
Cada migración que cree una tabla debe sumarla ahí; `tests/exportar.test.mjs` lee `sql/` y falla si falta alguna.

## Informes guardados (`saved_reports`)
Se inserta una fila por cada vez que tocás «Guardar» en la pestaña Informes (no se sobrescribe: guardar dos veces crea dos filas).
`report_type`: `general`, `diario`, `semanal`, `comparacion`, `areas` o `nota_<especialista>` (por ejemplo `nota_gym`).
`period_start`/`period_end` son el período del informe (en el diario, la misma fecha). `content` es el texto Markdown exacto.

## Revisión semanal (`weekly_reviews`)
Una fila por semana (`week_start` = lunes, único por usuario). `summary` y `decisions` son texto tuyo;
`indicators` es una **foto** en JSON de los indicadores al momento de guardar (se sobrescribe si volvés a guardar esa semana).
La pestaña «Semana» siempre recalcula los números desde los registros: la foto sirve como historial.

## Pendiente
Tablas de Estudio y Derma: se crean en su etapa (las de Gym, Nutri y Vida ya existen).

## Historial de decisiones: qué se anota solo
La app agrega una fila a `decision_log` al: crear o cerrar una prioridad; crear, modificar, lograr, descartar o reactivar un objetivo.
Las modificaciones de objetivos guardan qué cambió (título y fecha objetivo, antes → después).
`decision_log` no permite editar ni borrar (solo select e insert).

## Nutri: comidas, proteína y cierre del día (v0.12.0, sin migración)
`meals`: una fila por comida; `protein_g` NULL = no cargada. La meta de proteína es un hábito de cantidad (módulo Nutri, nombre con «Proteína», unidad g).
El registro del día en `habit_logs` guarda en `value` el total de proteína y en `note` quién lo decidió: `auto-proteina` (llegó a la meta, lo marca la app y puede quitarlo si dejás de llegar) o `cierre-dia` (cierre manual). Cualquier otro registro se trata como decisión manual.

## Agua (migración 005, v0.13.0)
`water_containers`: botellas (`name` único sin distinguir mayúsculas, `volume_ml` 1 a 20000, `archived`). `water_intakes`: una fila por toma (`drunk_on`, `ml` 1 a 10000, `container_id` que pasa a null si se borra la botella y `container_name` como foto). El total del día es la suma; sin tomas = no registrado, nunca 0.
La meta es un hábito de cantidad (Nutri, «Agua», unidad L o ml). Su registro en `habit_logs.value` va en la unidad del hábito; `note` = `auto-agua` o `cierre-dia`.
Cómo aplicarla: exportar respaldo → ejecutar `005_agua.sql` → ejecutar `006_test_rls_agua.sql` (con tu User UID) → subir la app.

## Alimentos y macros (migración 007, v0.16.0)
`foods`: alimentos con `kcal_100`, `carbs_100`, `protein_100`, `fat_100` (las 4 obligatorias, por 100 g o 100 ml según `base_unit`); la suma de carbos + proteínas + grasas no puede pasar de 100,5; nombre único sin distinguir mayúsculas; se archivan. `food_portions`: porciones con nombre (`amount` en g o ml), únicas por alimento; se borran con el alimento.
`meals` suma columnas OPCIONALES (NULL = sin dato): `calories_kcal`, `carbs_g`, `fat_g`, `food_id` (pasa a NULL si se borra el alimento), `food_name` y `amount` (fotos de lo comido). Las comidas anteriores quedan como estaban.
Cómo aplicarla: exportar respaldo → ejecutar `007_alimentos.sql` → ejecutar `008_test_rls_alimentos.sql` (con tu User UID) → subir la app.

## Objetivos con máximo y estado «excedido» (migración 009, v0.18.0)
`habit_definitions.target_max` (numeric, opcional): máximo del objetivo. Reglas: solo en hábitos de cantidad o duración, con meta (`target_value`), mayor que 0 y no menor que la meta. «Al menos X» = X sin máximo; «como máximo Y» = meta 0 y máximo Y; «entre X e Y» = los dos.
`habit_logs.status` ahora admite `done`, `missed` y `exceeded` (se pasó del máximo). `exceeded` cuenta como registrado, no como no cumplido y queda fuera del porcentaje de cumplimiento.
Cómo aplicarla: exportar respaldo → ejecutar `009_excedido.sql` → ejecutar `010_test_rls_excedido.sql` (con tu User UID) → subir la app.

## Sueño (migración 011, v0.21.0)
`sleep_sessions`: una fila por registro de sueño. `kind` (`night` o `nap`, por defecto `night`), `started_at` (obligatorio) y `ended_at` (instantes con zona; vacío = en curso), `note` opcional de hasta 500 caracteres. Reglas en la base: `ended_at` posterior a `started_at` y a lo sumo 24 horas después (`sleep_sessions_fin_ck`); **un solo registro en curso por usuario** (índice único parcial `sleep_sessions_abierta_uq`, donde `ended_at` es null). La no-superposición entre registros NO la garantiza la base: la valida la app.
Un registro cuenta para el día de Argentina en que terminó; un día sin filas es «sin dato», nunca 0 horas. Un día puede tener varias filas (noche + siestas).
Cómo aplicarla: exportar respaldo → ejecutar `011_sueno.sql` → ejecutar `012_test_rls_sueno.sql` (con tu User UID, antes de usar el sueño en la app) → subir la app.
