# Changelog

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
