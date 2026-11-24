# Arquitectura de Giro 180

## Piezas
- **Frontend:** HTML + CSS + JavaScript con módulos ES nativos. Sin framework ni compilación.
- **Hosting:** GitHub Pages (repo público). Los datos NO están en el repo.
- **Backend:** Supabase (PostgreSQL + Auth). Plan gratuito + exportaciones periódicas.
- **PWA:** manifest + Service Worker (red primero, copia local como respaldo).
- **Única dependencia externa:** `@supabase/supabase-js` (versión fijada, desde jsDelivr).

## Seguridad
- Login con correo y contraseña; registros nuevos desactivados en Supabase.
- RLS en todas las tablas: `user_id = auth.uid()`. El rol anónimo no tiene acceso.
- En el frontend solo vive la **publishable key** (pública por diseño). Nunca la secret / service_role.
- El Service Worker no cachea llamadas a Supabase.

## Estructura
- `js/main.js` arranque · `js/auth.js` sesión · `js/supabase.js` cliente · `js/router.js` navegación por hash
- `js/core/` lógica pura sin pantalla: fechas, **estados (regla de los 4 estados)**, **informes** (períodos, comparación y textos Markdown), constantes, helper DOM, **gym** (nombres, objetivos series × reps, parser e importador de rutinas, coincidencias entre ejercicios), **cuerpo** (pasos y tendencias de peso y cintura), **entrenos** (series, totales, volumen, última vez, resumen semanal, progresión, hábito «Entrenar»). Con pruebas en `tests/`.
- `js/views/` pantallas generales (login, estructura) · `js/modules/<modulo>/` cada módulo
- `js/modules/compartido/medidas.js` (peso y cintura, compartido Gym/Nutri), `js/modules/gym/`: `index.js` (pestañas), `pasos.js`, `cuerpo.js`, `entrenar.js`, `historial.js`, `rutinas.js`, `ejercicios.js`, `importar.js`, `datos.js` (consultas a Supabase), `ui.js`. Mismo patrón que Central: `render(cont, ctx)`, token anti-respuestas viejas, error con Reintentar.
- `sql/` migraciones numeradas, se ejecutan a mano en Supabase

## Decisiones
- Navegación por hash (`#/gym`) porque GitHub Pages no tiene rutas de servidor.
- Email + contraseña (no magic link): la sesión de la app instalada en iPhone es independiente de Safari.
- Registrar datos requiere conexión (cola offline: mejora futura).

- Gym: rutinas y ejercicios se archivan, no se borran. El importador nunca une ejercicios solo por parecerse en nombre más de lo seguro: exacto o error de tipeo → se une y se marca; «uno contiene al otro» → solo se sugiere.

## Reglas de código
- Todo texto de usuario se muestra con `h()` (textContent), nunca con innerHTML.
- La decisión "cumplido / incumplido / no registrado / sin actividad" vive solo en `js/core/estados.js`.
- Las fechas son texto AAAA-MM-DD en hora de Argentina; no se usa `new Date()` para fechas de registro.

## Registro de entrenamientos (Gym)
- Un entrenamiento se guarda siempre con la función SQL `guardar_entrenamiento` (una transacción: sesión + series + hábito). La pantalla nunca escribe series una por una.
- Cada serie guarda una foto del objetivo; al editar un día guardado se conserva esa foto (`bloquesIniciales`), y el nombre de la rutina de la sesión tampoco se reescribe.
- El volumen suma solo series con peso. Las series sin peso se cuentan aparte.
- Las consultas de series se hacen por tandas de 25 sesiones y fallan si una tanda llega a 1000 filas (límite del servidor), en lugar de mostrar datos cortados.

## Pasos y evolución corporal (Gym)
- Los pasos son un hábito de cantidad: su estado lo decide `estados.js`; la pantalla no tiene reglas propias de cumplimiento.
- Peso y cintura viven en `body_measurements` (una fila por día). Nutri debe usar `js/modules/compartido/medidas.js`, no duplicar el acceso.
- Una tendencia sin datos suficientes devuelve `null` (se muestra «sin base de comparación»); nunca 0.

## Nutri (hito 3-4a)
- `js/core/nutri.js` (lógica pura): validación de comidas y proteína, totales (solo suma lo cargado; sin nada cargado el total es null), decisiones de sincronización y de cierre, resumen de período. `tests/nutri.test.mjs`.
- `js/modules/nutri/`: `index.js` (pestañas Hoy e Historial), `hoy.js`, `historial.js`, `datos.js` (tabla `meals`; falla si una consulta llega a 1000 filas), `ui.js`. `js/modules/compartido/habitos.js`: hábitos y registros para módulos que no son Central.
- Estados: siguen decidiéndose en `estados.js`. «Sin completar» es solo una etiqueta de pantalla para un día con comidas y sin registro (para `estados.js` es «no registrado»). `habit_logs.note` distingue el cumplido automático (`auto-proteina`, la app lo recalcula) de una decisión manual (cierre u otro registro: la app no lo toca).
- Proteína y agua son los dos hábitos de cantidad de Nutri: la búsqueda del hábito de proteína es estricta por nombre («prote») para no confundirlos.

