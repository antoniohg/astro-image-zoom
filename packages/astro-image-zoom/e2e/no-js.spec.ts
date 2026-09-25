import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('without JavaScript, each image links to its full-size version', async ({ page }) => {
  await page.goto('/');

  const link = page.locator('#sources astro-image-zoom a').first();
  await expect(link).toHaveAttribute('href', /landscape\.svg$/);
  await expect(link).toHaveAccessibleName('Enlarge image: Thumbnail with data-zoom-src');

  await link.click();
  await expect(page).toHaveURL(/\/images\/landscape\.svg$/);
});

test('without JavaScript, an optimized image links to the file set in data-zoom-src', async ({ page }) => {
  await page.goto('/hostile/');
  const link = page.locator('astro-image-zoom a').first();
  const zoomSource = await link.locator('img').getAttribute('data-zoom-src');
  expect(zoomSource).toBeTruthy();
  await expect(link).toHaveAttribute('href', zoomSource!);
});
