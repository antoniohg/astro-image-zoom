import { expect, test } from '@playwright/test';
import {
  caption,
  counter,
  dialog,
  expectClosed,
  focusedLabel,
  focusRing,
  links,
  openZoom,
  settle,
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

  test('shows the image at full opacity from the first frame, with no blink', async ({ page }) => {
    // Checks the image the moment the opening animation starts, when the thumbnail hides. A
    // MutationObserver, not animation frames: those can pause on a busy machine
    const atStart = page.evaluate(
      () =>
        new Promise<{ opacity: string; fading: boolean }>((resolve) => {
          const dialog = document.querySelector('astro-image-zoom-overlay')!.shadowRoot!.querySelector('dialog')!;
          const observer = new MutationObserver(() => {
            if (!dialog.classList.contains('is-opening')) return;
            observer.disconnect();
            const image = dialog.querySelector<HTMLElement>('.astro-image-zoom-slide.is-active .astro-image-zoom-image')!;
            resolve({
              opacity: getComputedStyle(image).opacity,
              fading: image
                .getAnimations()
                .some((animation) => animation instanceof CSSTransition && animation.transitionProperty === 'opacity'),
            });
          });
          observer.observe(dialog, { attributes: true, attributeFilter: ['class'] });
        })
    );

    await openZoom(page, 'single');
    expect(await atStart).toEqual({ opacity: '1', fading: false });
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

  test('closes with a vertical wheel', async ({ page }) => {
    await openZoom(page, 'single');
    await page.mouse.move(640, 360);
    await page.mouse.wheel(0, 400);
    await expectClosed(page);
  });

  test('on a scroll close, the image stays above the backdrop that fades out', async ({ page }) => {
    await openZoom(page, 'single');

    // The moment the image leaves the dialog to scroll away with the page
    const layers = page.evaluate(
      () =>
        new Promise<Record<string, unknown>>((resolve) => {
          const root = document.querySelector('astro-image-zoom-overlay')!.shadowRoot!;
          const observer = new MutationObserver(() => {
            // A direct child of the shadow root: out of the dialog
            const image = [...root.children].find((child) => child.matches('.astro-image-zoom-image')) as
              | HTMLElement
              | undefined;
            if (!image) return;
            observer.disconnect();
            const backdrop = root.querySelector<HTMLElement>('.astro-image-zoom-backdrop')!;
            resolve({
              // Out of the dialog (the top layer) together, or the backdrop would cover the image
              backdropInDialog: backdrop.closest('dialog') !== null,
              imageAbove: Number(getComputedStyle(image).zIndex) > Number(getComputedStyle(backdrop).zIndex),
              backdropFading: backdrop.getAnimations().some((a) => (a as CSSAnimation).animationName === 'astro-image-zoom-backdrop-out'),
            });
          });
          observer.observe(root, { childList: true });
        })
    );

    await page.mouse.move(640, 360);
    await page.mouse.wheel(0, 400);
    expect(await layers).toEqual({ backdropInDialog: false, imageAbove: true, backdropFading: true });
    await expectClosed(page);

    // The backdrop is back in the dialog for the next opening
    await openZoom(page, 'single');
    await expect(page.locator('dialog .astro-image-zoom-backdrop')).toHaveCSS('opacity', '1');
  });

  test('stays open on a touchpad pinch (a wheel with Ctrl)', async ({ page }) => {
    await openZoom(page, 'single');
    await page.mouse.move(640, 360);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 400);
    await page.keyboard.up('Control');
    await page.waitForTimeout(300);
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
  });

  test('locks the page scroll, also when the site sets overflow on <html>', async ({ page }) => {
    await page.addStyleTag({ content: 'html, body { overflow-x: hidden; } body { min-height: 300vh; }' });
    await openZoom(page, 'no-close');
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.mouse.move(640, 360);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);

    await page.keyboard.press('Escape');
    await expectClosed(page);
  });

  test('keeps the page in place when the scrollbar goes away', async ({ page }) => {
    // Classic scrollbars, as on Windows; headless browsers overlay theirs
    await page.addStyleTag({
      content: '::-webkit-scrollbar { width: 17px; } ::-webkit-scrollbar-thumb { background: gray; } body { min-height: 300vh; }',
    });
    // WebKit applies the scrollbar style once the page's scroller is built again
    const scrollbar = await page.evaluate(() => {
      const root = document.documentElement;
      root.style.overflow = 'hidden';
      void root.offsetWidth;
      root.removeAttribute('style');
      return window.innerWidth - root.clientWidth;
    });
    test.skip(scrollbar === 0, 'no classic scrollbar in this browser');
    const bodyWidth = () => page.evaluate(() => document.body.getBoundingClientRect().width);
    const before = await bodyWidth();

    await openZoom(page, 'single');
    expect(await bodyWidth()).toBe(before);
    await page.keyboard.press('Escape');
    await expectClosed(page);
    expect(await bodyWidth()).toBe(before);
  });

  test('shows the thumbnail when the full-size image fails to load', async ({ page }) => {
    const link = links(page, 'single').first();
    await link.evaluate((anchor: HTMLAnchorElement) => (anchor.href = '/missing.jpg'));
    await openZoom(page, 'single');
    const thumbnail = await link.locator('img').evaluate((img: HTMLImageElement) => img.currentSrc);
    await expect(zoomedImage(page)).toHaveAttribute('src', thumbnail);
    expect(await zoomedImage(page).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test('stays open when every close option is off, except Escape', async ({ page }) => {
    await openZoom(page, 'no-close');
    await zoomedImage(page).click();
    const box = (await zoomedImage(page).boundingBox())!;
    await page.mouse.click(box.x / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);

    await page.keyboard.press('Escape');
    await expectClosed(page);
  });

  test('each <ImageZoom> is its own gallery, with its own options, on the shared overlay', async ({ page }) => {
    // A gallery that closes on a click on the image, opened and closed first
    await openZoom(page, 'gallery');
    await expect(counter(page)).toHaveText('1 / 3');
    await page.keyboard.press('Escape');
    await expectClosed(page);

    // Then one that does not: the shared overlay takes the slides and the options of this one
    await openZoom(page, 'no-close');
    await expect(page.locator('.astro-image-zoom-slide')).toHaveCount(1);
    await expect(counter(page)).toBeHidden();
    await zoomedImage(page).click();
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
    await page.keyboard.press('ArrowRight');
    await expect(zoomedImage(page)).toHaveAttribute('src', /portrait\.svg$/);
  });

  test('opens data-zoom-src and the href of a link', async ({ page }) => {
    await openZoom(page, 'sources', 0);
    await expect(zoomedImage(page)).toHaveAttribute('src', /landscape\.svg$/);
    await page.keyboard.press('ArrowRight');
    await expect(zoomedImage(page)).toHaveAttribute('src', /wide\.svg$/);
  });

  test('leaves a normal link with an image alone: it navigates and is not part of the gallery', async ({
    page,
  }) => {
    // Only the image the component wrapped opens, alone: no counter or arrows for the card
    await links(page, 'card-link').first().click();
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
    await expect(page.locator('.astro-image-zoom-toolbar')).toBeHidden();
    await page.keyboard.press('Escape');
    await expectClosed(page);

    await page.getByRole('link', { name: 'Card linking to another page' }).click();
    await expect(page).toHaveURL(/\/hostile\/$/);
  });

  test('leaves a data-zoom link without an image alone: it navigates and is not part of the gallery', async ({
    page,
  }) => {
    // The zoom animates from the image of the link: without one, there is nothing to open
    await links(page, 'text-link').first().click();
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
    await expect(page.locator('.astro-image-zoom-toolbar')).toBeHidden();
    await page.keyboard.press('Escape');
    await expectClosed(page);

    await page.getByRole('link', { name: 'Open the panorama' }).click();
    await expect(page).toHaveURL(/wide\.svg$/);
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
    await expect(dialog(page)).not.toHaveClass(/is-opening|is-open/);
    // The controls are hidden, not only transparent: nothing invisible to Tab to or click
    await expect(page.getByRole('button', { name: 'Close zoom overlay' })).toBeHidden();
    // The spinner shows once the wait lasts
    await expect
      .poll(() =>
        page
          .locator('.astro-image-zoom-slide.is-active')
          .evaluate((slide) => getComputedStyle(slide, '::after').visibility)
      )
      .toBe('visible');
    // On the thumbnail that was clicked: the backdrop is not there yet
    const spinner = await page
      .locator('.astro-image-zoom-slide.is-active')
      .evaluate((slide) => {
        const { left, top, position } = getComputedStyle(slide, '::after');
        return { x: parseFloat(left), y: parseFloat(top), position };
      });
    const thumbnail = (await links(page, 'single').first().locator('img').boundingBox())!;
    expect(spinner.position).toBe('fixed');
    expect(spinner.x).toBeCloseTo(thumbnail.x + thumbnail.width / 2, 0);
    expect(spinner.y).toBeCloseTo(thumbnail.y + thumbnail.height / 2, 0);

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
  }) => {
    await openZoom(page, 'gallery');
    expect(await focusedLabel(page)).toBe('Close zoom overlay');

    await page.keyboard.press('Tab');
    expect(await focusedLabel(page)).toBe('Previous image');
    await page.keyboard.press('Tab');
    expect(await focusedLabel(page)).toBe('Next image');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    expect(await focusedLabel(page)).toBe('Close zoom overlay');

    await page.keyboard.press('Escape');
    await expectClosed(page);
    await expect(links(page, 'gallery').first()).toBeFocused();
  });

  test('keeps Tab inside the zoom with a single image: only the close button, then the browser', async ({
    page,
  }) => {
    await openZoom(page, 'single');

    // Whatever has the focus: a control of the zoom by its label, "dialog" for the dialog itself,
    // or "page" for any element of the page behind it. <body> means the browser UI
    const focused = () =>
      page.evaluate(() => {
        const active = document.activeElement;
        if (active === document.body) return 'browser';
        const inner = active?.shadowRoot?.activeElement;
        if (!inner) return 'page';
        return inner.tagName === 'DIALOG' ? 'dialog' : inner.getAttribute('aria-label');
      });

    const stops = [await focused()];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      stops.push(await focused());
    }
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab');
      stops.push(await focused());
    }

    expect(stops[0]).toBe('Close zoom overlay');
    // Never the page behind, never the dialog itself (Safari made it a stop with no visible focus)
    for (const stop of stops) expect(['Close zoom overlay', 'browser']).toContain(stop);
  });

  test('leaves the focus ring of the generated link to the browser and the site', async ({ page }) => {
    const ring = await focusRing(links(page, 'single').first());
    // The browser's own ring, on the link; nothing drawn on the image
    expect(ring.link).not.toBe('none');
    expect(ring.image).toBe('none');
  });

  test('opens from the keyboard', async ({ page }) => {
    await links(page, 'single').first().focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
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

  test('tells the page when it opens, moves to another image and closes', async ({ page }) => {
    // One listener on the document hears the events of every gallery: they bubble
    await page.evaluate(() => {
      const log: unknown[] = [];
      (window as unknown as { zoomEvents: unknown[] }).zoomEvents = log;
      for (const type of ['open', 'change', 'close'] as const) {
        document.addEventListener(`astro-image-zoom:${type}`, ({ detail, target }) => {
          const { index, total, src, alt, caption, link } = detail;
          const from = (target as Element).closest('section')?.id;
          log.push({ type, index, total, src: src.split('/').pop(), alt, caption, link: link.tagName, from });
        });
      }
    });

    await openZoom(page, 'gallery');
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('2 / 3');
    await page.keyboard.press('Escape');
    await expectClosed(page);

    const common = { total: 3, link: 'A', from: 'gallery' };
    expect(await page.evaluate(() => (window as unknown as { zoomEvents: unknown[] }).zoomEvents)).toEqual([
      { type: 'open', index: 0, src: 'portrait.svg', alt: 'Pink portrait', caption: 'First', ...common },
      { type: 'change', index: 1, src: 'square.svg', alt: 'Green square', caption: 'Second', ...common },
      { type: 'close', index: 1, src: 'square.svg', alt: 'Green square', caption: 'Second', ...common },
    ]);
  });

  test('clicks on the caption and the controls do not close the zoom', async ({ page }) => {
    await openZoom(page, 'gallery');
    await caption(page).click();
    // Disabled at the first image (aria-disabled, so Playwright would not click it): nothing happens
    const previous = (await page.getByRole('button', { name: 'Previous image' }).boundingBox())!;
    await page.mouse.click(previous.x + previous.width / 2, previous.y + previous.height / 2);
    await counter(page).click();
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
    await expect(counter(page)).toHaveText('1 / 3');
  });

  test('slides to the next image in the time set by --zoom-slide-duration, in every browser', async ({
    page,
  }) => {
    await openZoom(page, 'gallery');
    await page.keyboard.press('ArrowRight');

    // The track is on the next image at once; the images glide there with a CSS transition
    const transition = await zoomedImage(page).evaluate((image) => {
      const [glide] = image
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition && animation.transitionProperty === 'translate');
      return glide && { property: (glide as CSSTransition).transitionProperty, duration: glide.effect?.getComputedTiming().duration };
    });
    expect(transition).toEqual({ property: 'translate', duration: 400 });

    await expect(counter(page)).toHaveText('2 / 3');
    await settle(page);
    // At rest, exactly on the second image
    const box = (await zoomedImage(page).boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(1);
  });

  test('keeps gliding from where it is when the arrows are pressed again', async ({ page }) => {
    await openZoom(page, 'gallery');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('3 / 3');
    await settle(page);
    const box = (await zoomedImage(page).boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(1);
  });

  test('moves with the buttons', async ({ page }) => {
    await openZoom(page, 'gallery', 1);
    await expect(counter(page)).toHaveText('2 / 3');
    await page.getByRole('button', { name: 'Next image' }).click();
    await expect(counter(page)).toHaveText('3 / 3');
    await page.getByRole('button', { name: 'Previous image' }).click();
    await expect(counter(page)).toHaveText('2 / 3');
  });

  test('keeps no layer per slide, which made iOS Safari drop the images off screen', async ({ page }) => {
    // will-change on every slide took so much memory that iOS Safari dropped the decoded pixels of
    // the images off screen: a slide swiped back to flashed blank while it decoded again
    await openZoom(page, 'gallery');
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('2 / 3');
    await settle(page);

    const willChange = await page
      .locator('.astro-image-zoom-image')
      .evaluateAll((images) => images.map((image) => getComputedStyle(image).willChange));
    expect(willChange).toEqual(['auto', 'auto', 'auto']);
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

  test('starts and ends the animation on what a cropped thumbnail shows', async ({ page }) => {
    // The width of the whole image when it sits on the thumbnail: the scale the animation starts
    // from (opening) or ends at (closing), times the width of the zoomed image
    const widthOnThumbnail = () =>
      zoomedImage(page).evaluate(
        (image: HTMLElement) => Number(image.style.getPropertyValue('--scale-from')) * image.offsetWidth
      );

    // A 1600×1000 file of an 800×1200 image, covering a 150×200 box: the file is drawn 320×200, so
    // the image around it is 320 px wide. Read while the slow animation of the fixture runs
    await links(page, 'fit').first().click();
    await expect(dialog(page)).toHaveClass(/is-opening/);
    expect(await widthOnThumbnail()).toBeCloseTo(320, 0);

    // Finish the opening at once: a close during it starts from the moving image instead
    await dialog(page).evaluate((overlay) => overlay.getAnimations({ subtree: true }).forEach((a) => a.finish()));
    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveClass(/is-closing/);
    expect(await widthOnThumbnail()).toBeCloseTo(320, 0);
  });

  test('honors showCaption and showCounter', async ({ page }) => {
    await openZoom(page, 'hidden');
    await expect(counter(page)).toBeHidden();
    await expect(caption(page)).toBeHidden();
  });

  test('leaves out the images of the ignore prop and those with data-zoom-ignore', async ({ page }) => {
    // The server wraps only the two kept images; the link with data-zoom is the site's own
    await expect(links(page, 'ignore')).toHaveCount(3);
    await openZoom(page, 'ignore');
    await expect(counter(page)).toHaveText('1 / 2');
    await page.keyboard.press('ArrowRight');
    await expect(zoomedImage(page)).toHaveAttribute('src', /landscape\.svg$/);
    await page.keyboard.press('Escape');
    await expectClosed(page);

    // The client leaves the link inside the ignored element out too, also when ZoomClass users set an
    // invalid data-ignore by hand: it stays a plain link and navigates
    await page.locator('#ignore astro-image-zoom').evaluate((wrapper) => wrapper.setAttribute('data-ignore', ':::'));
    await page.locator('#ignore a[data-zoom]').click();
    await expect(page).toHaveURL(/portrait\.svg$/);
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

    await expect(dialog(page)).toHaveClass(/\bis-open\b/);
    await expect(page.locator('.astro-image-zoom-backdrop')).toHaveCSS('background-color', 'rgb(5, 10, 26)');
    await expect(page.getByRole('button', { name: 'Close zoom overlay' })).toHaveCSS('color', 'rgb(142, 203, 255)');
  });

  test('closed during the opening, closes from where the image is, with no jump', async ({ page }) => {
    // 800ms opening: close it about halfway
    await links(page, 'theme').first().click();
    await expect(dialog(page)).toHaveClass(/is-opening/);
    await page.waitForTimeout(300);

    // In one go in the page, so the opening does not move on in between: read where it is, close it
    // as Escape does (the dialog's cancel event), then follow the next frames
    const { before, seen } = await page.evaluate(async () => {
      const root = document.querySelector('astro-image-zoom-overlay')!.shadowRoot!;
      const image = root.querySelector('.astro-image-zoom-slide.is-active .astro-image-zoom-image')!;
      const backdrop = root.querySelector('.astro-image-zoom-backdrop')!;
      const state = () => ({
        width: image.getBoundingClientRect().width,
        opacity: Number(getComputedStyle(backdrop).opacity),
      });
      const before = state();
      root.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
      const seen = [];
      for (let frame = 0; frame < 8; frame++) {
        await new Promise(requestAnimationFrame);
        seen.push(state());
      }
      return { before, seen };
    });
    // The close starts where the opening was, give or take the few ms WebKit's clock moves on
    // between reads (a jump to full size would be hundreds of px), then only shrinks and fades
    expect(seen[0].width).toBeLessThanOrEqual(before.width * 1.02);
    expect(seen[0].opacity).toBeLessThanOrEqual(before.opacity + 0.02);
    for (let frame = 1; frame < seen.length; frame++) {
      expect(seen[frame].width).toBeLessThanOrEqual(seen[frame - 1].width + 0.5);
      expect(seen[frame].opacity).toBeLessThanOrEqual(seen[frame - 1].opacity + 0.005);
    }
    await expectClosed(page);
  });

  test('closed by a scroll during the opening, lands on the thumbnail where the page took it', async ({ page }) => {
    await links(page, 'theme').first().click();
    await expect(dialog(page)).toHaveClass(/is-opening/);
    await page.waitForTimeout(300);

    // The last box of the image before it goes, and the box of the thumbnail then
    const landing = page.evaluate(
      () =>
        new Promise<number[][]>((resolve) => {
          const root = document.querySelector('astro-image-zoom-overlay')!.shadowRoot!;
          const thumbnail = document.querySelector('#theme img')!;
          const box = (element: Element) => {
            const { left, top, height } = element.getBoundingClientRect();
            return [left, top + height / 2];
          };
          let last: number[][] = [];
          const frame = () => {
            const image = [...root.children].find((child) => child.matches('.astro-image-zoom-image'));
            if (image) last = [box(image), box(thumbnail)];
            else if (last.length) return resolve(last);
            requestAnimationFrame(frame);
          };
          frame();
        })
    );
    await page.mouse.move(640, 360);
    for (let step = 0; step < 6; step++) await page.mouse.wheel(0, 80);
    const [image, thumbnail] = await landing;
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect(image[0]).toBeCloseTo(thumbnail[0], 0);
    expect(image[1]).toBeCloseTo(thumbnail[1], 0);
    await expectClosed(page);
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
    await page.keyboard.press('Escape');
    await expectClosed(page);

    // The arrows change the image at once, with no slide
    await openZoom(page, 'gallery');
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('2 / 3');
    await expect(zoomedImage(page)).toHaveCSS('transition-duration', '0s');
    await page.keyboard.press('Escape');
    await expectClosed(page);
  });
});
