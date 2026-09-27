import { expect, test, type Page } from '@playwright/test';
import { dialog, focusRing, settle } from './helpers';

// The computed styles of the overlay, opened on the second image of the gallery of /hostile/
async function overlayStyles(page: Page, url: string): Promise<Record<string, string>> {
  await page.goto(url);
  await page.locator('astro-image-zoom a').nth(1).click();
  await expect(dialog(page)).toHaveClass(/is-open/);
  await settle(page);

  return page.evaluate(() => {
    const root = document.querySelector('astro-image-zoom-overlay')!.shadowRoot!;
    const properties = [
      'display',
      'visibility',
      'opacity',
      'width',
      'height',
      'color',
      'background-color',
      'border-top-width',
      'border-radius',
      'padding-top',
      'font-size',
      'letter-spacing',
      'text-transform',
      'filter',
      'transition-duration',
    ];
    const parts = {
      dialog: 'dialog',
      backdrop: '.astro-image-zoom-backdrop',
      close: '.astro-image-zoom-close',
      icon: '.astro-image-zoom-close svg',
      path: '.astro-image-zoom-close path',
      toolbar: '.astro-image-zoom-toolbar',
      counter: '.astro-image-zoom-counter',
      caption: '.astro-image-zoom-caption',
      image: '.astro-image-zoom-slide.is-active .astro-image-zoom-image',
    };

    const styles: Record<string, string> = {};
    for (const [part, selector] of Object.entries(parts)) {
      const computed = getComputedStyle(root.querySelector(selector)!);
      for (const property of properties) {
        styles[`${part} ${property}`] = computed.getPropertyValue(property);
      }
    }
    // The stroke of the icons, which a page rule on svg or path could remove
    styles['path stroke'] = getComputedStyle(root.querySelector('.astro-image-zoom-close path')!).stroke;
    return styles;
  });
}

test('the CSS of the page cannot change the overlay', async ({ page }) => {
  const normal = await overlayStyles(page, '/hostile/');
  const hostile = await overlayStyles(page, '/hostile/?hostile');

  // The hostile stylesheet is on, and it does break the page itself
  expect(await page.evaluate(() => (document.querySelector('#hostile') as HTMLStyleElement).media)).toBe('all');
  await expect(page.locator('h1')).toHaveCSS('text-transform', 'uppercase');

  expect(hostile).toEqual(normal);
});

test('the focus style of the page reaches the generated link as the site wrote it', async ({ page }) => {
  await page.goto('/hostile/?hostile');
  const ring = await focusRing(page.locator('astro-image-zoom a').first());
  expect(ring).toEqual({ link: 'solid', image: 'none' });
});

test('the component adds no box of its own, and any rule of the site changes that', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#single astro-image-zoom')).toHaveCSS('display', 'contents');
  // A layered rule of the site wins over the default of the component
  await expect(page.locator('#site-layout astro-image-zoom')).toHaveCSS('display', 'grid');
});

test('a page parsed by a client router, which ignores declarative shadow roots, still works', async ({
  page,
}) => {
  await page.goto('/');
  // What Astro's client router does: parse the new page with DOMParser and move its nodes in
  await page.evaluate(async () => {
    const html = await (await fetch('/')).text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const gallery = parsed.querySelector('#gallery')!;
    gallery.id = 'swapped';
    document.querySelector('main')!.prepend(document.adoptNode(gallery));
  });

  const zoom = page.locator('#swapped astro-image-zoom');
  await expect(zoom).toHaveCSS('display', 'contents');
  expect(await zoom.evaluate((element) => element.querySelector('template'))).toBeNull();

  await zoom.locator('a').first().click();
  await expect(dialog(page)).toHaveClass(/is-open/);
});
