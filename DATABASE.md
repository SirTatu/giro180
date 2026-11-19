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

## Informes guardados (`saved_reports`)
Se inserta una fila por cada vez que tocás «Guardar» en la pestaña Informes (no se sobrescribe: guardar dos veces crea dos filas).
`report_type`: `general`, `diario`, `semanal`, `comparacion`, `areas` o `nota_<especialista>` (por ejemplo `nota_gym`).
`period_start`/`period_end` son el período del informe (en el diario, la misma fecha). `content` es el texto Markdown exacto.

## Revisión semanal (`weekly_reviews`)
Una fila por semana (`week_start` = lunes, único por usuario). `summary` y `decisions` son texto tuyo;
`indicators` es una **foto** en JSON de los indicadores al momento de guardar (se sobrescribe si volvés a guardar esa semana).
La pestaña «Semana» siempre recalcula los números desde los registros: la foto sirve como historial.

## Pendiente
Tablas de Gym, Nutri, Vida, Estudio y Derma: se crean en su etapa (migraciones 002+ de datos).

## Historial de decisiones: qué se anota solo
La app agrega una fila a `decision_log` al: crear o cerrar una prioridad; crear, modificar, lograr, descartar o reactivar un objetivo.
Las modificaciones de objetivos guardan qué cambió (título y fecha objetivo, antes → después).
`decision_log` no permite editar ni borrar (solo select e insert).
