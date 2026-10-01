import { describe, expect, it } from "vitest";
import { DEFAULT_LABELS, resolveLabels } from "../labels";

const translations = {
  es: { close: "Cerrar zoom", next: "Imagen siguiente" },
  "pt-BR": { close: "Fechar zoom" },
  pt: { close: "Fechar" },
};

describe("resolveLabels", () => {
  it("is English with no translations, no locale and no override", () => {
    expect(resolveLabels()).toEqual(DEFAULT_LABELS);
    expect(resolveLabels({}, "es")).toEqual(DEFAULT_LABELS);
  });

  it("takes the translations of the locale, English for the keys they lack", () => {
    expect(resolveLabels(translations, "es")).toEqual({
      ...DEFAULT_LABELS,
      close: "Cerrar zoom",
      next: "Imagen siguiente",
    });
  });

  it("falls back to the language of a regional locale, and prefers an exact match", () => {
    expect(resolveLabels(translations, "es-ES").close).toBe("Cerrar zoom");
    expect(resolveLabels(translations, "pt-BR").close).toBe("Fechar zoom");
    expect(resolveLabels(translations, "pt-PT").close).toBe("Fechar");
  });

  it("ignores the case of the locale", () => {
    expect(resolveLabels(translations, "ES").close).toBe("Cerrar zoom");
    expect(resolveLabels(translations, "pt-br").close).toBe("Fechar zoom");
  });

  it("is English for a locale with no translations", () => {
    expect(resolveLabels(translations, "fr")).toEqual(DEFAULT_LABELS);
    expect(resolveLabels(translations, undefined)).toEqual(DEFAULT_LABELS);
  });

  it("lets the override win over the translations, key by key", () => {
    expect(resolveLabels(translations, "es", { close: "Salir" })).toEqual({
      ...DEFAULT_LABELS,
      close: "Salir",
      next: "Imagen siguiente",
    });
  });
});
