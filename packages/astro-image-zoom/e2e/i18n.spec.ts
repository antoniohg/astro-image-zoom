import { expect, test } from "@playwright/test";
import { dialog, expectClosed, links, openZoom } from "./helpers";

// The labels prop translates a gallery (e2e/fixture/src/pages/es/index.astro)
test.describe("labels", () => {
  test("a translated gallery reads its labels, in the links and in the overlay", async ({
    page,
  }) => {
    await page.goto("/es/");
    await expect(links(page, "translated").first()).toHaveAttribute(
      "aria-label",
      "Ampliar imagen: Paisaje",
    );

    await openZoom(page, "translated");
    await expect(dialog(page)).toHaveAttribute("aria-label", "Zoom de imagen");
    await expect(
      page.getByRole("button", { name: "Cerrar zoom" }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Imágenes" })).toBeAttached();
    await expect(
      page.getByRole("button", { name: "Imagen anterior" }),
    ).toBeAttached();
    await expect(
      page.getByRole("button", { name: "Imagen siguiente" }),
    ).toBeAttached();
    await page.keyboard.press("Escape");
    await expectClosed(page);
  });

  test("a gallery with its own labels does not leak them into the next one", async ({
    page,
  }) => {
    // The overlay is shared by the galleries of the page; the second one has no labels
    await page.goto("/es/");
    await openZoom(page, "translated");
    await expect(
      page.getByRole("button", { name: "Cerrar zoom" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expectClosed(page);

    await expect(links(page, "english").first()).toHaveAttribute(
      "aria-label",
      "Enlarge image: Portrait",
    );
    await openZoom(page, "english");
    await expect(
      page.getByRole("button", { name: "Close zoom overlay" }),
    ).toBeVisible();
    await expect(dialog(page)).toHaveAttribute(
      "aria-label",
      "Image zoom overlay",
    );
  });

  test("malformed labels from a script leave the overlay in English", async ({
    page,
  }) => {
    await page.goto("/es/");
    await page
      .locator("#translated astro-image-zoom")
      .evaluate((element: HTMLElement) => {
        element.dataset.imageZoomLabels = "{not json";
      });
    await openZoom(page, "translated");
    await expect(
      page.getByRole("button", { name: "Close zoom overlay" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expectClosed(page);
  });
});
