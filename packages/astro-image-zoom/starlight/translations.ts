import { DEFAULT_LABELS, type ImageZoomLabels } from "../labels";

const SPANISH: ImageZoomLabels = {
  overlay: "Zoom de imagen",
  close: "Cerrar zoom",
  images: "Imágenes",
  previous: "Imagen anterior",
  next: "Imagen siguiente",
  enlarge: "Ampliar imagen",
  enlargeNamed: "Ampliar imagen: {alt}",
};

// Starlight's UI strings for the labels, under the astroImageZoom namespace. Other languages fall
// back to the site's default language, and to English when it has none (ImageZoom.astro); a site
// translates or overrides them in src/content/i18n/<lang>.json
const strings = (labels: ImageZoomLabels): Record<string, string> =>
  Object.fromEntries(
    Object.entries(labels).map(([key, value]) => [
      `astroImageZoom.${key}`,
      value,
    ]),
  );

export const translations = {
  en: strings(DEFAULT_LABELS),
  es: strings(SPANISH),
};
