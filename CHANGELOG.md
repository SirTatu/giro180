# Changelog

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
