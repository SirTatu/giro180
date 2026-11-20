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
- [ ] 3-1 Gym: ejercicios y rutinas + importador (entregado en v0.9.0; falta que el usuario lo pruebe)
- [ ] 3-2 Gym: registrar entrenamiento. Peso y repeticiones de cada serie; sumas de repeticiones, volumen y series por ejercicio, por rutina, por día y por semana; reemplazar, saltear o agregar un ejercicio solo ese día; precarga de la última vez; historial y progresión; marca el hábito «Entrenar» del día
- [ ] 3-3 Gym: pasos (hábito de cantidad) y evolución corporal (peso y cintura, tendencia en números)
- [ ] 3-4 Nutri: comidas con proteína por comida, agua, peso y cintura
- [ ] 3-5 Informes: sumar Gym y Nutri al INFORME GENERAL, indicadores, notas de especialistas y Panel
- Decisiones abiertas para el hito indicado:
  - 3-1: las rutinas NO van escritas en el código (el repo es público); se cargan pegando el texto en la app. Los ejercicios de nombre parecido los decide el usuario en la vista previa.
  - 3-2: ejercicio salteado el día del entrenamiento: sin filas de series no queda rastro; evaluar si se registra como «salteado» explícito (distinto de «no registrado»).
  - 3-4: la proteína del día se suma de las comidas. Falta decidir cuándo un día cuenta como «no cumplido» (nunca automáticamente a mitad del día: sin cierre explícito del día, por debajo de la meta es «sin completar», no incumplimiento).
  - Borrar un entrenamiento NO desmarca el hábito «Entrenar» de ese día (se corrige en Hoy). Evaluar si conviene automatizarlo.

## Ideas / pendientes
- Importar / restaurar desde el JSON exportado (hoy la exportación es solo copia de seguridad de lectura)
- Al crear tablas nuevas en cada etapa: sumarlas a `TABLAS_EXPORT` (js/core/exportar.js); la prueba automática avisa si se olvida
- Importar rutinas de forma atómica (función SQL) en lugar de rutina por rutina con reversión
- Asignar grupo muscular a varios ejercicios a la vez
- Cola de registro sin conexión (mejora futura)
- Versión atómica de hábitos vía función SQL (hoy son 2 pasos con reversión)
