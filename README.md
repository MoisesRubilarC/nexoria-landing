# nexoriachile.com

Sitio corporativo de Nexoria. Astro estático, desplegado en GitHub Pages con
dominio propio. La plataforma del producto vive aparte, en
[amprod.nexoriachile.com](https://amprod.nexoriachile.com/).

## Correr en local

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # genera dist/
npm run preview    # sirve dist/
npm run check      # tipos y diagnósticos de Astro
```

## Cómo se publica

Cada `push` a `main` dispara `.github/workflows/deploy.yml`, que construye el
sitio y lo publica en GitHub Pages. El archivo `public/CNAME` es lo que mantiene
el dominio asociado: **no borrarlo**.

## Agregar contenido sin tocar código

Los servicios, productos y clientes son archivos Markdown en `src/content/`.
Hay dos formas de editarlos:

**Panel web** — entra a [nexoriachile.com/admin](https://nexoriachile.com/admin/),
inicia sesión con GitHub y llena el formulario. Al guardar, el panel hace commit
y el sitio se reconstruye solo. Requiere el Worker configurado (ver abajo).

**A mano** — crea un `.md` en la carpeta que corresponda y haz push.

| Colección | Carpeta | Dónde aparece |
|---|---|---|
| Servicios | `src/content/servicios/` | Portada (si `destacado: true`), `/servicios/` y su propia página |
| Productos | `src/content/productos/` | Portada y `/amprod/` |
| Clientes | `src/content/clientes/` | Portada, solo si `publicado: true` |

La sección de clientes **no se muestra** mientras no haya ninguno publicado, así
que no queda un hueco vacío en la portada.

Los campos válidos de cada colección están en `src/content.config.ts`. Si un
archivo no los respeta, el build falla con un mensaje que dice exactamente qué
campo está mal.

## Worker de Cloudflare

`worker/` contiene un Worker que hace dos cosas:

- `POST /cotizacion` — recibe el formulario de contacto y lo envía por Resend a
  `contacto@nexoriachile.com`. Valida los campos, tiene trampa anti-spam y
  limita a un envío cada 30 s por IP.
- `/auth` y `/callback` — login de GitHub para el panel `/admin`.

```sh
cd worker
npm install
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npm run deploy
```

Después del primer despliegue hay que apuntar dos cosas a la URL del Worker:

1. `public/admin/config.yml` → campo `base_url`.
2. La variable `PUBLIC_ENDPOINT_COTIZACION` del repo
   (Settings → Secrets and variables → Actions → Variables), con `/cotizacion`
   al final.

Mientras `PUBLIC_ENDPOINT_COTIZACION` no exista, el formulario sigue
funcionando: cae al respaldo por `mailto:`.

## Marca

Los logos, favicons y la tipografía salen de `~/proyectos/nexoria-marca` y están
copiados en `public/marca/`, `public/favicon/` y `public/fuentes/`. Los colores
viven en `src/styles/marca.css`, que es una copia de `colores.css` del kit. Si el
kit cambia, hay que volver a copiarlos.

## Estructura

```
src/
  content/        servicios, productos, clientes (Markdown)
  content.config.ts   esquema de cada colección
  components/     Encabezado, PieDePagina, Hero, Icono, Clientes, Telemetria
  layouts/Base.astro  <head>, SEO, datos estructurados
  pages/          index, servicios/, amprod, nosotros, contacto, 404
  styles/         global.css + marca.css
public/
  admin/          panel de contenido (Sveltia CMS)
  marca/ favicon/ fuentes/ img/
  CNAME robots.txt
worker/           Worker de Cloudflare (Resend + OAuth del panel)
```
