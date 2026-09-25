import { defineConfig } from 'astro/config';
import imageZoom from 'astro-image-zoom/integration';

// The package is installed from the workspace, as a site would install it from npm.
// Two locales: the pages under /es/ read the Spanish labels.
export default defineConfig({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' },
  integrations: [
    imageZoom({
      labels: {
        es: {
          overlay: 'Zoom de imagen',
          close: 'Cerrar zoom',
          images: 'Imágenes',
          previous: 'Imagen anterior',
          next: 'Imagen siguiente',
          enlarge: 'Ampliar imagen',
          enlargeNamed: 'Ampliar imagen: {alt}',
        },
      },
    }),
  ],
});
