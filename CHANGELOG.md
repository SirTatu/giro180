# Changelog

## 0.11.0 — Etapa 3, hito 3-3 (Gym: pasos y evolución corporal)
- Pestañas nuevas en Gym: **Pasos** y **Cuerpo**. Sin migración SQL.
- Pasos: son un hábito de cantidad (módulo Gym, tipo cantidad, nombre con «paso»); se registra en `habit_logs` igual que en Central → Hoy y el status se evalúa contra la meta vigente ese día. Si todavía no existe el hábito, la pantalla explica cómo crearlo en Central → Hábitos (no se crea solo). Muestra la meta, el estado del día (los cuatro estados, decididos por `estados.js`), resumen de 7 y 30 días (cumplidos, incumplidos, sin registrar, % sobre días registrados, cobertura, promedio y mejor día) y los últimos 14 días. Los días sin registro NO cuentan como 0 en el promedio y NO son incumplimiento. Se puede editar cualquier día y quitar un registro.
- Cuerpo: peso y cintura en `body_measurements` (una fila por día, una sola fuente para Gym y Nutri; el acceso a datos quedó en `js/modules/compartido/medidas.js` para que Nutri lo reutilice). Alta, edición y borrado por fecha, con peso o cintura (alcanza con uno).
- Tendencia en números, sin gráficos: última medición (y hace cuántos días), promedio de los últimos 7 días contra los 7 anteriores, cambio en el período (30/90/180 días) con mínimo y máximo, ritmo semanal estimado (regresión lineal; solo con 3+ mediciones que abarquen 7+ días), promedio por semana con su cambio. Todo lo que no se puede calcular por falta de datos dice «no hay base de comparación» o «sin datos suficientes»; nunca 0.
- Nuevo `js/core/cuerpo.js` (lógica pura) y `tests/cuerpo.test.mjs` (8 pruebas). `buscarHabitoEntrenar` se generalizó a `buscarHabitoDeGym` (en `entrenos.js`) y se usa también para Pasos. Total: 79 pruebas.
- Service Worker v0.11.0.

## 0.10.0 — Etapa 3, hito 3-2 (Gym: registrar entrenamientos, historial y progresión)
- Pestañas nuevas en Gym: **Entrenar** (ahora la pantalla inicial) e **Historial**. Sin migración SQL: usa las tablas y la función `guardar_entrenamiento` de la 003.
- Entrenar: elegís fecha (por defecto hoy) y la rutina se sugiere según el día de la semana. Cada ejercicio muestra su objetivo (series × repeticiones) y «la última vez» (peso y repeticiones de cada serie). Cargás peso (acepta coma decimal) y repeticiones de **cada serie**, con totales en vivo por ejercicio y del día: series, repeticiones y volumen (peso × repeticiones).
- La última vez se muestra como sugerencia gris (placeholder) y con el botón «Copiar la última vez»: nunca se guarda como dato sin que lo confirmes. Una serie con todo vacío no cuenta.
- Solo por ese día podés: **reemplazar** un ejercicio por otro, **saltearlo** o **agregar un ejercicio extra**. La rutina no se modifica. Un ejercicio salteado simplemente no deja series (no es un incumplimiento ni un estado nuevo).
- Series sin peso (peso corporal): cuentan en series y repeticiones, no suman al volumen, y se avisa cuántas son.
- Guardar usa `guardar_entrenamiento` (una transacción) y marca el hábito «Entrenar» de ese día como cumplido (día no programado = extra). El hábito se identifica sin tocar el bloqueado: hábito de Gym de tipo sí/no, preferentemente con nombre «entrenar/gimnasio» y luego el bloqueado; se usa la **versión vigente ese día**. Si no lo encuentra, el entrenamiento se guarda igual y la pantalla avisa que no se marcó nada.
- Editar un día ya guardado reemplaza la sesión (no duplica). Al editar, el objetivo de cada ejercicio sale de la foto guardada en sus series, no de la rutina actual, así volver a guardar no reescribe el historial. Se asume un entrenamiento por día en la pantalla (si hubiera más, se edita el más reciente).
- Historial: período (30/90/180 días), resumen por semana (lunes a domingo), progresión por ejercicio (series, mejor serie, volumen y cambio de volumen contra la vez anterior; la primera dice «sin base de comparación»), lista de entrenamientos con detalle, Editar y Borrar. Borrar un entrenamiento NO desmarca el hábito.
- Nuevo `js/core/entrenos.js` con toda la lógica (números, validación, totales, bloques, última vez, semana, progresión, hábito) y `tests/entrenos.test.mjs` (14 pruebas). Total: 71 pruebas.
- Service Worker v0.10.0.

