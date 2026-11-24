# Changelog

## 0.18.0 — Etapa 3, ampliación 3-6c1 (objetivos con máximo y estado «excedido»)
- **Migración SQL 009** (`sql/009_excedido.sql`) y su prueba `sql/010_test_rls_excedido.sql` (15 comprobaciones). Agrega a `habit_definitions` la columna opcional `target_max` (máximo del objetivo) y permite un tercer estado, `exceeded`, en `habit_logs`. No borra ni cambia nada: todos tus hábitos y registros quedan exactamente igual. **Orden obligatorio:** exportar respaldo → ejecutar 009 → ejecutar 010 (con tu User UID) → recién ahí subir los archivos de la app.
- **Objetivos con rango:** «al menos X» (como siempre: solo mínimo), «como máximo Y» (mínimo 0 y máximo Y) y «entre X e Y». Con máximo, `evaluar` da `exceeded` si te pasás, `done` entre el mínimo y el máximo (inclusive) y `missed` por debajo del mínimo. **Sin máximo todo se comporta exactamente igual que antes** (nunca da «excedido»).
- **Estado «excedido»** (quinto estado, en `estados.js`): cuenta como **registrado**, pero **no como no cumplido** y queda **fuera del porcentaje** (ni lo sube ni lo baja). Se muestra aparte: Central → Hoy (insignia «Excedido» y el objetivo), Semana y Panel (aviso con la cantidad de días excedidos y detalle por hábito), y los Informes (INFORME GENERAL sin pasar de 15 líneas, indicadores por área, notas para especialistas, comparación y registro diario con el objetivo). La foto semanal guardada incluye los excedidos.
- **Central → Hábitos**: el formulario suma el campo «Máximo (opcional)»; la lista muestra el objetivo («entre 1500 y 2000 kcal», «como máximo 2200 kcal», «120 g o más»). Al editar un hábito (también con historial, que crea una versión nueva) el máximo se **conserva**; antes de este cambio se habría perdido en silencio. Se acepta meta 0 solo si hay máximo («como máximo»).
- Nutri: las pantallas de proteína y agua reconocen «excedido» (todavía no hay objetivos con máximo en Nutri: llegan en el 3-6c2).
- `tests/excedido.test.mjs` (20 pruebas) y `tests/sql.test.mjs` (ahora cubre también 009/010 y que 009 solo agrega). Total: 161 pruebas.
- Service Worker v0.18.0.

## 0.17.0 — Etapa 3, ampliación 3-6b (comidas con alimentos y las 4 macros)
- Sin migración SQL: usa las columnas de `meals` que agregó la 007.
- **Nutri → Hoy** tiene dos formas de cargar una comida:
  - **Con alimento**: buscás y elegís un alimento de tu base, ponés la cantidad en gramos o ml, o en **porciones** (por ejemplo «2» de «1 huevo = 50 g»), y ves en vivo las calorías, carbos, proteínas y grasas antes de guardar. Los alimentos archivados no aparecen.
  - **A mano**: descripción y las 4 macros, todas opcionales; lo que dejás vacío queda como «sin dato» (NULL), nunca 0.
- **Macros del día**: calorías, carbohidratos, proteínas y grasas (2 × 2), sumando solo lo cargado; sin datos muestran «—», y avisa «N comidas sin dato de …» por cada macro con faltantes. Cada comida de la lista muestra su cantidad y sus macros.
- La comida guarda una **foto**: nombre, cantidad y macros calculadas. Si después cambiás o borrás el alimento, lo ya cargado no se altera.
- **Editar**: una comida de alimento se edita solo por cantidad y las macros se recalculan proporcionalmente desde lo guardado (para cambiar de alimento se borra y se carga de nuevo); una comida a mano se edita completa.
- La meta de **proteína** sigue funcionando igual, ahora también con comidas de alimentos. Los objetivos de calorías, carbos y grasas llegan en el 3-6c; Historial, Informes y Panel siguen midiendo proteína hasta entonces.
- Protecciones: un doble toque agrega una sola comida; una cantidad que daría más de lo que acepta la base se frena antes con un mensaje claro; si no se pueden leer los alimentos, Hoy abre en modo «A mano» y avisa.
- `js/core/alimentos.js` suma `validarComidaManual`, `opcionesCantidad`, `calcularCantidad`, `comidaDeAlimento`, `reescalarComida`, `totalesMacros`, `textoMacrosComida` y `avisosMacros`. Se retiró `validarComida` de `nutri.js` (la reemplaza `validarComidaManual`). 8 pruebas nuevas; total: 141. Estilo `.metricas.cuatro` en `css/components.css`.
- Service Worker v0.17.0.

