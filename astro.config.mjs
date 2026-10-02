// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://nexoriachile.com',
  // El panel de contenido no va en el sitemap ni en buscadores.
  integrations: [sitemap({ filter: (pagina) => !pagina.includes('/admin') })],
  build: { format: 'directory' },
});
