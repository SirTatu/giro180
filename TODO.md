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

## Etapa 3 — Gym y Nutri (hitos 3-0 a 3-5 cerrados; ampliación 3-6 en curso)
- [x] 3-0 Migración SQL 003 (tablas) + prueba de seguridad 004 (ejecutadas y confirmadas por el usuario)
- [x] 3-1 Gym: ejercicios y rutinas + importador (v0.9.0; el usuario continuó al 3-2)
- [x] 3-2 Gym: registrar entrenamiento, historial y progresión (v0.10.0; confirmado por el usuario)
- [x] 3-3 Gym: pasos y evolución corporal (v0.11.0; confirmado por el usuario)
- [x] 3-4 Nutri
  - [x] 3-4a Comidas y proteína por comida + cierre del día (v0.12.0; confirmado por el usuario)
  - [x] 3-4b Agua, botellas y Cuerpo en Nutri (v0.13.0; confirmado por el usuario)
- [x] 3-5 Informes: sumar Gym y Nutri al INFORME GENERAL, indicadores, notas de especialistas y Panel
  - [x] 3-5a Informes con datos reales de Gym y Nutri (v0.14.0; confirmado por el usuario)
  - [x] 3-5b Panel con entrenos de la semana, proteína y agua de hoy (v0.15.0; confirmado por el usuario)
- [ ] 3-6 Ampliación de Nutri: base de alimentos y las 4 macros
  - [x] 3-6a Migración 007 + pestaña Alimentos con porciones (v0.16.0; confirmado por el usuario)
  - [x] 3-6b Registrar comidas eligiendo un alimento y gramos o porciones; ver calorías, carbos, proteínas y grasas del día (v0.17.0; confirmado por el usuario)
  - [ ] 3-6c Objetivos por macro con rango y estado «excedido» (se divide en tres)
    - [ ] 3-6c1 Migración 009 (máximo en el objetivo y estado «excedido») + `estados.js` + pantallas de Central e Informes (v0.18.0, entregado; falta que el usuario lo pruebe)
    - [ ] 3-6c2 Pestaña Nutri → Objetivos (por macro: «al menos» / «como máximo» / «entre X e Y», versionado) + Hoy con el estado de cada macro, cumplido y excedido automáticos y un solo botón «Cerrar el día»
    - [ ] 3-6c3 Historial, Informes (informe y notas) y Panel con las 4 macros y sus excedidos
- Decisiones tomadas / abiertas de la etapa:
  - 3-6: decidido por el usuario: alimentos por 100 g (o 100 ml) + porciones opcionales; los objetivos se configuran en Nutri → Objetivos (los hábitos quedan por debajo, versionados); un día «excedido» NO cuenta como no cumplido en los porcentajes, solo se marca. Pendiente de resolver en 3-6c: eso exige un estado nuevo («excedido») en `habit_logs` y en `estados.js`, con su migración; hay que confirmar con el usuario el detalle antes de tocar nada.
  - 3-6c: decidido por el usuario: «excedido» se guarda como estado nuevo y explícito (`exceeded`); en un objetivo «como máximo» el día se marca cumplido recién al cerrar el día (pasarse del máximo marca «excedido» enseguida); un solo botón «Cerrar el día» cierra todas las macros con objetivo y datos (las que no tienen ningún dato quedan sin registrar; pide confirmación si hay comidas sin dato).
  - 3-1: las rutinas NO van escritas en el código (el repo es público); se cargan pegando el texto en la app. Los ejercicios de nombre parecido los decide el usuario en la vista previa.
  - Ejercicio salteado: hoy no deja rastro (no hay filas). Si más adelante se quiere distinguir «salteado» de «no cargado», requiere una migración.
  - 3-4: decidido: la proteína del día se suma de las comidas; sin cierre explícito, por debajo de la meta es «sin completar»; «Cerrar el día» es manual; el agua sigue la misma regla (3-4b).
  - Borrar un entrenamiento NO desmarca el hábito «Entrenar» de ese día (se corrige en Hoy). Evaluar si conviene automatizarlo.

## Ideas / pendientes
- Hoy: al editar una comida de alimento solo se cambia la cantidad; cambiar de alimento exige borrar y cargar de nuevo (se podría permitir)
- Hoy: recordar los alimentos usados más seguido o los últimos (atajos)
- Alimentos: importar una lista pegando texto (como el importador de rutinas); no precargar nada en el código (el repo es público)
- Panel: sumar los pasos de hoy a la tarjeta Gym y Nutri (si se quiere)
- Repo: limpiar las copias viejas dentro de `js/core/` (README, ARCHITECTURE, CHANGELOG, DATABASE, TODO, sw.js, tests/ y js/ anidados) — no las usa la app
- Agua: no hay orden manual de botellas (van por nombre); no se guarda la hora de cada toma más allá de su fecha de creación
- Nutri → Cuerpo importa la pantalla desde `modules/gym/cuerpo.js`; si crece, moverla a `compartido/`
- Nutri: un día cerrado no se recalcula solo al cambiar comidas (hay que reabrir y cerrar de nuevo)
- Nutri: los hábitos de proteína y de agua se crean a mano en Central → Hábitos (módulo Nutri, tipo cantidad, nombre con «Proteína» / «Agua», unidad g / L); se podrían crear desde las pestañas
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
