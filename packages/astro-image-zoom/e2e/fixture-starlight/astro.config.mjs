import starlight from "@astrojs/starlight";
import imageZoom from "astro-image-zoom/starlight";
import { defineConfig } from "astro/config";

// The one-line setup the README documents, with an English and a Spanish locale
export default defineConfig({
  integrations: [
    starlight({
      title: "astro-image-zoom",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        es: { label: "Español", lang: "es" },
      },
      plugins: [imageZoom()],
    }),
  ],
});
