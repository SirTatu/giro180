# Changelog

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
