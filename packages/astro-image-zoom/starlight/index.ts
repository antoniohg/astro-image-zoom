/**
 * astro-image-zoom for Starlight: `plugins: [imageZoom()]` makes every image of the docs zoomable.
 * Only types come from Starlight, so the package works without it installed
 */
import type { StarlightPlugin } from "@astrojs/starlight/types";
import type { AstroIntegration } from "astro";
import type { Props } from "../ImageZoom.astro";
import { parseIgnore } from "../wrapImages";
import { translations } from "./translations";

/** The props of `<ImageZoom>` that make sense site-wide; the labels come from Starlight's i18n */
export type StarlightImageZoomOptions = Pick<
  Props,
  | "closeOnBackdrop"
  | "closeOnImage"
  | "closeOnScroll"
  | "showNavigation"
  | "navigationLayout"
  | "showCounter"
  | "showCaption"
  | "captionPosition"
  | "animationDuration"
  | "ignore"
  | "theme"
>;

export const VIRTUAL_CONFIG_ID = "virtual:astro-image-zoom/starlight-config";
const RESOLVED_CONFIG_ID = `\0${VIRTUAL_CONFIG_ID}`;
const OVERRIDE = "astro-image-zoom/starlight/MarkdownContent.astro";

// Hands the options to the override, which Starlight renders as a component and cannot take props
function configIntegration(
  options: StarlightImageZoomOptions,
): AstroIntegration {
  return {
    name: "astro-image-zoom/starlight-config",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: "astro-image-zoom:starlight-config",
                resolveId: (id: string) =>
                  id === VIRTUAL_CONFIG_ID ? RESOLVED_CONFIG_ID : undefined,
                load: (id: string) =>
                  id === RESOLVED_CONFIG_ID
                    ? `export default ${JSON.stringify(options)};`
                    : undefined,
              },
            ],
          },
        });
      },
    },
  };
}

export default function imageZoom(
  options: StarlightImageZoomOptions = {},
): StarlightPlugin {
  return {
    name: "astro-image-zoom",
    hooks: {
      "config:setup"({ config, updateConfig, addIntegration, logger }) {
        // The same check as the prop: an unsupported selector fails the build, not the page
        parseIgnore(options.ignore);

        // The options also serve the component a site's own override can use
        addIntegration(configIntegration(options));

        if (config.components?.MarkdownContent) {
          logger.warn(
            "MarkdownContent is already overridden, so astro-image-zoom does not replace it. Wrap Starlight's MarkdownContent in astro-image-zoom/starlight/ImageZoom.astro inside your override: see the Starlight section of the astro-image-zoom README.",
          );
          return;
        }
        // updateConfig replaces the components object: keep the other overrides
        updateConfig({
          components: { ...config.components, MarkdownContent: OVERRIDE },
        });
      },
      "i18n:setup"({ injectTranslations }) {
        injectTranslations(translations);
      },
    },
  };
}