## 0.9.0 — Etapa 3, hito 3-1 (Gym: ejercicios, rutinas e importador)
- Módulo Gym con tres pestañas: **Rutinas**, **Ejercicios** e **Importar** (el registro de entrenamientos llega en el 3-2). Sin migración SQL.
- Rutinas: crear, renombrar, día sugerido, notas, archivar/desarchivar; dentro de cada rutina, agregar ejercicios (del catálogo o creándolos ahí mismo), cambiar de ejercicio, editar series × repeticiones mín./máx. y nota, reordenar (↑ ↓) y quitar. Cambiar o quitar no altera lo ya registrado (cada serie y sesión guardan su foto).
- Ejercicios: alta, edición, grupo muscular (se cambia directo desde la lista), archivar/desarchivar, buscador y filtros.
- Importar desde texto pegado: parser puro (`js/core/gym.js`), vista previa **editable** y recién ahí se guarda. Una línea de título por rutina (con el día) y un ejercicio por línea («nombre 4 x 6-8»). Soporta viñetas, «×», rangos con guion o «a», y formato en una línea separado por «·». Alternativas («o», «(o …)») quedan como nota. Lo que no entiende se lista como error: nunca se descarta en silencio.
- Unificación de ejercicios: coincidencia exacta o con error de tipeo → se une con el existente (marcado para revisar); nombre que contiene a otro → solo se sugiere, nunca se une solo. El nombre de la rutina es el título completo (evita choques entre dos rutinas del mismo grupo en días distintos).
- La importación no es atómica entre rutinas: si una falla, se deshace esa rutina y se informa cuáles ya se guardaron.
- Nueva `tests/gym.test.mjs` (14 pruebas, ejemplos inventados) y `tests/exportar.test.mjs` reescrita (8 pruebas; la anterior no estaba en el repo).
- Service Worker v0.9.0.

## 0.8.0 — Etapa 3, hito 3-0 (migración de Gym y Nutri, sin cambios visibles)
- `sql/003_gym_nutri.sql`: tablas `exercises`, `routines`, `routine_exercises`, `workout_sessions`, `workout_sets` y `meals`, con RLS (misma plantilla que 001) y trigger de `updated_at`.
- Función `guardar_entrenamiento`: guarda o reemplaza un entrenamiento con todas sus series en UNA transacción (o se guarda todo o nada) y, si se le pasa el hábito, marca ese día como cumplido en la misma transacción.
- Historial protegido: los ejercicios se archivan (no se borran), la sesión guarda una foto del nombre de la rutina y cada serie guarda una foto del objetivo vigente; borrar o cambiar una rutina no altera lo ya registrado.
- Proteína de las comidas: `NULL` = no cargada (dato faltante), nunca equivale a 0 g.
- `sql/004_test_rls_gym_nutri.sql`: 36 comprobaciones de seguridad y reglas (RLS, usuario ajeno y anónimo, restricciones, atomicidad, historial). No deja datos de prueba.
- Las 6 tablas nuevas se suman a la exportación (`TABLAS_EXPORT`).
- Nueva `tests/sql.test.mjs`: chequeo estructural estático de las migraciones (paréntesis, RLS en cada tabla, referencias, firma de revoke/grant, cobertura de la prueba de seguridad). No ejecuta el SQL.
- **Orden obligatorio al actualizar:** exportar respaldo → ejecutar 003 → ejecutar 004 → recién ahí subir los archivos de la app (la exportación nueva lee las tablas nuevas y falla si todavía no existen).
- Service Worker v0.8.0.

## 0.7.0 — Etapa 2C, hito 2C-3 (exportación de datos)
- Nueva tarjeta **Exportar tus datos** en Ajustes. Dos pasos: «Preparar exportación» lee todas las tablas y después se descarga (cada descarga nace de un toque nuevo, lo que exigen los navegadores móviles).
- **JSON completo** (copia exacta con conteos por tabla y versión de la app) y **CSV por tabla** pensado para Excel en español: separador «;», coma decimal y BOM UTF-8 (acentos correctos). Los textos que empiezan con = + - @ se prefijan con «'» en el CSV para que Excel no los ejecute como fórmulas; el JSON conserva el texto exacto.
- En celulares aparece además «Compartir…» (menú del sistema, permite «Guardar en Archivos»).
- **Lectura sin cortes silenciosos:** se pide el total exacto a la base y se sigue leyendo hasta completarlo (soporta el límite de 1000 filas por consulta y límites menores). Si falta el total o una página viene vacía, se cancela con error y no se genera ningún archivo.
- Nuevo `js/core/exportar.js` (lógica pura) con `TABLAS_EXPORT`. Una prueba automática lee `sql/` y falla si alguna tabla creada en una migración no está en la lista: así ninguna tabla futura (Gym, Nutri, Vida, Estudio, Derma) puede quedar fuera del backup sin que se note.
- 42 pruebas automáticas en total. Service Worker v0.7.0. Sin migración SQL.

