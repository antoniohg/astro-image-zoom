/**
 * Wraps the images of a rendered HTML string in accessible zoom links.
 * Runs on the server, so without JavaScript the links still open the full-size image.
 */

// Comments (skipped) or tags; quoted attribute values may contain ">"
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

type Attributes = Map<string, string>;

function parseAttributes(source: string): Attributes {
  const attributes: Attributes = new Map();
  for (const [, name, double, single, bare] of source.matchAll(ATTRIBUTE)) {
    // First occurrence wins, like in a browser
    const key = name.toLowerCase();
    if (!attributes.has(key)) attributes.set(key, double ?? single ?? bare ?? '');
  }
  return attributes;
}

// Values keep their original entities; only the quote that delimits the new attribute needs escaping
const escapeQuotes = (value: string): string => value.replaceAll('"', '&quot;');

// The image URL becomes a link href, so only schemes that cannot run code are allowed:
// relative URLs, http(s), blob: and data:image/. javascript:, vbscript: and the like are dropped.
function isSafeUrl(url: string): boolean {
  try {
    // The URL parser strips the whitespace and control characters browsers ignore in schemes
    const { protocol } = new URL(url, 'https://astro-image-zoom.invalid/');
    if (protocol === 'data:') return /^[\s\0-\x1f]*data:image\//i.test(url);
    return protocol === 'http:' || protocol === 'https:' || protocol === 'blob:';
  } catch {
    return false;
  }
}

// The zoom URL of an image: data-zoom-src wins over src, and unsafe URLs are ignored
const getSource = (image: Attributes): string | undefined => {
  const src = image.get('data-zoom-src') || image.get('src');
  return src && isSafeUrl(src) ? src : undefined;
};

// The link is named after the image so screen readers announce what opens
function wrap(html: string, image: Attributes): string {
  const src = getSource(image);
  if (!src) return html;

  const caption = image.get('data-zoom-caption');
  const alt = image.get('alt');

  const captionAttribute = caption ? ` data-zoom-caption="${escapeQuotes(caption)}"` : '';
  const label = alt ? `Enlarge image: ${alt}` : 'Enlarge image';

  return `<a href="${escapeQuotes(src)}" data-zoom-generated${captionAttribute} aria-label="${escapeQuotes(label)}">${html}</a>`;
}

// Elements without a closing tag: data-zoom-ignore on them never opens a scope
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'
]);

export function wrapImages(html: string): string {
  let output = '';
  let cursor = 0;
  let anchorDepth = 0;
  // Inside an element with data-zoom-ignore: its name, and how deep elements of that name nest in it
  let ignored: { name: string; depth: number } | null = null;
  // A <picture> is wrapped as a whole: <a> is not valid inside it
  let picture: { start: number; image?: Attributes } | null = null;

  for (const match of html.matchAll(TOKEN)) {
    const [tag, closing, rawName, rawAttributes] = match;
    if (!rawName) continue; // comment

    const name = rawName.toLowerCase();
    const start = match.index;
    const end = start + tag.length;

    // Nothing inside an ignored element is wrapped, whatever it holds
    if (ignored) {
      if (name === ignored.name) ignored.depth += closing ? -1 : 1;
      if (ignored.depth === 0) ignored = null;
      continue;
    }
    if (
      !closing &&
      !VOID_ELEMENTS.has(name) &&
      !/\/\s*$/.test(rawAttributes) &&
      parseAttributes(rawAttributes).has('data-zoom-ignore')
    ) {
      ignored = { name, depth: 1 };
      continue;
    }

    if (name === 'a') {
      anchorDepth = Math.max(0, anchorDepth + (closing ? -1 : 1));
      continue;
    }

    // Images that already live inside a link are left alone
    if (anchorDepth > 0) continue;

    if (name === 'picture') {
      if (!closing) {
        picture = { start };
      } else if (picture) {
        const { start: pictureStart, image } = picture;
        picture = null;
        if (image && getSource(image)) {
          output += html.slice(cursor, pictureStart) + wrap(html.slice(pictureStart, end), image);
          cursor = end;
        }
      }
    } else if (name === 'img' && !closing) {
      const image = parseAttributes(rawAttributes);
      if (image.has('data-zoom-ignore')) {
        // An ignored image leaves its <picture> unwrapped too
        if (picture) picture = null;
      } else if (picture) {
        picture.image ??= image;
      } else if (getSource(image)) {
        output += html.slice(cursor, start) + wrap(tag, image);
        cursor = end;
      }
    }
  }

  return output + html.slice(cursor);
}
