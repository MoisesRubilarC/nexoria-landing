import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// El panel /admin guarda los campos opcionales vacíos como cadena vacía, no
// como ausentes. Sin esto, dejar en blanco "sitio" o "logo" rompía el build
// entero ("sitio: Invalid URL") y el sitio dejaba de publicarse.
const vacioEsNada = (v: unknown) => (v === '' || v === null ? undefined : v);
const urlOpcional = z.preprocess(vacioEsNada, z.url().optional());
const textoOpcional = z.preprocess(vacioEsNada, z.string().optional());

// Cada colección = una carpeta de archivos .md que el panel /admin escribe.
// Agregar un servicio, producto o cliente NO requiere tocar código: basta un
// archivo nuevo aquí (o guardar el formulario del panel).

const servicios = defineCollection({
  loader: glob({ base: './src/content/servicios', pattern: '**/*.md' }),
  schema: z.object({
    titulo: z.string(),
    resumen: z.string(),
    icono: z.enum(['senal', 'temperatura', 'prediccion', 'alerta', 'integracion', 'tablero']),
    orden: z.number().default(99),
    destacado: z.boolean().default(false),
    puntos: z.array(z.string()).default([]),
  }),
});

const productos = defineCollection({
  loader: glob({ base: './src/content/productos', pattern: '**/*.md' }),
  schema: z.object({
    nombre: z.string(),
    lema: z.string(),
    resumen: z.string(),
    estado: z.enum(['disponible', 'beta', 'desarrollo']).default('disponible'),
    url: urlOpcional,
    imagen: textoOpcional,
    caracteristicas: z.array(z.object({
      titulo: z.string(),
      detalle: z.string(),
    })).default([]),
    orden: z.number().default(99),
  }),
});

const clientes = defineCollection({
  loader: glob({ base: './src/content/clientes', pattern: '**/*.md' }),
  schema: z.object({
    nombre: z.string(),
    rubro: z.string(),
    logo: textoOpcional,
    sitio: urlOpcional,
    // Un cliente puede estar cargado pero no publicado todavía.
    publicado: z.boolean().default(true),
    orden: z.number().default(99),
  }),
});

export const collections = { servicios, productos, clientes };
