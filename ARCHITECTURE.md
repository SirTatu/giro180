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
- `js/core/` lógica pura sin pantalla: fechas, **estados (regla de los 4 estados)**, constantes, helper DOM. Con pruebas en `tests/`.
- `js/views/` pantallas generales (login, estructura) · `js/modules/<modulo>/` cada módulo
- `sql/` migraciones numeradas, se ejecutan a mano en Supabase

## Decisiones
- Navegación por hash (`#/gym`) porque GitHub Pages no tiene rutas de servidor.
- Email + contraseña (no magic link): la sesión de la app instalada en iPhone es independiente de Safari.
- Registrar datos requiere conexión (cola offline: mejora futura).

## Reglas de código
- Todo texto de usuario se muestra con `h()` (textContent), nunca con innerHTML.
- La decisión "cumplido / incumplido / no registrado / sin actividad" vive solo en `js/core/estados.js`.
- Las fechas son texto AAAA-MM-DD en hora de Argentina; no se usa `new Date()` para fechas de registro.
