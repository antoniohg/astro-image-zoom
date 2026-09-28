import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import ImageZoom from '../ImageZoom.astro';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

// Renders the component around some images and returns the attributes of <astro-image-zoom>
async function render(
  props: Record<string, unknown> = {},
  slot = '<img src="/photo.jpg" alt="A photo">'
): Promise<{ html: string; attributes: Map<string, string> }> {
  const html = await container.renderToString(ImageZoom, { props, slots: { default: slot } });
  const tag = /<astro-image-zoom\b([^>]*)>/.exec(html);
  if (!tag) throw new Error(`No <astro-image-zoom> in:\n${html}`);

  const attributes = new Map<string, string>();
  for (const [, name, value] of tag[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
    attributes.set(name, value ?? '');
  }
  return { html, attributes };
}

describe('<ImageZoom>', () => {
  it('renders the defaults as data attributes', async () => {
    const { attributes } = await render();
    expect(Object.fromEntries(attributes)).toMatchObject({
      class: 'astro-image-zoom-wrapper',
      'data-close-backdrop': 'true',
      'data-close-image': 'true',
      'data-close-scroll': 'true',
      'data-show-nav': 'true',
      'data-navigation-layout': 'bar',
      'data-show-counter': 'true',
      'data-show-caption': 'true',
      'data-caption-position': 'bottom',
    });
    // No theme and no duration: the variables of the site apply
    expect(attributes.has('style')).toBe(false);
  });

  it('renders every option as its data attribute', async () => {
    const { attributes } = await render({
      closeOnBackdrop: false,
      closeOnImage: false,
      closeOnScroll: false,
      showNavigation: false,
      navigationLayout: 'sides',
      showCounter: false,
      showCaption: false,
      captionPosition: 'top',
      class: 'portfolio',
    });
    expect(Object.fromEntries(attributes)).toMatchObject({
      class: 'astro-image-zoom-wrapper portfolio',
      'data-close-backdrop': 'false',
      'data-close-image': 'false',
      'data-close-scroll': 'false',
      'data-show-nav': 'false',
      'data-navigation-layout': 'sides',
      'data-show-counter': 'false',
      'data-show-caption': 'false',
      'data-caption-position': 'top',
    });
  });

  it('turns the theme and the duration into --zoom-* variables', async () => {
    const { attributes } = await render({
      theme: {
        backgroundColor: '#050a1a',
        closeButtonColor: 'white',
        closeButtonBackground: 'black',
        navigationColor: 'rgb(1, 2, 3)',
        navigationBackground: 'navy',
        captionColor: 'red',
        captionBackground: 'light-dark(#fff, #000)',
      },
      animationDuration: 800,
    });
    expect(attributes.get('style')).toBe(
      '--zoom-bg: #050a1a; --zoom-close-color: white; --zoom-close-bg: black; ' +
        '--zoom-nav-color: rgb(1, 2, 3); --zoom-nav-bg: navy; --zoom-caption-color: red; ' +
        '--zoom-caption-bg: light-dark(#fff, #000); --zoom-animation-duration: 800ms'
    );
  });

  it('sets only the variables it is given', async () => {
    expect((await render({ theme: { navigationColor: 'red' } })).attributes.get('style')).toBe(
      '--zoom-nav-color: red'
    );
    expect((await render({ animationDuration: 0 })).attributes.get('style')).toBe(
      '--zoom-animation-duration: 0ms'
    );
  });

  it('declares its display in its own shadow root, with no stylesheet on the page', async () => {
    const { html } = await render();
    expect(html).toMatch(
      /<astro-image-zoom\b[^>]*>\s*<template shadowrootmode="open"><style>:host \{ display: contents; \}<\/style><slot><\/slot><\/template>/
    );
    expect(html).not.toContain('<link');
  });

  it('wraps the images of the slot in zoom links', async () => {
    const { html } = await render(
      {},
      '<p>Text</p><img src="/one.jpg" alt="One" data-zoom-caption="First"><a href="/big.jpg" data-zoom><img src="/small.jpg" alt="Two"></a>'
    );
    expect(html).toContain(
      '<a href="/one.jpg" data-zoom-generated data-zoom-caption="First" aria-label="Enlarge image: One"><img src="/one.jpg" alt="One" data-zoom-caption="First"></a>'
    );
    // Already in a link: left alone
    expect(html).toContain('<a href="/big.jpg" data-zoom><img src="/small.jpg" alt="Two"></a>');
    expect(html).toContain('<p>Text</p>');
  });
});
