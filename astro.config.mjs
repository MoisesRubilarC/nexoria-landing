// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// En desarrollo conservamos los avisos de consola; en el sitio publicado no
// queda ninguno, ni nuestro ni de las librerías (Astro, GSAP, Lenis).
const esDesarrollo = process.argv.includes('dev');

export default defineConfig({
  site: 'https://nexoriachile.com',
  // El panel de contenido no va en el sitemap ni en buscadores.
  integrations: [sitemap({ filter: (pagina) => !pagina.includes('/admin') })],
  build: { format: 'directory' },
  vite: esDesarrollo
    ? {}
    : {
        build: {
          // Astro 7 minifica con Oxc/Rolldown: la opción es compress.dropConsole.
          minify: 'oxc',
          rollupOptions: {
            output: {
              minify: { compress: { dropConsole: true, dropDebugger: true } },
            },
          },
        },
      },
});
