import { expect, test } from '@playwright/test';
import {
  caption,
  counter,
  dialog,
  expectClosed,
  focusedLabel,
  links,
  openZoom,
  zoomedImage,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('open and close', () => {
  test('opens the image with its caption and closes with Escape', async ({ page }) => {
    await openZoom(page, 'single');
    await expect(zoomedImage(page)).toHaveAttribute('src', /landscape\.svg$/);
    await expect(caption(page)).toHaveText('A single image');
    await expect(counter(page)).toBeHidden();

    await page.keyboard.press('Escape');
    await expectClosed(page);
  });

  test('closes with the close button', async ({ page }) => {
    await openZoom(page, 'single');
    await page.getByRole('button', { name: 'Close zoom overlay' }).click();
    await expectClosed(page);
  });

  test('closes with a click on the image', async ({ page }) => {
    await openZoom(page, 'single');
    await zoomedImage(page).click();
    await expectClosed(page);
  });

  test('closes with a click on the backdrop', async ({ page }) => {
    await openZoom(page, 'single');
    const box = (await zoomedImage(page).boundingBox())!;
    await page.mouse.click(box.x / 2, box.y + box.height / 2);
    await expectClosed(page);
  });

  test('closes with the wheel and lets the page scroll', async ({ page }) => {
    await openZoom(page, 'single');
    await page.mouse.move(640, 360);
    await page.mouse.wheel(0, 400);
    await expectClosed(page);
  });

  test('stays open when every close option is off, except Escape', async ({ page }) => {
    await openZoom(page, 'no-close');
    await zoomedImage(page).click();
    const box = (await zoomedImage(page).boundingBox())!;
    await page.mouse.click(box.x / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await expect(dialog(page)).toHaveClass(/is-open/);

    await page.keyboard.press('Escape');
    await expectClosed(page);
  });

  test('opens data-zoom-src and the href of a link', async ({ page }) => {
    await openZoom(page, 'sources', 0);
    await expect(zoomedImage(page)).toHaveAttribute('src', /landscape\.svg$/);
    await page.keyboard.press('ArrowRight');
    await expect(zoomedImage(page)).toHaveAttribute('src', /wide\.svg$/);
  });

  test('closes at once while the image is still loading, and never opens later', async ({ page }) => {
    // A new URL for the zoom, so neither the cache nor a thumbnail serves it
    await links(page, 'single').first().evaluate((link: HTMLAnchorElement) => {
      link.href = '/images/landscape.svg?slow';
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/landscape.svg?slow', async (route) => {
      await held;
      await route.continue();
    });

    await links(page, 'single').first().click();
    await expect(dialog(page)).toHaveAttribute('open');
    // The spinner shows after a short wait
    await expect(page.locator('.astro-image-zoom-slide.is-loading')).toHaveCount(1);
    await expect(dialog(page)).not.toHaveClass(/is-opening|is-open/);

    await page.keyboard.press('Escape');
    await expectClosed(page);

    // The image arrives after the close: the overlay must not come back
    release();
    await page.waitForTimeout(500);
    await expectClosed(page);
  });
});

test.describe('focus', () => {
  test('moves to the close button, cycles through the controls and returns to the image', async ({
    page,
    browserName,
  }) => {
    await openZoom(page, 'gallery');
    expect(await focusedLabel(page)).toBe('Close zoom overlay');

    // WebKit on macOS only tabs to buttons with the full keyboard access setting
    if (browserName !== 'webkit') {
      await page.keyboard.press('Tab');
      expect(await focusedLabel(page)).toBe('Previous image');
      await page.keyboard.press('Tab');
      expect(await focusedLabel(page)).toBe('Next image');
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      expect(await focusedLabel(page)).toBe('Close zoom overlay');
    }

    await page.keyboard.press('Escape');
    await expectClosed(page);
    await expect(links(page, 'gallery').first()).toBeFocused();
  });

  test('opens from the keyboard', async ({ page }) => {
    await links(page, 'single').first().focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toHaveClass(/is-open/);
    expect(await focusedLabel(page)).toBe('Close zoom overlay');
  });
});

test.describe('gallery', () => {
  test('moves with the arrow keys and updates the counter and caption', async ({ page }) => {
    await openZoom(page, 'gallery');
    await expect(counter(page)).toHaveText('1 / 3');
    await expect(caption(page)).toHaveText('First');
    await expect(page.getByRole('button', { name: 'Previous image' })).toHaveAttribute('aria-disabled', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('2 / 3');
    await expect(caption(page)).toHaveText('Second');

    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('3 / 3');
    await expect(page.getByRole('button', { name: 'Next image' })).toHaveAttribute('aria-disabled', 'true');

    // Past the end, nothing moves
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('3 / 3');

    await page.keyboard.press('ArrowLeft');
    await expect(counter(page)).toHaveText('2 / 3');
  });

  test('clicks on the caption and the controls do not close the zoom', async ({ page }) => {
    await openZoom(page, 'gallery');
    await caption(page).click();
    // Disabled at the first image (aria-disabled, so Playwright would not click it): nothing happens
    const previous = (await page.getByRole('button', { name: 'Previous image' }).boundingBox())!;
    await page.mouse.click(previous.x + previous.width / 2, previous.y + previous.height / 2);
    await counter(page).click();
    await expect(dialog(page)).toHaveClass(/is-open/);
    await expect(counter(page)).toHaveText('1 / 3');
  });

  test('moves with the buttons', async ({ page }) => {
    await openZoom(page, 'gallery', 1);
    await expect(counter(page)).toHaveText('2 / 3');
    await page.getByRole('button', { name: 'Next image' }).click();
    await expect(counter(page)).toHaveText('3 / 3');
    await page.getByRole('button', { name: 'Previous image' }).click();
    await expect(counter(page)).toHaveText('2 / 3');
  });

  test('hides only the thumbnail of the image on screen, and closes to it', async ({ page }) => {
    await openZoom(page, 'gallery');
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('2 / 3');

    const opacities = await links(page, 'gallery').locator('img').evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).style.opacity)
    );
    expect(opacities).toEqual(['', '0', '']);

    await page.keyboard.press('Escape');
    await expectClosed(page);
  });

  test('honors keyboardNavigation, showCaption and showCounter', async ({ page }) => {
    await openZoom(page, 'hidden');
    await expect(counter(page)).toBeHidden();
    await expect(caption(page)).toBeHidden();

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await expect(zoomedImage(page)).toHaveAttribute('src', /wide\.svg$/);
  });

  test('places the caption at the top and the arrows at the sides', async ({ page }) => {
    await openZoom(page, 'layout');
    const viewport = page.viewportSize()!;

    const captionBox = (await caption(page).boundingBox())!;
    expect(captionBox.y).toBeLessThan(viewport.height / 4);

    const previous = (await page.getByRole('button', { name: 'Previous image' }).boundingBox())!;
    const next = (await page.getByRole('button', { name: 'Next image' }).boundingBox())!;
    expect(previous.x).toBeLessThan(viewport.width / 4);
    expect(next.x).toBeGreaterThan((viewport.width * 3) / 4);
  });
});

