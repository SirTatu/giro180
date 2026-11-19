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
- [ ] 3-0 Migración SQL 003 (tablas) + prueba de seguridad 004 (entregado; falta ejecutarlos en Supabase)
- [ ] 3-1 Gym: ejercicios y rutinas (incluye importar tus rutinas desde texto pegado)
- [ ] 3-2 Gym: registrar entrenamiento (precarga de la última vez), historial, progresión; marca el hábito «Entrenar» del día
- [ ] 3-3 Gym: pasos (hábito de cantidad) y evolución corporal (peso y cintura, tendencia en números)
- [ ] 3-4 Nutri: comidas con proteína por comida, agua, peso y cintura
- [ ] 3-5 Informes: sumar Gym y Nutri al INFORME GENERAL, indicadores, notas de especialistas y Panel
- Decisiones abiertas para el hito indicado:
  - 3-1: las rutinas NO van escritas en el código (el repo es público); se cargan pegando el texto en la app. Unificar ejercicios repetidos con nombres parecidos (jalón al pecho, press francés, elevaciones laterales) según indique el usuario.
  - 3-4: la proteína del día se suma de las comidas. Falta decidir cuándo un día cuenta como «no cumplido» (nunca automáticamente a mitad del día: sin cierre explícito del día, por debajo de la meta es «sin completar», no incumplimiento).
  - Borrar un entrenamiento NO desmarca el hábito «Entrenar» de ese día (se corrige en Hoy). Evaluar si conviene automatizarlo.

## Ideas / pendientes
- Importar / restaurar desde el JSON exportado (hoy la exportación es solo copia de seguridad de lectura)
- Al crear tablas nuevas en cada etapa: sumarlas a `TABLAS_EXPORT` (js/core/exportar.js); la prueba automática avisa si se olvida
- Cola de registro sin conexión (mejora futura)
- Versión atómica de hábitos vía función SQL (hoy son 2 pasos con reversión)