## 0.6.0 — Etapa 2C, hito 2C-2 (pestaña «Informes»)
- Nueva pestaña **Informes** en Central con los seis informes en Markdown para pegar en los chats de ChatGPT: INFORME GENERAL (≤ 15 líneas), registro diario consolidado (elegís el día), resumen semanal, comparación con la semana anterior, indicadores por área y nota para un especialista (Central, Gym, Nutri, Vida, Pedagogo, Derma).
- Botón **Copiar** con tres caminos: portapapeles moderno, método alternativo y, si el navegador no deja, deja el texto seleccionado para copiarlo a mano.
- **Guardar** guarda el informe en `saved_reports`; la lista «Informes guardados» (últimos 20) permite verlos, copiarlos y eliminarlos.
- `armarInformes` en `js/core/informes.js` arma los seis textos juntos. Singular/plural correcto en los textos (`pl`: «1 día», «1 cumplido»), también en la pestaña Semana.
- `datos.js`: `listarInformes`, `guardarInforme`, `eliminarInforme`. Estilos nuevos al final de `css/components.css`. 30 pruebas automáticas en total.
- Service Worker v0.6.0. Sin migración SQL.

## 0.5.0 — Etapa 2C, hito 2C-1 (pestaña «Semana»: revisión semanal y comparación)
- Nueva pestaña **Semana** en Central: navegación entre semanas (no deja ir a semanas futuras), cumplimiento / registrado / sin registrar, comparación con la semana anterior (en curso: mismos días de ambas semanas), ánimo y energía, indicadores por área con cambio, detalle por hábito y prioridades que regían en esa semana.
- Revisión semanal: resumen y decisiones, guardadas en `weekly_reviews` (una fila por semana) junto con una foto JSON de los indicadores. Avisa si cambiás de semana con texto sin guardar.
- Una semana sin registros previos dice «no hay base de comparación» en lugar de mostrar 0 %.
- `datos.js`: `entradasEntre`, `leerRevision`, `guardarRevision`. `informes.js`: `prioridadesAl` y `fmtEscala` exportado. 28 pruebas automáticas en total.
- Service Worker v0.5.0. Sin migración SQL.

## 0.4.1 — Etapa 2C, hito 2C-0 (núcleo de informes, sin cambios visibles)
- Nuevo `js/core/informes.js` (lógica pura): períodos de semana (en curso = lunes a hoy contra el mismo tramo de la semana anterior; cerrada = semanas completas), comparación con deltas (`null` si falta algún dato, nunca 0), ánimo/energía, detalle por hábito, y los textos en Markdown de los seis informes (registro diario, resumen semanal, comparación, indicadores por área, nota por especialista, INFORME GENERAL ≤ 15 líneas con recorte garantizado).
- Los informes distinguen «sin hábitos definidos», «sin actividad programada» y «sin registros»: un dato faltante nunca se presenta como incumplimiento.
- `aIndicadores`: foto en JSON puro para guardar en `weekly_reviews.indicators`.
- 16 pruebas nuevas en `tests/informes.test.mjs` (26 en total). Todavía ninguna pantalla usa este núcleo.
- Service Worker v0.4.1.

## 0.4.0 — Etapa 2B (Central: panel, prioridades, objetivos, compromisos, decisiones)
- Panel (dashboard): prioridades vigentes, indicadores de hoy, semana en curso (total y por módulo), próximos compromisos, accesos rápidos.
- Pestaña Plan: prioridades (máx. 3 activas, control en la base), objetivos generales/específicos, compromisos, historial de decisiones.
- Anotación automática en el historial de decisiones al crear/cerrar prioridades y al crear, modificar, lograr, descartar o reactivar objetivos.
- Núcleo: `combinar` y `resumenGlobal` (suman conteos y recalculan %, no promedian porcentajes); `formatoFechaHora` (hora de Argentina). 10 pruebas.
- Service Worker v0.4.0.

## 0.3.0 — Etapa 2A (Central: núcleo, registro diario, hábitos)
- Núcleo lógico `js/core/`: fechas (zona Argentina), estados (cuatro estados), helper DOM seguro.
- Pruebas automáticas `tests/core.test.mjs` (7 pruebas): faltante != incumplido, historial inmutable ante cambios de meta.
- Central con pestañas: Hoy (registro rápido + ánimo/energía/notas), Hábitos (crear, corregir, versionar, archivar, bloquear), Ajustes (umbral de sueño).
- Hábitos con meta versionada: si la versión ya tiene registros, editar crea una versión nueva desde una fecha.
- `js/version.js` (la versión ya no vive en config.js). Service Worker v0.3.0.

## 0.2.0 — Etapa 1B
- Migración `sql/001_core.sql` (núcleo + RLS + triggers) y prueba `sql/002_test_rls.sql`.
- Login email/contraseña con Supabase, sesión persistente.
- Navegación con seis módulos (hash router): barra inferior en celular, lateral en escritorio.
- Central verifica sesión y conexión a la base.
- Service Worker actualizado (v0.2.0). Documentos ARCHITECTURE.md y DATABASE.md.

## 0.1.0 — Etapa 1A
- Estructura inicial, PWA mínima, íconos.