test.describe('theming', () => {
  test('applies the theme and animationDuration props', async ({ page }) => {
    await links(page, 'theme').first().click();
    await expect(dialog(page)).toHaveClass(/is-opening/);
    const duration = await zoomedImage(page).evaluate((image) => {
      const zoomIn = image
        .getAnimations()
        .find((animation) => animation instanceof CSSAnimation && animation.animationName === 'astro-image-zoom-in');
      return zoomIn?.effect?.getComputedTiming().duration;
    });
    expect(duration).toBe(800);

    await expect(dialog(page)).toHaveClass(/is-open/);
    await expect(page.locator('.astro-image-zoom-backdrop')).toHaveCSS('background-color', 'rgb(5, 10, 26)');
    await expect(page.getByRole('button', { name: 'Close zoom overlay' })).toHaveCSS('color', 'rgb(142, 203, 255)');
  });

  test('takes the variables set around a gallery, and drops them for the next one', async ({ page }) => {
    await openZoom(page, 'variables');
    await expect(zoomedImage(page)).toHaveCSS('border-radius', '16px');
    await expect(page.locator('.astro-image-zoom-slide.is-active')).toHaveCSS('padding-top', '40px');
    await expect(page.locator('.astro-image-zoom-backdrop')).toHaveCSS('background-color', 'rgb(30, 0, 40)');
    await page.keyboard.press('Escape');
    await expectClosed(page);

    await openZoom(page, 'single');
    await expect(zoomedImage(page)).toHaveCSS('border-radius', '0px');
    await expect(page.locator('.astro-image-zoom-backdrop')).not.toHaveCSS('background-color', 'rgb(30, 0, 40)');
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('opens and closes without animating', async ({ page }) => {
    await openZoom(page, 'single');
    await expect(zoomedImage(page)).toHaveCSS('animation-duration', '0s');
    await expect(page.locator('.astro-image-zoom-track')).toHaveCSS('scroll-behavior', 'auto');
    await page.keyboard.press('Escape');
    await expectClosed(page);
  });
});
