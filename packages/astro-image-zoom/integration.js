/**
 * Astro integration: site-wide settings for <ImageZoom>, set once in astro.config.
 * Plain JavaScript: Astro loads it in Node, which does not run TypeScript from node_modules.
 */
import { fileURLToPath } from 'node:url';

// The module the component imports its settings from: the integration swaps its contents
const configFile = fileURLToPath(new URL('./config.js', import.meta.url));

/**
 * @param {{ labels?: import('./labels').ImageZoomTranslations }} [options]
 *   `labels`: the translations of the site, by locale (`es`, `pt-BR`…), chosen by the locale of
 *   each page.
 * @returns {import('astro').AstroIntegration}
 */
export default function imageZoom(options = {}) {
  const config = { labels: options.labels ?? {} };

  return {
    name: 'astro-image-zoom',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'astro-image-zoom:config',
                enforce: 'pre',
                load(id) {
                  // The id may carry a query (?v=…) in development
                  if (id.split('?')[0] !== configFile) return null;
                  return `export default ${JSON.stringify(config)};`;
                },
              },
            ],
          },
        });
      },
    },
  };
}