## 0.16.0 — Etapa 3, ampliación 3-6a (base de alimentos)
- **Migración SQL 007** (`sql/007_alimentos.sql`) y su prueba de seguridad `sql/008_test_rls_alimentos.sql` (26 comprobaciones). Crea `foods` (alimentos con calorías, carbohidratos, proteínas y grasas **por 100 g o por 100 ml**) y `food_portions` (porciones con nombre, por ejemplo «1 huevo» = 50 g), ambas con RLS y exportables. Agrega a `meals` columnas OPCIONALES para las otras macros y la foto del alimento (`calories_kcal`, `carbs_g`, `fat_g`, `food_id`, `food_name`, `amount`). No borra ni cambia ningún dato: las comidas anteriores quedan igual y lo que no se cargó es NULL («sin dato»), nunca 0. **Orden obligatorio:** exportar respaldo → ejecutar 007 → ejecutar 008 (con tu User UID) → recién ahí subir los archivos de la app.
- Pestaña **Alimentos** en Nutri: alta, edición y archivo de alimentos; porciones con nombre por alimento (alta y borrado); búsqueda sin distinguir mayúsculas ni tildes. Las 4 macros son obligatorias en un alimento (si es cero se escribe 0). Rechaza valores negativos, calorías de más de 1000 por 100 g y macros que suman más de 100 g por cada 100 g. Si las calorías no coinciden con las macros (4·C + 4·P + 9·G) avisa, pero deja guardar. Los nombres repetidos se rechazan con mensaje claro.
- Nuevo `js/core/alimentos.js` (validación, cálculo de macros por cantidad o porción, búsqueda) y `tests/alimentos.test.mjs` (10 pruebas). `tests/sql.test.mjs` ahora exige que cada migración nueva traiga su script de prueba (cubre cada tabla, usa el marcador de UID y numera FALLO 1..N) y que 007 no borre ni modifique datos. Total: 133 pruebas.
- Todavía NO se usan los alimentos al registrar comidas (3-6b) ni hay objetivos por macro (3-6c): esta versión solo arma la base.
- Service Worker v0.16.0.

## 0.15.1 — Cierre de la Etapa 3 (sin cambios funcionales)
- La app no cambia: mismo código que la 0.15.0. Se sube la versión solo para que el Service Worker refresque su caché junto con el cierre.
- `sql/004_test_rls_gym_nutri.sql` ya no trae tu User UID real escrito: usa el marcador `PEGAR-AQUI-TU-USER-UID` (como 002 y 006). Si volvés a ejecutarla, pegá tu UID en la línea `yo uuid := ...`. El UID viejo sigue visible en el historial de commits de GitHub; no es una clave y RLS lo protege, pero no es dato para un repo público.
- README y TODO actualizados: Etapa 3 cerrada, próxima etapa por definir. Se unificaron notas repetidas en «Ideas / pendientes».
- Auditoría de coherencia: `sw.js` lista todos los archivos de la app y ninguno falta; las 19 tablas creadas por SQL están exportadas y documentadas en DATABASE.md; los módulos importan sin errores aun sin las copias viejas de `js/core/`; 121 pruebas en verde.

