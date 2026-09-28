import { describe, expect, it } from 'vitest';
import { parseIgnore, wrapImages } from '../wrapImages';

describe('wrapImages', () => {
  it('wraps an image in a link to its source, named after the image', () => {
    expect(wrapImages('<img src="/photo.jpg" alt="A red car">')).toBe(
      '<a href="/photo.jpg" data-zoom-generated aria-label="Enlarge image: A red car"><img src="/photo.jpg" alt="A red car"></a>'
    );
  });

  it('names the link without the alt text when the image has none', () => {
    expect(wrapImages('<img src="/photo.jpg">')).toContain('aria-label="Enlarge image"');
  });

  it('links to data-zoom-src over src', () => {
    expect(wrapImages('<img src="/small.jpg" data-zoom-src="/large.jpg" alt="">')).toContain(
      'href="/large.jpg"'
    );
  });

  it('copies the caption to the link, escaping its quotes', () => {
    const html = wrapImages(`<img src="/a.jpg" alt="" data-zoom-caption='The "Blue Marble"'>`);
    expect(html).toContain('data-zoom-caption="The &quot;Blue Marble&quot;"');
  });

  it('keeps the entities of the original values', () => {
    const html = wrapImages('<img src="/a.jpg?w=1&amp;h=2" alt="Salt &amp; pepper">');
    expect(html).toContain('href="/a.jpg?w=1&amp;h=2"');
    expect(html).toContain('aria-label="Enlarge image: Salt &amp; pepper"');
  });

  it('wraps every image and keeps the markup around them', () => {
    const html = wrapImages('<p>One</p><img src="/1.jpg" alt="1"><div><img src="/2.jpg" alt="2" /></div>');
    expect(html).toBe(
      '<p>One</p><a href="/1.jpg" data-zoom-generated aria-label="Enlarge image: 1"><img src="/1.jpg" alt="1"></a>' +
        '<div><a href="/2.jpg" data-zoom-generated aria-label="Enlarge image: 2"><img src="/2.jpg" alt="2" /></a></div>'
    );
  });

  it('leaves alone images that already live inside a link', () => {
    const html = '<a href="/large.jpg" data-zoom><span><img src="/small.jpg" alt=""></span></a><img src="/next.jpg" alt="">';
    expect(wrapImages(html)).toBe(
      '<a href="/large.jpg" data-zoom><span><img src="/small.jpg" alt=""></span></a>' +
        '<a href="/next.jpg" data-zoom-generated aria-label="Enlarge image"><img src="/next.jpg" alt=""></a>'
    );
  });

  it('wraps a <picture> as a whole, with the attributes of its <img>', () => {
    const picture =
      '<picture><source srcset="/a.avif" type="image/avif"><img src="/a.jpg" data-zoom-src="/a-large.jpg" alt="Moon"></picture>';
    expect(wrapImages(picture)).toBe(
      `<a href="/a-large.jpg" data-zoom-generated aria-label="Enlarge image: Moon">${picture}</a>`
    );
  });

  describe('data-zoom-ignore', () => {
    it('leaves an image with data-zoom-ignore alone', () => {
      const html = '<img src="/logo.svg" alt="Logo" data-zoom-ignore>';
      expect(wrapImages(html)).toBe(html);
    });

    it('leaves a <picture> alone when its image has data-zoom-ignore', () => {
      const picture = '<picture><source srcset="/a.avif"><img src="/a.jpg" alt="" data-zoom-ignore></picture>';
      expect(wrapImages(picture)).toBe(picture);
    });

    it('leaves alone every image inside an element with data-zoom-ignore, nested ones too', () => {
      const ignored =
        '<div data-zoom-ignore="true"><div><img src="/1.jpg" alt=""></div><img src="/2.jpg" alt=""></div>';
      expect(wrapImages(`${ignored}<img src="/3.jpg" alt="">`)).toBe(
        `${ignored}<a href="/3.jpg" data-zoom-generated aria-label="Enlarge image"><img src="/3.jpg" alt=""></a>`
      );
    });

    it('reads the attribute, not text that mentions it', () => {
      expect(wrapImages('<p title="data-zoom-ignore"><img src="/1.jpg" alt=""></p>')).toBe(
        '<p title="data-zoom-ignore"><a href="/1.jpg" data-zoom-generated aria-label="Enlarge image"><img src="/1.jpg" alt=""></a></p>'
      );
    });
  });

  describe('the ignore selectors', () => {
    const wrapped = (src: string) =>
      `<a href="${src}" data-zoom-generated aria-label="Enlarge image"><img src="${src}" alt=""></a>`;

    it('leaves out the images a selector matches: tag, class, id and attribute', () => {
      const ignore = parseIgnore('.logo, #hero, [data-icon], img[alt="Author"]');
      const html =
        '<img class="big logo" src="/1.jpg" alt=""><img id="hero" src="/2.jpg" alt="">' +
        '<img data-icon src="/3.jpg" alt=""><img src="/4.jpg" alt="Author"><img src="/5.jpg" alt="">';
      expect(wrapImages(html, ignore)).toBe(
        '<img class="big logo" src="/1.jpg" alt=""><img id="hero" src="/2.jpg" alt="">' +
          '<img data-icon src="/3.jpg" alt=""><img src="/4.jpg" alt="Author">' + wrapped('/5.jpg')
      );
    });

    it('leaves out every image inside an element a selector matches', () => {
      const aside = '<aside class="author"><p><img src="/1.jpg" alt=""></p></aside>';
      expect(wrapImages(`${aside}<img src="/2.jpg" alt="">`, parseIgnore('aside.author'))).toBe(
        aside + wrapped('/2.jpg')
      );
    });

    it('matches an empty alt, the mark of a decorative image', () => {
      expect(wrapImages('<img src="/1.jpg" alt=""><img src="/2.jpg" alt="Photo">', parseIgnore("[alt='']"))).toBe(
        '<img src="/1.jpg" alt="">' +
          '<a href="/2.jpg" data-zoom-generated aria-label="Enlarge image: Photo"><img src="/2.jpg" alt="Photo"></a>'
      );
    });

    it('needs every part of a compound selector', () => {
      const image = '<img class="logo" src="/1.jpg" alt="">';
      expect(wrapImages(image, parseIgnore('picture.logo'))).toBe(
        `<a href="/1.jpg" data-zoom-generated aria-label="Enlarge image">${image}</a>`
      );
    });

    it('forgives spaces around the selectors and a trailing comma', () => {
      expect(parseIgnore(' .a , .b, ')).toHaveLength(2);
      expect(parseIgnore('')).toEqual([]);
    });

    it('rejects what the server cannot match: combinators and pseudo-classes', () => {
      expect(() => parseIgnore('article img')).toThrow(/unsupported selector.*"article img"/);
      expect(() => parseIgnore('.a > img')).toThrow(/unsupported selector/);
      expect(() => parseIgnore('img:first-child')).toThrow(/unsupported selector/);
      expect(() => parseIgnore('[alt^="x"]')).toThrow(/unsupported selector/);
    });
  });

  it('leaves a <picture> without an image alone', () => {
    const picture = '<picture><source srcset="/a.avif"></picture>';
    expect(wrapImages(picture)).toBe(picture);
  });

  it('leaves an image without a source alone', () => {
    expect(wrapImages('<img alt="Nothing">')).toBe('<img alt="Nothing">');
  });

  it('ignores images inside comments', () => {
    const html = '<!-- <img src="/hidden.jpg"> -->';
    expect(wrapImages(html)).toBe(html);
  });

  it('parses attribute values that contain ">"', () => {
    expect(wrapImages('<img alt="a > b" src="/a.jpg">')).toContain('aria-label="Enlarge image: a > b"');
  });

  it('reads uppercase tags, unquoted values and the first of duplicate attributes', () => {
    const html = wrapImages('<IMG SRC=/first.jpg src="/second.jpg" ALT=Bird>');
    expect(html).toContain('href="/first.jpg"');
    expect(html).toContain('aria-label="Enlarge image: Bird"');
  });

  describe('URLs', () => {
    it.each([
      '/relative.jpg',
      'photo.jpg',
      'https://example.com/a.jpg',
      'http://example.com/a.jpg',
      '//cdn.example.com/a.jpg',
      'blob:https://example.com/1234',
      'data:image/png;base64,iVBORw0KGgo=',
    ])('links to %s', (src) => {
      expect(wrapImages(`<img src="${src}" alt="">`)).toContain(`href="${src}"`);
    });

    it.each([
      'javascript:alert(1)',
      ' javascript:alert(1)',
      'JavaScript:alert(1)',
      'java\tscript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
    ])('does not link to %s', (src) => {
      const html = `<img src="${src}" alt="">`;
      expect(wrapImages(html)).toBe(html);
    });

    it('falls back to no link when data-zoom-src is unsafe', () => {
      const html = '<img src="/a.jpg" data-zoom-src="javascript:alert(1)" alt="">';
      expect(wrapImages(html)).toBe(html);
    });
  });
});
