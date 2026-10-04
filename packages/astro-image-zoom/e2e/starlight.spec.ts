import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { caption, counter, dialog, expectClosed, settle } from "./helpers";

// The Starlight fixture (e2e/fixture-starlight), served on the port set in playwright.config.ts
test.use({ baseURL: "http://localhost:4324" });

// The links the plugin adds in the docs content
const zoomLinks = (page: Page): Locator =>
  page.locator(
    "astro-image-zoom .sl-markdown-content a[data-image-zoom-generated]",
  );

test.describe("Starlight plugin", () => {
  test("wraps the images of the content in one gallery", async ({ page }) => {
    await page.goto("/");
    await expect(zoomLinks(page)).toHaveCount(3);
    expect(
      await zoomLinks(page).evaluateAll((links) =>
        links.map((link) => link.getAttribute("aria-label")),
      ),
    ).toEqual([
      "Enlarge image: Earth from orbit",
      "Enlarge image: Landscape",
      "Enlarge image: Wide",
    ]);

    // The image in a link and the ignored one are left alone
    await expect(
      page.locator('a[href="https://example.com/"] img[alt="Linked portrait"]'),
    ).toBeVisible();
    await expect(
      page.locator("a[data-image-zoom-generated] img[alt='Linked portrait']"),
    ).toHaveCount(0);
    await expect(
      page.locator("a[data-image-zoom-generated] img[alt='Ignored square']"),
    ).toHaveCount(0);
  });

  test("leaves a code block that shows an image tag as written", async ({
    page,
  }) => {
    await page.goto("/");
    const code = page
      .locator(".expressive-code")
      .filter({ hasText: "In a code block" });
    await expect(code).toContainText(
      '<img src="/code.png" alt="In a code block" />',
    );
    await expect(code.locator("a[data-image-zoom-generated]")).toHaveCount(0);
    // The copy button keeps the tag in its attribute
    await expect(code.locator("button[data-code]")).toHaveAttribute(
      "data-code",
      /<img src="\/code\.png"/,
    );
  });

  test("opens the gallery with the caption from the Markdown title", async ({
    page,
  }) => {
    await page.goto("/");
    await zoomLinks(page).first().click();
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
    await expect(counter(page)).toHaveText("1 / 3");
    await expect(caption(page)).toHaveText("Earth seen from orbit");
    await page.keyboard.press("Escape");
    await expectClosed(page);
  });

  test("reads the labels in the language of the page", async ({ page }) => {
    await page.goto("/es/");
    await expect(zoomLinks(page).first()).toHaveAttribute(
      "aria-label",
      "Ampliar imagen: La Tierra desde la órbita",
    );
    await zoomLinks(page).first().click();
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
    await expect(dialog(page)).toHaveAttribute("aria-label", "Zoom de imagen");
    await expect(
      page.getByRole("button", { name: "Cerrar zoom" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Imagen siguiente" }),
    ).toBeAttached();
  });
});

// A Starlight color token as the browser resolves it on the page
const token = (page: Page, name: string): Promise<string> =>
  page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, name);

const backdropColor = (page: Page): Promise<string> =>
  page.evaluate(
    () =>
      getComputedStyle(
        document
          .querySelector("astro-image-zoom-overlay")!
          .shadowRoot!.querySelector(".astro-image-zoom-backdrop")!,
      ).backgroundColor,
  );

const overlayScheme = (page: Page): Promise<string> =>
  dialog(page).evaluate((element) => getComputedStyle(element).colorScheme);

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`Starlight plugin, ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("the overlay takes the colors of the theme", async ({ page }) => {
      await page.goto("/");
      await zoomLinks(page).first().click();
      await expect(dialog(page)).toHaveClass(/\bis-open\b/);
      expect(await backdropColor(page)).toBe(
        await token(page, "--sl-color-black"),
      );
      expect(await overlayScheme(page)).toBe(colorScheme);
    });

    test("the open overlay has no axe violations", async ({ page }) => {
      await page.goto("/");
      await zoomLinks(page).first().click();
      await expect(dialog(page)).toHaveClass(/\bis-open\b/);
      const { violations } = await new AxeBuilder({ page })
        .include("astro-image-zoom-overlay")
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22aa",
          "best-practice",
        ])
        .analyze();
      expect(violations.map(({ id }) => id)).toEqual([]);
    });
  });
}

test("Starlight's theme toggle, not the OS, sets the overlay's scheme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  // The theme Starlight's toggle stores
  await page.addInitScript(() =>
    localStorage.setItem("starlight-theme", "light"),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await zoomLinks(page).first().click();
  await expect(dialog(page)).toHaveClass(/\bis-open\b/);
  expect(await overlayScheme(page)).toBe("light");
  expect(await backdropColor(page)).toBe(await token(page, "--sl-color-black"));
});

test("a wheel close lets the page scroll and lands on the thumbnail", async ({
  page,
}) => {
  await page.goto("/");
  await zoomLinks(page).last().click();
  await expect(dialog(page)).toHaveClass(/\bis-open\b/);
  await settle(page);
  const before = await page.evaluate(() => scrollY);

  // The last box of the image before it goes, and the box of its thumbnail then, read after each
  // paint (as in zoom.spec.ts, the sticky box cases)
  const landing = page.evaluate(
    () =>
      new Promise<number[][]>((resolve) => {
        const root = document.querySelector(
          "astro-image-zoom-overlay",
        )!.shadowRoot!;
        const thumbnail = document.querySelector(
          "astro-image-zoom a[data-image-zoom-generated] img[alt='Wide']",
        )!;
        const box = (element: Element) => {
          const { left, top } = element.getBoundingClientRect();
          return [left, top];
        };
        let last: number[][] = [];
        const frame = () => {
          const image = [...root.children].find((child) =>
            child.matches(".astro-image-zoom-image"),
          );
          if (image) last = [box(image), box(thumbnail)];
          else if (last.length) return resolve(last);
          requestAnimationFrame(() => setTimeout(frame));
        };
        frame();
      }),
  );
  // One continuous gesture, as a mouse wheel or a touchpad sends it
  await page.mouse.move(640, 360);
  for (let step = 0; step < 6; step++) await page.mouse.wheel(0, 80);
  const [image, thumbnail] = await landing;
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before);
  expect(image![0]).toBeCloseTo(thumbnail![0]!, 0);
  expect(image![1]).toBeCloseTo(thumbnail![1]!, 0);
  await expectClosed(page);
});
