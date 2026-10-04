import type { HookParameters } from "@astrojs/starlight/types";
import type { AstroIntegration } from "astro";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LABELS } from "../labels";
import imageZoom, { VIRTUAL_CONFIG_ID } from "../starlight/index";

const OVERRIDE = "astro-image-zoom/starlight/MarkdownContent.astro";

// Runs config:setup with a fake context: only what the plugin reads
function setup(
  options: Parameters<typeof imageZoom>[0],
  components: Record<string, string> = {},
) {
  const updateConfig = vi.fn();
  const addIntegration = vi.fn();
  const warn = vi.fn();
  const context = {
    config: { title: "Docs", components },
    updateConfig,
    addIntegration,
    logger: { warn, info: vi.fn() },
  } as unknown as HookParameters<"config:setup">;
  imageZoom(options).hooks["config:setup"]?.(context);
  return { updateConfig, addIntegration, warn };
}

// The Vite plugin of the integration the plugin adds, run through its own config hook
function vitePlugin(integration: AstroIntegration) {
  const updateConfig = vi.fn();
  const setupHook = integration.hooks["astro:config:setup"] as (
    params: unknown,
  ) => void;
  setupHook({ updateConfig });
  return updateConfig.mock.calls[0]?.[0].vite.plugins[0] as {
    resolveId(id: string): string | undefined;
    load(id: string): string | undefined;
  };
}

describe("Starlight plugin", () => {
  it("overrides MarkdownContent and keeps the other overrides", () => {
    const { updateConfig, warn } = setup({}, { Footer: "./src/Footer.astro" });
    expect(updateConfig).toHaveBeenCalledWith({
      components: { Footer: "./src/Footer.astro", MarkdownContent: OVERRIDE },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("leaves an existing MarkdownContent override alone and warns", () => {
    const { updateConfig, addIntegration, warn } = setup(
      {},
      { MarkdownContent: "./src/MarkdownContent.astro" },
    );
    expect(updateConfig).not.toHaveBeenCalled();
    // The options still reach the component the site's override can use
    expect(addIntegration).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("astro-image-zoom/starlight/ImageZoom.astro"),
    );
  });

  it("serves the options through the virtual module", () => {
    const options = { showCounter: false, ignore: ".logo" };
    const { addIntegration } = setup(options);
    const plugin = vitePlugin(addIntegration.mock.calls[0]?.[0]);

    const resolved = plugin.resolveId(VIRTUAL_CONFIG_ID);
    expect(resolved).toBe(`\0${VIRTUAL_CONFIG_ID}`);
    expect(plugin.resolveId("./other")).toBeUndefined();
    expect(plugin.load(resolved!)).toBe(
      `export default ${JSON.stringify(options)};`,
    );
    expect(plugin.load("./other")).toBeUndefined();
  });

  it("rejects an unsupported ignore selector at build time", () => {
    expect(() => setup({ ignore: ".a > img" })).toThrow(/unsupported selector/);
  });

  it("injects the labels in English and Spanish, under astroImageZoom", () => {
    const injectTranslations = vi.fn();
    // The hook's parameter type is not exported; the fake carries the one function it calls
    imageZoom().hooks["i18n:setup"]?.({ injectTranslations } as never);
    const [translations] = injectTranslations.mock.calls[0] ?? [];

    const keys = Object.keys(DEFAULT_LABELS).map(
      (key) => `astroImageZoom.${key}`,
    );
    expect(Object.keys(translations.en)).toEqual(keys);
    expect(Object.keys(translations.es)).toEqual(keys);
    expect(translations.en["astroImageZoom.enlargeNamed"]).toBe(
      DEFAULT_LABELS.enlargeNamed,
    );
    expect(translations.es["astroImageZoom.close"]).toBe("Cerrar zoom");
  });
});
