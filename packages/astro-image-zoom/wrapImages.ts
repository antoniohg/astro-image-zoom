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

// Elements without a closing tag: a match on them never opens an ignored scope
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'
]);

/**
 * One compound selector: an optional tag name, then classes, ids and attributes, such as
 * `img.logo[alt=""]`. The server has no DOM, so combinators and pseudo-classes are not supported.
 */
export interface Selector {
  tag?: string;
  classes: string[];
  ids: string[];
  attributes: { name: string; value?: string }[];
}

const SIMPLE = /\.([\w-]+)|#([\w-]+)|\[\s*([\w:-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s"']+))\s*)?\]/y;

function parseSelector(source: string): Selector {
  const text = source.trim();
  const selector: Selector = { classes: [], ids: [], attributes: [] };
  const tag = /^(?:[a-zA-Z][\w-]*|\*)/.exec(text);
  let index = 0;
  if (tag) {
    if (tag[0] !== '*') selector.tag = tag[0].toLowerCase();
    index = tag[0].length;
  }
  while (index < text.length) {
    SIMPLE.lastIndex = index;
    const match = SIMPLE.exec(text);
    if (!match) {
      throw new Error(
        `astro-image-zoom: unsupported selector in "ignore": "${source.trim()}". Use tag names, ` +
          '.classes, #ids and [attributes] (with or without =value), without spaces or combinators.'
      );
    }
    const [, className, id, name, double, single, bare] = match;
    if (className) selector.classes.push(className);
    else if (id) selector.ids.push(id);
    else selector.attributes.push({ name: name.toLowerCase(), value: double ?? single ?? bare });
    index = SIMPLE.lastIndex;
  }
  return selector;
}

/** Parses the ignore prop, a list of simple selectors separated by commas */
export function parseIgnore(ignore = ''): Selector[] {
  // Commas inside a quoted value, as in [alt="Last, First"], do not split; a trailing comma is forgiven
  const parts = ignore.match(/(?:"[^"]*"|'[^']*'|[^,])+/g) ?? [];
  return parts.filter((part) => part.trim()).map(parseSelector);
}

// data-zoom-ignore always leaves an image out, with or without the ignore prop
const ALWAYS_IGNORED: Selector = { classes: [], ids: [], attributes: [{ name: 'data-zoom-ignore' }] };

// The character references Astro and hand-written HTML use in attribute values
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

// Attribute values as the DOM sees them, so selectors match like in CSS: alt="Salt &amp; pepper"
// is matched by [alt="Salt & pepper"]
const decode = (value: string): string =>
  value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) =>
    entity.startsWith('#')
      ? String.fromCodePoint(/^#x/i.test(entity) ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1)))
      : ENTITIES[entity.toLowerCase()]
  );

function matches(name: string, attributes: Attributes, selector: Selector): boolean {
  if (selector.tag && selector.tag !== name) return false;
  const value = (attribute: string): string | undefined => {
    const raw = attributes.get(attribute);
    return raw === undefined ? undefined : decode(raw);
  };
  const classes = (value('class') ?? '').split(/\s+/);
  return (
    selector.classes.every((className) => classes.includes(className)) &&
    selector.ids.every((id) => value('id') === id) &&
    selector.attributes.every(
      ({ name: attribute, value: expected }) =>
        attributes.has(attribute) && (expected === undefined || value(attribute) === expected)
    )
  );
}

export function wrapImages(html: string, ignore: Selector[] = []): string {
  const selectors = [ALWAYS_IGNORED, ...ignore];
  const isIgnored = (name: string, attributes: Attributes): boolean =>
    selectors.some((selector) => matches(name, attributes, selector));

  let output = '';
  let cursor = 0;
  let anchorDepth = 0;
  // Inside an ignored element: its name, and how deep elements of that name nest in it
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
      isIgnored(name, parseAttributes(rawAttributes))
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
      if (isIgnored('img', image)) {
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
