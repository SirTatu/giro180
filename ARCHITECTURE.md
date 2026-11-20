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
