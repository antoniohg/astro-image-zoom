/**
 * The texts the component reads to assistive technology. All of them are `aria-label`s: nothing
 * visible is translated. The defaults are English; a site overrides the ones it needs.
 */
export interface ImageZoomLabels {
  /** Name of the dialog */
  overlay: string;
  /** Close button */
  close: string;
  /** Name of the group of slides */
  images: string;
  /** Previous image button */
  previous: string;
  /** Next image button */
  next: string;
  /** Name of the link around an image with no alt text */
  enlarge: string;
  /** Name of the link around an image; `{alt}` is replaced with its alt text */
  enlargeNamed: string;
}

export const DEFAULT_LABELS: ImageZoomLabels = {
  overlay: "Image zoom overlay",
  close: "Close zoom overlay",
  images: "Images",
  previous: "Previous image",
  next: "Next image",
  enlarge: "Enlarge image",
  enlargeNamed: "Enlarge image: {alt}",
};

// The labels the overlay reads on the client, from `data-image-zoom-label-*` attributes of <astro-image-zoom>
export const OVERLAY_LABELS = [
  "overlay",
  "close",
  "images",
  "previous",
  "next",
] as const;

// Values of the attribute delimiter and of markup: the labels are plain text, not HTML
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The translations of a site: the labels it changes, by locale (`es`, `pt-BR`…) */
export type ImageZoomTranslations = Record<string, Partial<ImageZoomLabels>>;

/**
 * The labels of a gallery: the English defaults, then the translation of its locale (the exact
 * locale, else its language: `es-ES` takes `es`), then the labels the gallery sets itself.
 */
export function resolveLabels(
  translations: ImageZoomTranslations = {},
  locale?: string,
  override: Partial<ImageZoomLabels> = {},
): ImageZoomLabels {
  const byLocale = new Map(
    Object.entries(translations).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
  const wanted = locale?.toLowerCase();
  const translation =
    (wanted && (byLocale.get(wanted) ?? byLocale.get(wanted.split("-")[0]))) ||
    {};
  return { ...DEFAULT_LABELS, ...translation, ...override };
}
