import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import ImageZoom from '../ImageZoom.astro';

// What the integration would put in config.js: the translations of the site
vi.mock('../config.js', () => ({
  default: {
    labels: {
      es: { close: 'Cerrar zoom', enlargeNamed: 'Ampliar imagen: {alt}', enlarge: 'Ampliar imagen' },
      fr: { close: 'Fermer' },
    },
  },
}));

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
      'data-keyboard': 'true',
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
      keyboardNavigation: false,
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
      'data-keyboard': 'false',
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
      theme: { backgroundColor: '#050a1a', closeButtonColor: 'white', navigationColor: 'rgb(1, 2, 3)' },
      animationDuration: 800,
    });
    expect(attributes.get('style')).toBe(
      '--zoom-bg: #050a1a; --zoom-close-color: white; --zoom-nav-color: rgb(1, 2, 3); --zoom-animation-duration: 800ms'
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

  it('renders no label attributes by default: the overlay speaks English', async () => {
    const { attributes } = await render();
    expect([...attributes.keys()].filter((name) => name.startsWith('data-label-'))).toEqual([]);
  });

  it('renders the labels of the overlay as data attributes, only the ones it is given', async () => {
    const { attributes } = await render({ labels: { close: 'Cerrar', next: 'Siguiente imagen' } });
    expect(attributes.get('data-label-close')).toBe('Cerrar');
    expect(attributes.get('data-label-next')).toBe('Siguiente imagen');
    expect(attributes.has('data-label-previous')).toBe(false);
  });

  it('cannot break out of the attribute with a quote in a label', async () => {
    const { attributes } = await render({ labels: { close: 'Cerrar" onclick="alert(1)' } });
    expect(attributes.get('data-label-close')).toBe('Cerrar&quot; onclick=&quot;alert(1)');
    expect(attributes.has('onclick')).toBe(false);
  });

  it('names the zoom links with the labels', async () => {
    const { html } = await render(
      { labels: { enlargeNamed: 'Ampliar imagen: {alt}', enlarge: 'Ampliar imagen' } },
      '<img src="/one.jpg" alt="Uno"><img src="/two.jpg">'
    );
    expect(html).toContain('aria-label="Ampliar imagen: Uno"');
    expect(html).toContain('aria-label="Ampliar imagen"');
  });

  it('keeps the English name of the links for the labels it is not given', async () => {
    const { html } = await render({ labels: { close: 'Cerrar' } });
    expect(html).toContain('aria-label="Enlarge image: A photo"');
  });

  describe('with the translations of the site', () => {
    it('is in English when the page has no locale', async () => {
      const { attributes, html } = await render();
      expect(attributes.has('data-label-close')).toBe(false);
      expect(html).toContain('aria-label="Enlarge image: A photo"');
    });

    it('takes the translation of the locale prop, for the overlay and for the links', async () => {
      const { attributes, html } = await render({ locale: 'es' });
      expect(attributes.get('data-label-close')).toBe('Cerrar zoom');
      // Not translated in es: English, so no attribute either
      expect(attributes.has('data-label-next')).toBe(false);
      expect(html).toContain('aria-label="Ampliar imagen: A photo"');
    });

    it('matches the language of a regional locale', async () => {
      expect((await render({ locale: 'es-MX' })).attributes.get('data-label-close')).toBe('Cerrar zoom');
    });

    it('is in English for a locale the site did not translate', async () => {
      const { attributes, html } = await render({ locale: 'de' });
      expect(attributes.has('data-label-close')).toBe(false);
      expect(html).toContain('aria-label="Enlarge image: A photo"');
    });

    it('lets the labels prop override the translation, key by key', async () => {
      const { attributes, html } = await render({ locale: 'es', labels: { close: 'Salir' } });
      expect(attributes.get('data-label-close')).toBe('Salir');
      expect(html).toContain('aria-label="Ampliar imagen: A photo"');
    });
  });
});
