import { expect, type Locator, type Page } from '@playwright/test';

// Playwright locators pierce the open shadow root of the overlay
export const dialog = (page: Page): Locator => page.locator('dialog.astro-image-zoom-overlay');
export const zoomedImage = (page: Page): Locator =>
  page.locator('.astro-image-zoom-slide.is-active .astro-image-zoom-image');
export const counter = (page: Page): Locator => page.locator('.astro-image-zoom-counter');
export const caption = (page: Page): Locator => page.locator('.astro-image-zoom-caption');

// The zoom links of one case of the fixture site (fixture/src/pages/index.astro)
export const links = (page: Page, fixture: string): Locator => page.locator(`#${fixture} astro-image-zoom a`);

// Opens an image and waits for the end of the opening animation
export async function openZoom(page: Page, fixture: string, index = 0): Promise<void> {
  await links(page, fixture).nth(index).click();
  await expect(dialog(page)).toHaveClass(/is-open/);
}

// Waits for the animations and transitions running in the overlay (caption fade, image fade) to end
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('astro-image-zoom-overlay')?.shadowRoot;
    return root?.getAnimations().every(({ playState }) => playState !== 'running') ?? true;
  });
}

// Waits until the overlay is closed and every trace of it is gone from the page
export async function expectClosed(page: Page): Promise<void> {
  await expect(dialog(page)).not.toHaveAttribute('open');
  await expect(dialog(page)).not.toHaveClass(/is-(opening|open|closing)/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

  // No thumbnail stays hidden, no image is left outside the dialog
  const hidden = await page.$$eval('astro-image-zoom img', (images) =>
    images.filter((image) => image.style.opacity === '0').length
  );
  expect(hidden).toBe(0);
  const stray = await page.evaluate(
    () => document.querySelector('astro-image-zoom-overlay')?.shadowRoot?.querySelectorAll(':scope > img').length ?? 0
  );
  expect(stray).toBe(0);
}

// The element focused inside the overlay's shadow root, by its accessible label
export function focusedLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.querySelector('astro-image-zoom-overlay')?.shadowRoot?.activeElement;
    return active?.getAttribute('aria-label') ?? null;
  });
}

// Focuses a zoom link and returns the outline style of the link and of its image
export async function focusRing(link: Locator): Promise<{ link: string; image: string }> {
  await link.focus();
  return link.evaluate((element) => ({
    link: getComputedStyle(element).outlineStyle,
    image: getComputedStyle(element.querySelector('img')!).outlineStyle,
  }));
}