## 0.15.0 — Etapa 3, hito 3-5b (Panel con Gym y Nutri)
- El **Panel** de Central suma la tarjeta **Gym y Nutri** con tres números de un vistazo: entrenos registrados esta semana (lunes a hoy), proteína de hoy contra su meta y agua de hoy contra su meta. Debajo, notas cortas: faltan X g o X L, meta cumplida, día cerrado, comidas sin proteína cargada y, si existe el hábito Entrenar, cuántos días programados se cumplieron. Sin migración SQL.
- Mismas reglas que en Nutri: por debajo de la meta es «sin completar» (nunca incumplido); sin comidas o sin tomas hoy se muestra «—», no 0 g ni 0 ml; «0 entrenos registrados» es un conteo de registros, no un incumplimiento.
- Lectura opcional: si no se pueden leer los entrenamientos, las comidas o el agua, ese número queda en «—», el panel lo avisa («No se pudo leer: …») y todo lo demás sigue funcionando. Si fallan los hábitos (lo esencial) se muestra el error de siempre.
- Nuevas funciones `indicadoresPanel` y `textoPanel` en `js/core/areas.js` (6 pruebas nuevas en `tests/areas.test.mjs`). Total: 121 pruebas.
- Service Worker v0.15.0.

## 0.14.0 — Etapa 3, hito 3-5a (Informes con datos reales de Gym y Nutri)
- Los informes ya no usan solo hábitos: leen entrenamientos, pasos, peso y cintura, comidas y agua. Sin migración SQL.
- **INFORME GENERAL** (siempre 15 líneas o menos): la línea de Gym suma entrenos (con el período anterior), pasos por día y peso; la de Nutri suma proteína y agua por día. No agrega líneas: va en la misma línea del área. Un área con datos reales aparece aunque no tenga hábitos programados.
- **Indicadores por área** y **notas para Gym y Nutri**: sesiones, series, volumen, progresión por ejercicio (cuántos mejoraron, bajaron, igual o sin base, con los 3 principales), pasos, peso y cintura (último valor, promedio de 7 días, cambio en 30 días), proteína y agua con meta y mejor día, y días con comidas sin proteína cargada. La nota de Gym conserva la regla fija de 5 días.
- **Comparación semanal** y **Registro diario**: líneas de entrenos, volumen, pasos, proteína, agua y peso; el diario muestra solo lo cargado ese día.
- Reglas: promedios solo sobre días con dato; sin base de comparación no es 0; un dato que no se cargó dice «sin registrar»; uno que no se pudo leer dice «no se pudieron leer» (en pantalla y en el texto) y no bloquea el resto. Si fallan los hábitos (lo esencial) se muestra el error con Reintentar, como antes.
- Nuevo `js/core/areas.js` y `tests/areas.test.mjs` (15 pruebas). `informes.js` acepta datos opcionales: sin ellos, los textos son idénticos a los de la 0.13. Total: 115 pruebas.
- Service Worker v0.14.0.

