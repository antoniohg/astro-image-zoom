import { expect, test } from '@playwright/test';
import { dialog, expectClosed, links, openZoom } from './helpers';

// The labels come from the translations set in the integration (e2e/fixture/astro.config.mjs),
// chosen by the locale of the page: the pages under /es/ are Spanish, the rest English.
test.describe('translations from the integration', () => {
  test('the Spanish page reads Spanish, in the links and in the overlay', async ({ page }) => {
    await page.goto('/es/');
    await expect(links(page, 'translated').first()).toHaveAttribute('aria-label', 'Ampliar imagen: Paisaje');

    await openZoom(page, 'translated');
    await expect(dialog(page)).toHaveAttribute('aria-label', 'Zoom de imagen');
    await expect(page.getByRole('button', { name: 'Cerrar zoom' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Imágenes' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Imagen anterior' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Imagen siguiente' })).toBeAttached();
    await page.keyboard.press('Escape');
    await expectClosed(page);
  });

  test('the labels prop overrides the translation of the page', async ({ page }) => {
    await page.goto('/es/');
    await openZoom(page, 'override');
    await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
    // The rest is still the translation of the page
    await expect(dialog(page)).toHaveAttribute('aria-label', 'Zoom de imagen');
  });

  test('a gallery with its own labels does not leak them into the next one', async ({ page }) => {
    // The overlay is shared by the galleries of the page; the second one is English, by its locale
    await page.goto('/es/');
    await openZoom(page, 'override');
    await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expectClosed(page);

    await expect(links(page, 'english').first()).toHaveAttribute('aria-label', 'Enlarge image: Portrait');
    await openZoom(page, 'english');
    await expect(page.getByRole('button', { name: 'Close zoom overlay' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
  });

  test('the English page stays in English', async ({ page }) => {
    await page.goto('/');
    await expect(links(page, 'gallery').first()).toHaveAttribute('aria-label', 'Enlarge image: Pink portrait');
    await openZoom(page, 'gallery');
    await expect(page.getByRole('button', { name: 'Close zoom overlay' })).toBeVisible();
  });
});
