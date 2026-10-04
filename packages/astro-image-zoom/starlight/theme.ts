import type { Props } from "../ImageZoom.astro";

const SURFACE = "color-mix(in srgb, var(--sl-color-gray-6) 80%, transparent)";

/**
 * The overlay in Starlight's palette: its background is the page's, its text the page's text, and
 * the controls keep their translucency over a surface of the theme. Each value is a var() the
 * overlay resolves when it opens, so it follows the light and dark themes
 */
export const STARLIGHT_THEME: NonNullable<Props["theme"]> = {
  backgroundColor: "var(--sl-color-black)",
  closeButtonColor: "var(--sl-color-white)",
  closeButtonBackground: SURFACE,
  navigationColor: "var(--sl-color-white)",
  navigationBackground: SURFACE,
  captionColor: "var(--sl-color-white)",
  captionBackground: SURFACE,
};
