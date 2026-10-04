# astro-image-zoom

[![npm version](https://img.shields.io/npm/v/astro-image-zoom/beta)](https://www.npmjs.com/package/astro-image-zoom)

[![astro-image-zoom, Medium-style image zoom for Astro: an image grows from a page into an overlay](https://antoniohg.com/astro-image-zoom/og.png)](https://antoniohg.com/astro-image-zoom/)

Medium-style image zoom for Astro: a click grows each image from its place on the page to fill the
screen, and the images of a gallery become a carousel you can swipe.

**[Live demo and docs](https://antoniohg.com/astro-image-zoom/)**

> **Beta.** The API may still change before 1.0. Feedback and bug reports are welcome in the
> [issues](https://github.com/antoniohg/astro-image-zoom/issues).

## Features

- **Zoom from the page**: FLIP animations with CSS transforms and `clip-path`, from the thumbnail to
  the full image and back, crops included: the `object-fit` and `object-position` of the thumbnail,
  and thumbnail files cropped to another shape, such as Astro's `<Image width height>`. A file
  stretched to another shape with `object-fit: fill` animates as with `cover`.
- **Accessible**: a native modal `<dialog>` that traps and restores focus, keyboard navigation,
  labelled controls, reduced motion and forced colors.
- **Galleries**: a native scroll-snap carousel with touch and touchpad swipes, arrow keys, buttons and
  a counter.
- **Isolated**: the overlay lives in a shadow root, so the CSS of your site can't break it.
- **Customizable**: `--zoom-*` CSS variables, per gallery if you want, `::part()` and props.
- **Light and dark**: follows the light or dark preference of the system, or the scheme you set.
- **No dependencies**: TypeScript and CSS only; without JavaScript, each image links to the file the zoom opens.
- **Starlight**: one line in the config zooms every image of the docs, in Starlight's colors and
  languages ([Starlight](#starlight)).

## Installation

```bash
pnpm add astro-image-zoom@beta
# or: npm install astro-image-zoom@beta
```

## Browser Support

Current browsers: the overlay uses `<dialog>`, shadow DOM and `light-dark()` (Chrome and
Edge 123, Firefox 120, Safari 17.5 and later). The end-to-end tests run in Chromium, Firefox and
WebKit on every change; reports from real devices, especially phones and tablets, are welcome.

## Usage

Wrap your images in `<ImageZoom>`. You can mix Astro's `<Image>` and `<Picture>` with plain `<img>`
tags, local or remote.

`<Image>` and `<Picture>` are recommended for performance: Astro resizes and compresses them, so the
page loads light images; with `data-image-zoom-src`, the zoom fetches the full size only when it opens (see
[Which image the zoom shows](#which-image-the-zoom-shows)). Plain `<img>` tags work too, but they ship
whatever file you give them.

```astro
---
import ImageZoom from 'astro-image-zoom/ImageZoom.astro';
import { Image, getImage } from 'astro:assets';
import photo from '../assets/photo.jpg';

// Full-size version for the zoom (see "Which image the zoom shows")
const fullSize = await getImage({ src: photo, width: 1920 });
---

<ImageZoom>
  <!-- Optimized Astro image -->
  <Image src={photo} alt="Mountain landscape at sunset" width={400} data-image-zoom-src={fullSize.src} />

  <!-- Plain image from public/ -->
  <img src="/photos/city.jpg" alt="City skyline at night" />

  <!-- Remote image -->
  <img src="https://example.com/photos/forest.jpg" alt="Misty forest at dawn" />
</ImageZoom>
```

### Which image the zoom shows

- **An image on its own** opens the URL in its `data-image-zoom-src`, or its own `src` without it. Plain
  images work out of the box: `<img src="/photo.jpg">` opens that same file.
- **An image inside a link with `data-image-zoom`** (`<a href="…" data-image-zoom>`) opens the `href` of the
  link. Put `data-image-zoom-caption` (or `title`) on the link: the image inside gives only its `alt`
  and its `title`, and its own `data-image-zoom-src` and `data-image-zoom-caption` are ignored. See
  [Gallery with Links](#gallery-with-links).
- **An image inside any other link** is left alone: the link keeps working as a link (a card, a
  logo) and the image is not part of the gallery. So are the images of other elements whose clicks
  already do something (a `<button>`, the `<label>` of a form control, the `<summary>` of a
  `<details>`) and image maps (`<img usemap>`).

> **Resized images barely grow when zoomed.** The zoom shows each image at most at its real size,
> never enlarged. If the image on the page is a smaller version (a thumbnail, or Astro's
> `<Image width={400}>`, which generates a 400 px file), the zoom opens that small file and it
> stays small. Add `data-image-zoom-src` with the full-size version, as shown in
> [Full-Size Images](#full-size-images).

### Full-Size Images

`data-image-zoom-src` gives the zoom a bigger file than the one on the page:

```astro
<ImageZoom>
  <img
    src="/thumbnail.jpg"
    data-image-zoom-src="/full-resolution.jpg"
    alt="High quality image"
  />
</ImageZoom>
```

With Astro's `<Image>` or `<Picture>`, build the full-size version with `getImage()`:

```astro
---
import { Image, getImage } from 'astro:assets';
import ImageZoom from 'astro-image-zoom/ImageZoom.astro';

import myImage from '../assets/my-image.jpg';

// Optimize the full-resolution image for the zoom overlay
const optimizedImage = await getImage({
  src: myImage,
  format: 'webp',
  width: 1920 // Optional: limit width for better performance
});
---

<ImageZoom>
  <Image
    src={myImage}
    alt="A beautiful optimized image"
    width={600}
    data-image-zoom-src={optimizedImage.src}
  />
</ImageZoom>
```

> **Note:** Do not pass the `Image` component directly to `data-image-zoom-src` or call it as a function. The zoom script expects a string URL for the `data-image-zoom-src` attribute.

### Captions

```astro
<ImageZoom>
  <img
    src="/image1.jpg"
    alt="Beautiful landscape"
    data-image-zoom-caption="Sunset over the mountains"
  />
  <img
    src="/image2.jpg"
    alt="City skyline"
    data-image-zoom-caption="Downtown at night"
  />
</ImageZoom>
```

Without `data-image-zoom-caption`, the caption comes from the page:

1. The `<figcaption>` of the `<figure>` around the image, as plain text. Only when the figure holds
   that one image: a figcaption shared by several images describes the group, not each of them.
2. The `title` of the link, or of the image. Markdown's `![alt](src "title")` renders it, so
   Markdown images get a caption with no extra markup.

An empty `data-image-zoom-caption=""` leaves an image without a caption, whatever its figure or
title say.

```astro
<ImageZoom>
  <figure>
    <img src="/image1.jpg" alt="Beautiful landscape" />
    <figcaption>Sunset over the <em>mountains</em></figcaption>
  </figure>
</ImageZoom>
```

### Gallery with Links

```astro
<ImageZoom>
  <a href="/full-res-image1.jpg" data-image-zoom>
    <img src="/thumbnail1.jpg" alt="Thumbnail 1" />
  </a>
  <a href="/full-res-image2.jpg" data-image-zoom>
    <img src="/thumbnail2.jpg" alt="Thumbnail 2" />
  </a>
</ImageZoom>
```

The zoom grows from the image inside the link, so a `data-image-zoom` link without one stays a plain link.

### Several Galleries

Each `<ImageZoom>` is its own gallery: the arrows and swipes move through its images only. Use as
many as you need on a page; they share one overlay.

### Leaving Images Out

Logos, icons, avatars and decorative images inside a wrapped article should not zoom. List them in
the `ignore` prop: an ignored image is not wrapped in a link, does not open, and does not count in
the gallery.

```astro
<ImageZoom ignore=".logo, .author, [alt='']">
  <img src="/photo.jpg" alt="Harbor at dawn" />
  <img class="logo" src="/logo.svg" alt="Harbor Co." />
  <img src="/divider.svg" alt="" />
  <aside class="author">
    <img src="/avatar.jpg" alt="The author" />
  </aside>
</ImageZoom>
```

Each selector is checked against the image and every element around it inside `<ImageZoom>`, so
`.author` leaves out every image in the aside. `[alt='']` leaves out the images marked as
decorative, which screen readers skip too.

The images are wrapped on the server, without a DOM, so `ignore` takes simple selectors only: a tag
name, `.classes`, `#ids` and `[attributes]`, with or without `=value`, combined as in
`img.logo[alt='']`. Spaces inside a selector, combinators (`article img`, `>`) and pseudo-classes fail the build with
an error that names the selector.

For a single image, `data-image-zoom-ignore` on the image or on an element around it does the same without
the prop:

```astro
<ImageZoom>
  <img src="/signature.svg" alt="Signature" data-image-zoom-ignore />
</ImageZoom>
```

A link with `data-image-zoom` inside an ignored element stays a plain link.

### Your page

How your images look on the page is up to your site: the component doesn't style them, not even
their focus ring. It only wraps each image in a link, so it opens with the keyboard and, without
JavaScript, links to the file the zoom opens:

```html
<a href="/full-size.jpg" data-image-zoom-generated aria-label="Enlarge image: A red car">
  <img src="/photo.jpg" alt="A red car" />
</a>
```

The link is inline and unstyled, so it never changes your layout, and it gets your site's link
styles, focus ring included. If your images are `display: block`, the outline of an inline link
doesn't wrap them: depending on the browser it is invisible or spans the whole line. Draw your
focus ring on the image instead, in your own style:

```css
a[data-image-zoom-generated]:focus-visible {
  outline: none;
}

a[data-image-zoom-generated]:focus-visible img {
  outline: 2px solid green; /* your focus ring */
  outline-offset: 3px; /* negative if a parent with overflow: hidden clips it */
}
```

A zoom cursor, if you want one, is also yours to add:

```css
a[data-image-zoom-generated] img {
  cursor: zoom-in;
}
```

The component adds no stylesheet to your page. `<astro-image-zoom>` groups the images without
adding a box of its own (`display: contents`), from its own
[declarative shadow root](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM#declaratively_with_html),
so it works without JavaScript and any rule of your site wins over it, cascade layers included.

To style one gallery, pass a class. It can style the images, or lay out the gallery on the element
itself:

```astro
<ImageZoom class="custom-zoom">
  <!-- Your images -->
</ImageZoom>

<style>
  /* Global: the wrapper is rendered by the component, outside the scope of your page */
  :global(.custom-zoom) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  :global(.custom-zoom img) {
    border-radius: 8px;
  }
</style>
```

## Starlight

In a [Starlight](https://starlight.astro.build/) site, one line in the config makes every image of
the docs zoomable, with no component in the pages:

```js
// astro.config.mjs
import starlight from "@astrojs/starlight";
import imageZoom from "astro-image-zoom/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [starlight({ title: "My docs", plugins: [imageZoom()] })],
});
```

Everything the component does works in the docs. Each page is one gallery, with arrow keys, swipes
and a counter, and the zoom can open a full-size file. A Markdown image's title becomes its caption:
`![A red car](./car.jpg "Our first car")`. On phones, a swipe closes the zoom, and a wheel or
touchpad scroll closes it without stopping the page. Without JavaScript, each image still links to
its file.

An image in a link stays a link. To leave one out, write it in HTML with `data-image-zoom-ignore`,
or pass the `ignore` option. The overlay takes Starlight's colors, follows its theme toggle and reads
its labels in the language of each page.

The options are the [props](#props) of `<ImageZoom>`, except `labels` and `class`:

```js
imageZoom({ showCounter: false, theme: { backgroundColor: "black" } });
```

Starlight's colors are only defaults: the [CSS variables](#css-variables) of your site replace
them, and `theme` replaces both, color by color.

### Translations

The labels come from Starlight's [UI translations](https://starlight.astro.build/guides/i18n/#translate-starlights-ui),
in English and Spanish. For another language, or other words, add the keys to
`src/content/i18n/<lang>.json`: `astroImageZoom.overlay`, `astroImageZoom.close`,
`astroImageZoom.images`, `astroImageZoom.previous`, `astroImageZoom.next`,
`astroImageZoom.enlarge` and `astroImageZoom.enlargeNamed` (see the [keys](#translating-the-labels)).

### With your own MarkdownContent

The plugin overrides Starlight's `MarkdownContent` component. If your site already overrides it, the
plugin leaves yours and logs a warning. Keep the plugin in the config, and wrap Starlight's
component in `astro-image-zoom/starlight/ImageZoom.astro` inside your override: it brings the
options, the translations and the colors.

```astro
---
// src/components/MarkdownContent.astro
import Default from "@astrojs/starlight/components/MarkdownContent.astro";
import ImageZoom from "astro-image-zoom/starlight/ImageZoom.astro";
---

<ImageZoom>
  <Default><slot /></Default>
</ImageZoom>
```

A plugin listed after this one that overrides `MarkdownContent` too replaces it without a warning:
keep only one of them.

## Configuration

### Props

| Prop                          | Type                       | Default                             | Description                                                                                                                                |
| ----------------------------- | -------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `theme`                       | `object`                   | `{}`                                | Theme configuration object                                                                                                                 |
| `theme.backgroundColor`       | `string`                   | light or dark, following the system | Overlay background color (`--zoom-bg`)                                                                                                     |
| `theme.closeButtonColor`      | `string`                   | light or dark, following the system | Close icon color (`--zoom-close-color`)                                                                                                    |
| `theme.closeButtonBackground` | `string`                   | translucent, following the system   | Close button background (`--zoom-close-bg`)                                                                                                |
| `theme.navigationColor`       | `string`                   | light or dark, following the system | Arrows and counter color (`--zoom-nav-color`)                                                                                              |
| `theme.navigationBackground`  | `string`                   | translucent, following the system   | Navigation bar background, or each arrow in the sides layout (`--zoom-nav-bg`)                                                             |
| `theme.captionColor`          | `string`                   | light or dark, following the system | Caption text color (`--zoom-caption-color`)                                                                                                |
| `theme.captionBackground`     | `string`                   | translucent, following the system   | Caption box background (`--zoom-caption-bg`)                                                                                               |
| `animationDuration`           | `number`                   | —                                   | Animation duration in milliseconds; overrides `--zoom-animation-duration` (300ms by default)                                               |
| `closeOnBackdrop`             | `boolean`                  | `true`                              | Close when clicking backdrop                                                                                                               |
| `closeOnImage`                | `boolean`                  | `true`                              | Close when clicking the zoomed image                                                                                                       |
| `closeOnScroll`               | `boolean`                  | `true`                              | Close on a wheel or touchpad scroll, or a vertical swipe                                                                                   |
| `showNavigation`              | `boolean`                  | `true`                              | Show the arrows and the counter in galleries; keys and swipes work without them                                                            |
| `navigationLayout`            | `'bar' \| 'sides'`         | `'bar'`                             | Arrows and counter in a bar at the bottom, or arrows at the sides                                                                          |
| `showCounter`                 | `boolean`                  | `true`                              | Show the position in the gallery, such as "3 / 8"                                                                                          |
| `showCaption`                 | `boolean`                  | `true`                              | Show the caption of the zoomed image                                                                                                       |
| `captionPosition`             | `'bottom' \| 'top'`        | `'bottom'`                          | Where the caption sits on the screen                                                                                                       |
| `labels`                      | `Partial<ImageZoomLabels>` | English                             | Texts read by screen readers ([Translating the Labels](#translating-the-labels))                                                           |
| `ignore`                      | `string`                   | `''`                                | Images left out of the zoom: simple selectors separated by commas, such as `".logo, [alt='']"` ([Leaving Images Out](#leaving-images-out)) |
| `class`                       | `string`                   | `''`                                | Custom CSS class                                                                                                                           |

### Translating the Labels

Apart from the counter, which is only numbers, the texts the component adds are `aria-label`s, read by
screen readers. They are in English;
the `labels` prop translates the ones you set, and the rest stay in English:

```astro
<ImageZoom labels={{ close: "Cerrar zoom", enlargeNamed: "Ampliar imagen: {alt}" }}>
  <img src="/photo.jpg" alt="Un coche rojo" />
</ImageZoom>
```

| Key            | Default                | Names                                                                              |
| -------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `overlay`      | `Image zoom overlay`   | The dialog                                                                         |
| `close`        | `Close zoom overlay`   | The close button                                                                   |
| `images`       | `Images`               | The group of images                                                                |
| `previous`     | `Previous image`       | The previous image button                                                          |
| `next`         | `Next image`           | The next image button                                                              |
| `enlarge`      | `Enlarge image`        | The link the component adds around an image with no alt text                       |
| `enlargeNamed` | `Enlarge image: {alt}` | The link the component adds around an image; `{alt}` is replaced with its alt text |

To translate every gallery of a multilingual site, wrap the component in one of your own that
picks the labels of the page's locale:

```astro
---
// src/components/Zoom.astro
import ImageZoom from "astro-image-zoom/ImageZoom.astro";
import type { ImageZoomLabels } from "astro-image-zoom";

const translations: Record<string, Partial<ImageZoomLabels>> = {
  es: { close: "Cerrar zoom", enlargeNamed: "Ampliar imagen: {alt}" },
};
---

<ImageZoom {...Astro.props} labels={translations[Astro.currentLocale ?? ""]}>
  <slot />
</ImageZoom>
```

The caption is your own text, so it is not translated by the component.

## Styling

### CSS Variables

Override the default styles with CSS variables:

```css
:root {
  --zoom-bg: rgba(20, 20, 30, 0.98);
  --zoom-close-color: #ff6b6b;
  --zoom-nav-color: #4ecdc4; /* arrows and counter */
  --zoom-close-bg: rgba(255, 255, 255, 0.1);
  --zoom-nav-bg: rgba(255, 255, 255, 0.1);
  --zoom-caption-color: #fff;
  --zoom-caption-bg: rgba(0, 0, 0, 0.9);
  --zoom-animation-duration: 400ms; /* ms or s; the animationDuration prop wins over it */
  --zoom-slide-duration: 400ms; /* arrows and keys: the glide to the next image */
  --zoom-slide-easing: cubic-bezier(0.2, 0, 0, 1);

  /* Layout */
  --zoom-padding: 0; /* space between the zoomed image and the screen edges */
  --zoom-image-radius: 0; /* corners of the zoomed image */
  --zoom-button-size: 40px; /* arrows and close button; 36px on phones */
  --zoom-button-radius: 999px; /* shape of the buttons and the navigation bar */
  --zoom-controls-offset: 16px; /* distance from the controls and the caption to the edges; 12px on phones */
  --zoom-caption-max-width: 70%; /* 100% on phones */
  --zoom-caption-font: inherit; /* the font of your site */
  --zoom-caption-font-size: 13px; /* 12px on phones */
  --zoom-color-scheme: light dark; /* set "dark" or "light" to follow your own theme toggle */
  --zoom-caption-radius: 10px;
}
```

Set them on `:root` for the whole site, or on any element around an `<ImageZoom>` for that gallery
only: when a gallery opens, the overlay takes the values found around it. The `theme` prop wins over
the variables.

```css
.portfolio {
  --zoom-padding: 5vmin;
  --zoom-image-radius: 12px;
}
```

On screens up to 640px wide the overlay makes its buttons, its distance to the edges and the caption
text smaller, and lets the caption take the whole width. A variable you set wins on every screen:
`--zoom-button-size: 56px` keeps 56px buttons on a phone too. Keep the large values for wide screens
with a media query, or let them grow with the screen with `clamp()`. The overlay reads the values
each time a gallery opens.

```css
.portfolio {
  --zoom-padding: clamp(12px, 5vw, 64px);
}

@media (width > 640px) {
  .portfolio {
    --zoom-button-size: 56px;
    --zoom-controls-offset: 32px;
  }
}
```

### Parts

The zoom overlay lives in a [shadow root](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM),
so the CSS of your site can't break it: rules such as `button { all: unset }` or `svg { width: 1em }`
never reach it. The variables above cross into it. For anything they don't cover, style the exposed
parts with `::part()`:

```css
astro-image-zoom-overlay::part(caption) {
  text-transform: uppercase;
}
```

| Part                  | Element                                  |
| --------------------- | ---------------------------------------- |
| `overlay`             | The `<dialog>`                           |
| `backdrop`            | The background behind the image          |
| `track`               | The carousel that holds the slides       |
| `slide`, `image`      | Each slide of the carousel and its image |
| `caption`             | The caption                              |
| `close`               | The close button                         |
| `toolbar`             | The navigation bar                       |
| `nav`, `prev`, `next` | The arrows (`nav` matches both)          |
| `counter`             | The position in the gallery              |

## Accessibility

- A native modal `<dialog>`: focus moves to the close button, stays inside while it is open and,
  when it closes, goes to the link of the image on screen, the one the zoom closes onto.
- Each image becomes a link, reachable with the keyboard. Its focus ring is the one of your site;
  see [Your page](#your-page) to draw it on the image.
- Labelled buttons; the caption is announced when the image changes.
- Reduced motion turns the animations off, and the loading spinner fades in and out instead of
  spinning; forced colors (Windows high contrast) keep the controls visible.

### Keyboard

- **Enter** - Open the focused image
- **Escape** - Close zoom
- **Arrow Left** - Previous image
- **Arrow Right** - Next image
- **Tab / Shift+Tab** - Navigate between controls

### Touch Gestures

- **Swipe left** - Next image (also a two-finger swipe on a touchpad)
- **Swipe right** - Previous image
- **Swipe up or down** - Close the zoom
- **Tap the image or the backdrop** - Close the zoom

## Performance

- The page loads the images you give it; the full-size version loads only when the zoom opens, and
  the neighbors of a gallery are preloaded.
- The zoom does not wait for the full-size file: it opens as soon as the browser knows its size,
  with the thumbnail stretched behind it, and sharpens when the file has loaded. A thumbnail file
  with other proportions (cropped when the site was built, or a different picture) would look
  distorted, so then the zoom waits for the file, with a spinner if it takes a while. Thumbnails
  cropped with CSS (`object-fit: cover`) are the whole picture, so they work.
- Animations are CSS only (transforms, `clip-path` and opacity); the script measures positions and
  waits for them to end.
- One overlay shared by every gallery on the page, and one delegated click listener per gallery.

## JavaScript API

### Events

Each `<astro-image-zoom>` dispatches three events, which bubble, so one listener on the document
hears every gallery on the page:

| Event                     | When                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `astro-image-zoom:open`   | A zoom opens (a click, Enter on a link)                    |
| `astro-image-zoom:change` | The gallery moves to another image (arrows, keys, a swipe) |
| `astro-image-zoom:close`  | The zoom closes, however it closes                         |

Their `detail` describes the image on screen:

| Field     | Type          | Description                                  |
| --------- | ------------- | -------------------------------------------- |
| `index`   | `number`      | Position of the image in its gallery, from 0 |
| `total`   | `number`      | Number of images in the gallery              |
| `src`     | `string`      | URL of the image the zoom shows              |
| `alt`     | `string`      | Alt text of the image                        |
| `caption` | `string`      | Caption, or an empty string                  |
| `link`    | `HTMLElement` | The link on the page that opens this image   |

```astro
<script>
  document.addEventListener('astro-image-zoom:open', (event) => {
    const { index, total, src } = event.detail;
    console.log(`Opened ${index + 1} of ${total}: ${src}`);
  });

  // Only one gallery: listen on its element instead
  document.querySelector('.portfolio')?.addEventListener('astro-image-zoom:change', (event) => {
    console.log('Now showing', event.detail.caption);
  });
</script>
```

`open` does not also dispatch `change`: each event means one thing, so counting `change` counts the
moves between images. To follow whatever image is on screen, listen to both with one handler:

```js
const sync = (event) => {
  history.replaceState(null, '', `#photo-${event.detail.index + 1}`);
};
document.addEventListener('astro-image-zoom:open', sync);
document.addEventListener('astro-image-zoom:change', sync);
```

The events report, they do not decide: `preventDefault()` does not stop an opening or a close.
`open` comes when the zoom starts to open, before the image has loaded, and every `open` gets its
`close`, also when the zoom closes while the image is still loading.

In TypeScript, the events are typed on elements, the document and the window once the package's
types are in the project. Using `<ImageZoom>` is not enough: add one line to a declaration file,
such as `src/env.d.ts`, and every script gets them:

```ts
import type {} from 'astro-image-zoom';
```

The detail has its own type too: `import type { ZoomEventDetail } from 'astro-image-zoom'`.

### Programmatic Control

`<ImageZoom>` sets up its own zoom, and picks up `data-image-zoom` links added inside it later, when
they are clicked. For images outside any `<ImageZoom>`, such as markup your scripts add after the page
loads, create a zoom with `ZoomClass` on the element around the links:

```astro
<div class="my-gallery">
  <a href="/large-1.jpg" data-image-zoom><img src="/small-1.jpg" alt="Harbor at dawn" /></a>
  <a href="/large-2.jpg" data-image-zoom><img src="/small-2.jpg" alt="Harbor at noon" /></a>
</div>

<script>
  import { ZoomClass } from 'astro-image-zoom';

  const gallery = document.querySelector<HTMLElement>('.my-gallery');
  if (gallery) {
    const zoom = new ZoomClass(gallery);
    // Later, if needed: zoom.destroy();
  }
</script>
```

`ZoomClass` reads the options from the same `data-*` attributes that `<ImageZoom>` renders on its
element (`data-image-zoom-show-counter="false"`, `data-image-zoom-close-scroll="false"`…); the theme and the duration come
from the `--zoom-*` variables. Images are not wrapped then, so only links with `data-image-zoom` count, and
`data-image-zoom-ignore-selector` on the wrapper takes any CSS selector, since the browser matches it.

## License

[MIT](https://github.com/antoniohg/astro-image-zoom/blob/main/LICENSE)

## Contributing

Found a bug or have an idea? Open an [issue](https://github.com/antoniohg/astro-image-zoom/issues) or
a pull request.

Inspired by Medium's image viewer.