## Agua, botellas y Cuerpo en Nutri (hito 3-4b)
- `js/core/agua.js` (lógica pura): unidades (L/ml), validación, total del día, sincronización y cierre (misma regla que la proteína), resumen. `tests/agua.test.mjs`.
- `js/modules/nutri/`: `agua.js` (tomas), `botellas.js` (recipientes), `historial.js` (proteína + agua), `datos.js` (tablas `water_containers` y `water_intakes`). La pestaña Cuerpo reutiliza `js/modules/gym/cuerpo.js`.
- El total de agua del día es la suma de `water_intakes`; la meta es un hábito de cantidad (Nutri, nombre con «Agua»). `habit_logs.note`: `auto-agua` = cumplido automático (recalculable); `cierre-dia` = cierre manual (no se toca). Cada hábito reconoce solo su propia marca automática: el cumplido de proteína no se confunde con el de agua.
- Las pantallas de Agua ignoran toques repetidos mientras una operación está en curso (evita tomas duplicadas).

## Informes con datos de Gym y Nutri (hito 3-5a)
- `js/core/areas.js` (lógica pura): calcula los datos reales de la semana (sesiones, series, volumen, progresión por ejercicio, pasos, peso y cintura, proteína y agua) y arma los fragmentos de texto. `informes.js` los recibe como `areas` / `datosAreas` opcionales; sin ellos los textos son idénticos a los de antes. Los estados de los hábitos siguen decidiéndose en `estados.js`.
- La pantalla `central/informes.js` carga los datos extra EN PARALELO y de forma opcional (`Promise.allSettled`): si una parte no se puede leer queda en null, el informe lo dice y el resto sigue. Lee desde `modules/gym/datos.js`, `modules/nutri/datos.js` y `modules/compartido/medidas.js` (Central depende de esos módulos solo para lectura).
- El INFORME GENERAL sigue limitado a 15 líneas por `limitarLineas`, pero además los datos nuevos van dentro de las líneas existentes, así que el límite no recorta contenido.

## Panel con Gym y Nutri (hito 3-5b)
- `indicadoresPanel` y `textoPanel` (en `js/core/areas.js`, lógica pura) calculan y redactan la tarjeta «Gym y Nutri» del Panel. `central/panel.js` lee entrenamientos de la semana, comidas de hoy y tomas de hoy de forma OPCIONAL (`Promise.allSettled`): una lectura que falla deja esa métrica en «—» y no bloquea el panel.
- Entrenos = cantidad de entrenamientos registrados de lunes a hoy; el hábito Entrenar solo aporta la nota «X de Y días programados cumplidos».

## Base de alimentos (ampliación 3-6a)
- `js/core/alimentos.js` (lógica pura): `MACROS` (calorías, carbohidratos, proteínas, grasas y su columna en alimentos y en comidas), validación de alimentos y porciones, `macrosDeCantidad` (valor por 100 × cantidad / 100), búsqueda sin tildes. `tests/alimentos.test.mjs`.
- `js/modules/nutri/alimentos.js` (pestaña) y funciones nuevas en `nutri/datos.js` (tablas `foods` y `food_portions`; fallan si una consulta llega a 1000 filas).
- Las comidas (`meals`) guardan una FOTO de lo que se comió (`food_name`, `amount` y las macros calculadas): cambiar o borrar un alimento no altera el historial. NULL = sin dato, nunca 0.

## Comidas con alimentos y macros (ampliación 3-6b)
- La pantalla `nutri/hoy.js` carga los alimentos y porciones de forma OPCIONAL (`Promise.allSettled`): si no se pueden leer, Hoy abre en modo «A mano». Las decisiones viven en `core/alimentos.js` (lógica pura): `calcularCantidad` (cantidad en g/ml o en porciones → cantidad total y macros, con los límites que acepta la base), `comidaDeAlimento` (arma la comida con su foto), `reescalarComida` (cambiar la cantidad recalcula proporcionalmente desde lo guardado, no desde el alimento actual), `totalesMacros` (solo suma lo cargado; sin dato es null).
- La proteína del día sigue saliendo de `protein_g` de las comidas, así que la meta, el cierre y el cumplido automático de `core/nutri.js` funcionan igual con comidas de alimentos o a mano.
- Reglas de coherencia: un solo envío a la vez por pantalla (`ocupado`), NULL ≠ 0, y las comidas guardan una foto (nombre, cantidad y macros) para que cambiar un alimento no altere el historial.

## Objetivos con máximo y estado «excedido» (ampliación 3-6c1)
- `estados.js` sigue siendo el único lugar donde se decide qué significa cada día; ahora con un quinto estado: `excedido` (registro con `status = 'exceeded'`). Cuenta como registrado, NO como no cumplido y queda fuera del porcentaje: `pct = cumplidos / (cumplidos + incumplidos)` y `cobertura` incluye los excedidos.
- `evaluar(version, valor)`: sin `target_max` es idéntico al de siempre; con máximo da `exceeded` si lo superás. `tipoObjetivo` y `textoObjetivo` describen el objetivo («120 g o más», «como máximo 2000 kcal», «entre 1500 y 2000 kcal»).
- `combinar` suma `excedidos` y tolera resúmenes viejos sin ese campo. Los consumidores (Central Hoy / Semana / Panel / Hábitos, Informes, Nutri) muestran el excedido aparte; lo que antes calculaba `programados - cumplidos - incumplidos` ahora usa los contadores del resumen.
- Central → Hábitos conserva y permite editar el máximo: `nuevaVersion` solo copia lo que trae el formulario, así que `target_max` se envía siempre (null si no hay).
- La migración 009 solo agrega: columna opcional y un valor más permitido en `status`.