## 0.13.0 — Etapa 3, hito 3-4b (Nutri: agua, botellas y Cuerpo)
- **Migración SQL 005** (`sql/005_agua.sql`) y su prueba de seguridad `sql/006_test_rls_agua.sql` (16 comprobaciones). Dos tablas nuevas con RLS: `water_containers` (botellas con su volumen en ml; se archivan, no se borran) y `water_intakes` (una fila por toma; guarda una foto del nombre de la botella). Se suman a la exportación. **Orden obligatorio:** exportar respaldo → ejecutar 005 → ejecutar 006 (con tu User UID) → recién ahí subir los archivos de la app.
- Pestaña **Agua**: botones rápidos (+250 ml, +500 ml, +1 L), un botón por cada botella tuya (un toque suma su volumen) y «otra cantidad» en **ml o L** (0,5 L = 500 ml). Total del día contra la meta, cuánto falta y la lista de tomas, con «Deshacer / borrar» en la última. Se puede cargar cualquier fecha.
- Pestaña **Botellas**: alta, edición y archivo de recipientes (botella de la oficina, de casa, del gym, jarra, vaso, termo de mate...), con el volumen en ml o L. Cambiar o archivar una botella no altera las tomas ya cargadas.
- **Meta en litros**: es un hábito de cantidad del módulo Nutri con «Agua» en el nombre y unidad «L» (también acepta «ml»), creado en Central → Hábitos. El registro del día se guarda en la unidad del hábito (por ejemplo 2,5 en L).
- Mismo cierre del día que la proteína: por debajo de la meta es «sin completar» (nunca incumplido solo); al llegar se marca cumplido automático (`note = 'auto-agua'`) y se quita si dejás de llegar; «Cerrar el día» y «Reabrir el día» son a mano (`note = 'cierre-dia'`); un cierre no se modifica solo.
- **Decisión que cambió:** antes se había dicho que el agua no tenía tabla. Hace falta guardar las tomas para poder tener un día «sin completar» sin escribir un incumplimiento (`habit_logs` solo admite cumplido o incumplido) y para poder deshacer una toma. La meta sigue siendo un hábito.
- **Historial** de Nutri: ahora trae proteína y agua (cumplidos, incumplidos, sin completar, promedio solo sobre días con dato, mejor día) y los días con datos, con «Ver comidas» y «Ver agua».
- Pestaña **Cuerpo** en Nutri: es la misma pantalla de Gym (peso y cintura en `body_measurements`, una sola fuente).
- Nuevo `js/core/agua.js` y `tests/agua.test.mjs` (9 pruebas); `tests/sql.test.mjs` suma una prueba que exige que 006 cubra las tablas de 005 (la de exportación ya avisaba). Total: 100 pruebas. `traducirError` reconoce el nombre de botella repetido.
- Service Worker v0.13.0.

## 0.12.0 — Etapa 3, hito 3-4a (Nutri: comidas y proteína)
- Módulo **Nutri** con dos pestañas: **Hoy** e **Historial** (agua y Cuerpo llegan en el 3-4b). Sin migración SQL: usa la tabla `meals` de la 003 y `habit_logs`.
- Hoy: elegís fecha, cargás comidas (tipo, qué comiste, proteína opcional), editás y borrás. Muestra el total de proteína contra la meta de ese día y cuánto falta. Una comida sin proteína queda como **NULL (no cargada)**, nunca 0 g, y la pantalla avisa cuántas comidas quedaron sin proteína.
- Meta: hábito de cantidad del módulo Nutri con «Proteína» en el nombre (unidad g), que creás en Central → Hábitos. Sin ese hábito se pueden cargar comidas igual y la pantalla explica cómo crearlo. El hábito de agua no se confunde con el de proteína (búsqueda estricta por nombre).
- **Cierre del día** (decisión aprobada): mientras el día está abierto y estés por debajo de la meta es «sin completar» (para `estados.js` sigue siendo «no registrado»); nunca se marca incumplido solo. Al llegar a la meta se marca **cumplido automáticamente** (`habit_logs.note = 'auto-proteina'`); si después editás o borrás comidas y dejás de llegar, ese marcado se quita. «Cerrar el día» (a mano) deja cumplido o incumplido contra la meta vigente (`note = 'cierre-dia'`). Si hay comidas sin proteína pide confirmación; sin comidas, o sin ninguna proteína cargada, no deja cerrar; los días futuros no se cierran. «Reabrir el día» borra el cierre y recalcula.
- Un registro que no sea el automático (un cierre, o uno cargado desde Central → Hoy) la app **no lo modifica sola**: en un día cerrado, cambiar comidas no cambia el cierre hasta que reabras.
- Historial: 7 o 30 días con cumplidos, incumplidos, sin completar, cumplimiento, promedio de proteína **solo sobre días con proteína cargada**, mejor día y lista de días con comidas (con «Ver / editar»).
- Nuevo `js/core/nutri.js` (lógica pura), `js/modules/compartido/habitos.js` (hábitos y registros fuera de Central), `js/modules/nutri/` y `tests/nutri.test.mjs` (9 pruebas). `buscarHabitoDeGym` ahora se apoya en `buscarHabitoDeModulo` (mismo comportamiento para Gym). Total: 90 pruebas.
- Service Worker v0.12.0.

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
