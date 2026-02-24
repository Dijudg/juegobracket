# juegobracket
Micrositio interactivo de pronóstico Mundial 2026 con React y Supabase

**Configuracion**
1. Frontend: copia `.env.example` a `.env` y completa los valores.
2. Backend (opcional): copia `server/.env.example` a `server/.env` y completa los valores si vas a usar Express.
3. Base de datos: ejecuta `server/schema.sql` en el SQL Editor de Supabase.

**Variables necesarias**
1. Frontend (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. Backend (Express, opcional): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Opcionales: `VITE_API_BASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_FM_API_URL`, `VITE_SUPABASE_AVATAR_BUCKET`.

**Vercel**
1. Preview: define las variables `VITE_*` con el proyecto de Supabase de pruebas.
2. Production: define las variables `VITE_*` con el proyecto de Supabase real.
3. Si despliegas el backend (opcional), configura tambien `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `CORS_ORIGIN`.
