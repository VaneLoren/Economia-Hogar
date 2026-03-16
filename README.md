# Economía Hogar · versión PRO

Esta es la versión PRO de la app web instalable para móvil y PC, pensada para dos personas y con sincronización online mediante Supabase.

## Qué incluye
- Login con email + contraseña
- Gastos compartidos entre 2 usuarios
- Añadir, editar y borrar gastos
- Presupuesto por categoría
- Resúmenes mensuales
- Exportación a Excel y PDF
- Interfaz responsive para móvil y PC
- Preparada como PWA instalable

## Categorías
- Supermercado
- Ropa
- Extrascolares
- Guardería / Comedor
- Ocio
- Luz
- Internet
- Comunidad
- Seguro
- Transporte / Coche
- Otros

## 1. Crear proyecto en Supabase
1. Crea una cuenta en Supabase.
2. Crea un proyecto nuevo.
3. Ve a SQL Editor.
4. Copia y ejecuta el archivo `supabase-schema.sql`.
5. Ve a Project Settings > API.
6. Copia la URL del proyecto y la anon key.

## 2. Configurar variables de entorno
1. Copia `.env.example` a `.env`
2. Rellena:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

## 3. Instalar y ejecutar
```bash
npm install
npm run dev
```

## 4. Publicar
Puedes publicar fácilmente en Vercel o Netlify.

## 5. Instalar en móvil o PC
- Android: abrir la URL y usar “Añadir a pantalla de inicio”.
- iPhone: abrir en Safari > Compartir > “Añadir a pantalla de inicio”.
- PC: Chrome o Edge > Instalar aplicación.

## Nota importante
Esta app queda lista para funcionar, pero para usar base de datos online hace falta conectar primero el proyecto Supabase con tus credenciales.
