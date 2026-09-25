import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { dialog, links, settle } from './helpers';

// The component must be accessible by default: these pages have no CSS of their own
const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

// The rule and the elements of each violation, for a readable failure
const summary = (violations: { id: string; nodes: { target: unknown }[] }[]): string[] =>
  violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => JSON.stringify(target)).join(', ')}`);

const analyze = async (page: Page): Promise<string[]> =>
  summary((await new AxeBuilder({ page }).withTags(wcag).analyze()).violations);

// Cases of the fixture site, opened on their first image
const cases = {
  single: 'one image',
  gallery: 'a gallery',
  layout: 'caption at the top, arrows at the sides',
  hidden: 'no caption, no counter',
  theme: 'the theme prop',
};

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('the page with the zoom closed has no violations', async ({ page }) => {
      await page.goto('/');
      expect(await analyze(page)).toEqual([]);
    });

    for (const [id, name] of Object.entries(cases)) {
      test(`the open zoom has no violations: ${name}`, async ({ page }) => {
        await page.goto('/');
        await links(page, id).first().click();
        await expect(dialog(page)).toHaveClass(/is-open/);
        // Contrast is measured on the final frame, not in the middle of a fade
        await settle(page);
        expect(await analyze(page)).toEqual([]);
      });
    }

    test('an optimized image opens without violations', async ({ page }) => {
      await page.goto('/hostile/');
      await page.locator('astro-image-zoom a').first().click();
      await expect(dialog(page)).toHaveClass(/is-open/);
      await settle(page);
      expect(await analyze(page)).toEqual([]);
    });
  });
}
