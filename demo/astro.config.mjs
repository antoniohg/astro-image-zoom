import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Published on GitHub Pages, under the name of the repository and the custom domain of the
  // user site; the deploy workflow sets GITHUB_PAGES, so locally the demo stays at the root
  site: "https://antoniohg.com",
  base: process.env.GITHUB_PAGES ? "/astro-image-zoom" : undefined,
  integrations: [
    // /defaults/ is a bare test page with noindex, so it stays out of the sitemap
    sitemap({ filter: (page) => !page.endsWith("/defaults/") }),
  ],
  // Prefetch every link on hover or focus: the pages, and the full-size image of each zoom link,
  // which the zoom then finds in the cache. Without prefetchAll only links with data-astro-prefetch
  prefetch: { prefetchAll: true },
  build: {
    inlineStylesheets: "always",
  },
  vite: {
    optimizeDeps: {
      // Use the workspace package directly so edits show up without a restart
      exclude: ["astro-image-zoom"],
    },
  },
  // Downloaded at build time and served from the site itself (no requests to Google)
  fonts: [
    {
      // Text: the regular width; with the wdth axis the file would be 90 KB instead of 35 KB
      provider: fontProviders.google(),
      name: "Archivo",
      cssVariable: "--font-archivo",
      weights: ["400 800"],
      styles: ["normal"],
      fallbacks: ["sans-serif"],
    },
    {
      // Headings: the same family at its expanded width (wdth 125), one bold instance
      provider: fontProviders.google(),
      name: "Archivo",
      cssVariable: "--font-archivo-expanded",
      weights: ["700"],
      styles: ["normal"],
      fallbacks: ["sans-serif"],
      options: {
        experimental: {
          variableAxis: { wdth: ["125"] },
        },
      },
    },
    {
      provider: fontProviders.google(),
      name: "IBM Plex Mono",
      cssVariable: "--font-plex-mono",
      weights: ["400", "500"],
      styles: ["normal"],
      fallbacks: ["monospace"],
    },
  ],
});
