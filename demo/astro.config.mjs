import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Published on GitHub Pages, under the name of the repository and the custom domain of the
  // user site; the deploy workflow sets GITHUB_PAGES, so locally the demo stays at the root
  site: "https://antoniohg.com",
  base: process.env.GITHUB_PAGES ? "/astro-image-zoom" : undefined,
  integrations: [
    // Lucide icons, inlined as SVG at build time
    icon(),
    // /defaults/ is a bare test page with noindex, so it stays out of the sitemap
    sitemap({ filter: (page) => !page.endsWith("/defaults/") }),
  ],
  vite: {
    optimizeDeps: {
      // Use the workspace package directly so edits show up without a restart
      exclude: ["astro-image-zoom"],
    },
  },
  // Downloaded at build time and served from the site itself (no requests to Google)
  fonts: [
    {
      // One family for text and headings: the headings use its expanded width (wdth axis)
      provider: fontProviders.google(),
      name: "Archivo",
      cssVariable: "--font-archivo",
      weights: ["400 800"],
      styles: ["normal"],
      fallbacks: ["sans-serif"],
      options: {
        experimental: {
          variableAxis: { wdth: [["100", "125"]] },
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
