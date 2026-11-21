# TODO

## Etapa 1 — cerrada
- [x] Repo, Pages, Supabase, RLS probado, login en PC e iPhone

## Etapa 2A — cerrada
- [x] Núcleo, registro diario, hábitos (probado)

## Etapa 2B — Prioridades, objetivos, dashboard — cerrada
- [x] Probada y confirmada por el usuario

## Etapa 2C — Revisión semanal e informes
- [x] 2C-0 Núcleo de informes y pruebas (entregado; solo lógica, sin pantalla)
- [x] 2C-1 Pestaña «Semana»: revisión semanal + comparación (probada y confirmada por el usuario)
- [x] 2C-2 Pestaña «Informes»: seis informes en Markdown, botón copiar, guardar en saved_reports (probada y confirmada por el usuario)
- [x] 2C-3 Exportación JSON/CSV de todos los datos (confirmada por el usuario)

## Etapa 3 — Gym y Nutri
- [x] 3-0 Migración SQL 003 (tablas) + prueba de seguridad 004 (ejecutadas y confirmadas por el usuario)
- [x] 3-1 Gym: ejercicios y rutinas + importador (v0.9.0; el usuario continuó al 3-2)
- [x] 3-2 Gym: registrar entrenamiento, historial y progresión (v0.10.0; confirmado por el usuario)
- [x] 3-3 Gym: pasos y evolución corporal (v0.11.0; confirmado por el usuario)
- [ ] 3-4 Nutri
  - [x] 3-4a Comidas y proteína por comida + cierre del día (v0.12.0; confirmado por el usuario)
  - [ ] 3-4b Agua (meta en litros; carga en ml o L; botones rápidos y botellas configurables, migración 005) y Cuerpo en Nutri (v0.13.0, entregado; falta que el usuario lo pruebe)
- [ ] 3-5 Informes: sumar Gym y Nutri al INFORME GENERAL, indicadores, notas de especialistas y Panel
- Decisiones abiertas para el hito indicado:
  - 3-1: las rutinas NO van escritas en el código (el repo es público); se cargan pegando el texto en la app. Los ejercicios de nombre parecido los decide el usuario en la vista previa.
  - Ejercicio salteado: hoy no deja rastro (no hay filas). Si más adelante se quiere distinguir «salteado» de «no cargado», requiere una migración.
  - 3-4: decidido: la proteína del día se suma de las comidas; sin cierre explícito, por debajo de la meta es «sin completar»; «Cerrar el día» es manual; el agua sigue la misma regla (3-4b).
  - Borrar un entrenamiento NO desmarca el hábito «Entrenar» de ese día (se corrige en Hoy). Evaluar si conviene automatizarlo.

## Ideas / pendientes
- Agua: no hay orden manual de botellas (van por nombre); no se guarda la hora de cada toma más allá de su fecha de creación
- Agua: el hábito se crea a mano en Central → Hábitos (módulo Nutri, tipo cantidad, nombre con «Agua», unidad L)
- Nutri → Cuerpo importa la pantalla desde `modules/gym/cuerpo.js`; si crece, moverla a `compartido/`
- Nutri: un día cerrado no se recalcula solo al cambiar comidas (hay que reabrir y cerrar de nuevo)
- Nutri: el hábito de proteína se crea a mano en Central → Hábitos (módulo Nutri, tipo cantidad, nombre con «Proteína»)
- Nutri: el historial lee como máximo 1000 comidas por consulta y avisa si se llega al límite
- Importar / restaurar desde el JSON exportado (hoy la exportación es solo copia de seguridad de lectura)
- Al crear tablas nuevas en cada etapa: sumarlas a `TABLAS_EXPORT` (js/core/exportar.js); la prueba automática avisa si se olvida
- Pasos: crear el hábito de pasos desde la propia pestaña (hoy hay que crearlo en Central → Hábitos)
- Cuerpo: la tendencia se calcula con las mediciones de los últimos 180 días + 14; no hay vista de todo el historial
- Registro de entrenamientos: un solo entrenamiento por día en la pantalla; permitir varios si hace falta
- Orden de los ejercicios al editar un día guardado (la base no guarda el orden): hoy sigue el de la rutina y los extras al final
- Importar rutinas de forma atómica (función SQL) en lugar de rutina por rutina con reversión
- Asignar grupo muscular a varios ejercicios a la vez
- Cola de registro sin conexión (mejora futura)
- Versión atómica de hábitos vía función SQL (hoy son 2 pasos con reversión)
