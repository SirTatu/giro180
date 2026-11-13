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
- `js/views/` pantallas generales (login, estructura) · `js/modules/<modulo>/` cada módulo
- `sql/` migraciones numeradas, se ejecutan a mano en Supabase

## Decisiones
- Navegación por hash (`#/gym`) porque GitHub Pages no tiene rutas de servidor.
- Email + contraseña (no magic link): la sesión de la app instalada en iPhone es independiente de Safari.
- Registrar datos requiere conexión (cola offline: mejora futura).
