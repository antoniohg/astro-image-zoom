# astro-image-zoom

Medium-style image zoom for Astro: a click grows each image from its place on the page to fill the
screen, and the images of a gallery become a carousel you can swipe.

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
- **Light and dark**: follows the color scheme of the page, or the one you set.
- **No dependencies**: TypeScript and CSS only; without JavaScript, each image links to its full size.

## Installation

```bash
pnpm add astro-image-zoom@beta
# or: npm install astro-image-zoom@beta
```

## Quick Start

### Basic Usage

Wrap your images in `<ImageZoom>`. You can mix Astro's `<Image>` and `<Picture>` with plain `<img>`
tags, local or remote.

`<Image>` and `<Picture>` are recommended for performance: Astro resizes and compresses them, so the
page loads light images and the zoom fetches the full size only when it opens (see
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
  <Image src={photo} alt="Mountain landscape at sunset" width={400} data-zoom-src={fullSize.src} />

  <!-- Plain image from public/ -->
  <img src="/photos/city.jpg" alt="City skyline at night" />

  <!-- Remote image -->
  <img src="https://example.com/photos/forest.jpg" alt="Misty forest at dawn" />
</ImageZoom>
```

### Which image the zoom shows

The zoom opens, in this order:

1. The URL in `data-zoom-src`, if the image has it.
2. The `href` of a link around the image (`<a href="…" data-zoom>`).
3. The image's own `src`.

Plain images work out of the box: `<img src="/photo.jpg">` opens that same file, at full size.

> **Warning: resized images look blurry when zoomed.** If the image on the page is a smaller
> version (a thumbnail, or Astro's `<Image width={400}>`, which generates a 400 px file), the zoom
> enlarges that small file. Add `data-zoom-src` with the full-size version, as shown in
> [High-Resolution Images](#high-resolution-images) and
> [Using with Astro Assets](#using-with-astro-assets-optimized-images).

### With Custom Captions

```astro
<ImageZoom>
  <img
    src="/image1.jpg"
    alt="Beautiful landscape"
    data-zoom-caption="Sunset over the mountains"
  />
  <img
    src="/image2.jpg"
    alt="City skyline"
    data-zoom-caption="Downtown at night"
  />
</ImageZoom>
```

### Gallery with Links

```astro
<ImageZoom>
  <a href="/full-res-image1.jpg" data-zoom>
    <img src="/thumbnail1.jpg" alt="Thumbnail 1" />
  </a>
  <a href="/full-res-image2.jpg" data-zoom>
    <img src="/thumbnail2.jpg" alt="Thumbnail 2" />
  </a>
</ImageZoom>
```

### High-Resolution Images

Use `data-zoom-src` to load higher resolution images in the zoom:

```astro
<ImageZoom>
  <img
    src="/thumbnail.jpg"
    data-zoom-src="/full-resolution.jpg"
    alt="High quality image"
  />
</ImageZoom>
```

### Using with Astro Assets (Optimized Images)

To use optimized Astro images, you can use the `<Image />` component. For the zoom overlay image (which requires a URL string), use the `getImage()` helper.

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
    data-zoom-src={optimizedImage.src}
  />
</ImageZoom>
```

> **Note:** Do not pass the `Image` component directly to `data-zoom-src` or call it as a function. The zoom script expects a string URL for the `data-zoom-src` attribute.


## Configuration

### Component Props

```astro
<ImageZoom
  theme={{
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    closeButtonColor: '#ffffff',
    navigationColor: '#ffffff'
  }}
  animationDuration={300}
  keyboardNavigation={true}
  closeOnBackdrop={true}
  showNavigation={true}
  class="my-custom-class"
/>
```

#### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `theme` | `object` | `{}` | Theme configuration object |
| `theme.backgroundColor` | `string` | light or dark, following the page | Overlay background color (`--zoom-bg`) |
| `theme.closeButtonColor` | `string` | light or dark, following the page | Close button color (`--zoom-close-color`) |
| `theme.navigationColor` | `string` | light or dark, following the page | Arrows and counter color (`--zoom-nav-color`) |
| `animationDuration` | `number` | — | Animation duration in milliseconds; overrides `--zoom-animation-duration` (300ms by default) |
| `keyboardNavigation` | `boolean` | `true` | Enable keyboard shortcuts |
| `closeOnBackdrop` | `boolean` | `true` | Close when clicking backdrop |
| `closeOnImage` | `boolean` | `true` | Close when clicking the zoomed image |
| `closeOnScroll` | `boolean` | `true` | Close when scrolling/wheeling |
| `showNavigation` | `boolean` | `true` | Show navigation arrows |
| `navigationLayout` | `'bar' \| 'sides'` | `'bar'` | Arrows and counter in a bar at the bottom, or arrows at the sides |
| `showCounter` | `boolean` | `true` | Show the position in the gallery, such as "3 / 8" |
| `showCaption` | `boolean` | `true` | Show the caption of the zoomed image |
| `captionPosition` | `'bottom' \| 'top'` | `'bottom'` | Where the caption sits on the screen |
| `class` | `string` | `''` | Custom CSS class |

### Custom Styling

You can override the default styles using CSS variables:

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
  --zoom-button-size: 44px; /* arrows and close button */
  --zoom-button-radius: 999px; /* shape of the buttons and the navigation bar */
  --zoom-controls-offset: 20px; /* distance from the controls and the caption to the edges */
  --zoom-caption-max-width: 70%; /* 90% on phones */
  --zoom-caption-font: inherit; /* the font of your site */
  --zoom-caption-font-size: 13px;
  --zoom-color-scheme: light dark; /* set "dark" or "light" to follow your own theme toggle */
  --zoom-caption-radius: 6px;
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

#### Parts

The zoom overlay lives in a [shadow root](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM),
so the CSS of your site can't break it: rules such as `button { all: unset }` or `svg { width: 1em }`
never reach it. The variables above cross into it. For anything they don't cover, style the exposed
parts with `::part()`:

```css
astro-image-zoom-overlay::part(caption) {
  text-transform: uppercase;
}
```

| Part | Element |
|------|---------|
| `overlay` | The `<dialog>` |
| `backdrop` | The background behind the image |
| `track` | The carousel that holds the slides |
| `slide`, `image` | Each slide of the carousel and its image |
| `caption` | The caption |
| `close` | The close button |
| `toolbar` | The navigation bar |
| `nav`, `prev`, `next` | The arrows (`nav` matches both) |
| `counter` | The position in the gallery |

#### Your page

How your images look on the page is up to your site: the component doesn't style them, not even
their focus ring. It only wraps each image in a link, so it opens with the keyboard and, without
JavaScript, links to the full-size image:

```html
<a href="/full-size.jpg" data-zoom-generated aria-label="Enlarge image: A red car">
  <img src="/photo.jpg" alt="A red car" />
</a>
```

The link is inline and unstyled, so it never changes your layout, and it gets your site's link
styles, focus ring included. If your images are `display: block`, the outline of an inline link
doesn't wrap them: depending on the browser it is invisible or spans the whole line. Draw your
focus ring on the image instead, in your own style:

```css
a[data-zoom-generated]:focus-visible {
  outline: none;
}

a[data-zoom-generated]:focus-visible img {
  outline: 2px solid green; /* your focus ring */
  outline-offset: 3px; /* negative if a parent with overflow: hidden clips it */
}
```

A zoom cursor, if you want one, is also yours to add:

```css
a[data-zoom-generated] img {
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

## Keyboard Shortcuts

- **Escape** - Close zoom
- **Arrow Left** - Previous image
- **Arrow Right** - Next image
- **Tab / Shift+Tab** - Navigate between controls

## Touch Gestures

- **Swipe left** - Next image (also a two-finger swipe on a touchpad)
- **Swipe right** - Previous image
- **Swipe up or down** - Close the zoom and keep scrolling the page
- **Tap the backdrop** - Close the zoom

## Accessibility

- A native modal `<dialog>`: focus moves to the close button, stays inside while it is open and
  returns to the image when it closes.
- Each image becomes a link, reachable with the keyboard. Its focus ring is the one of your site;
  see [Your page](#your-page) to draw it on the image.
- Labelled buttons; the caption is announced when the image changes.
- Reduced motion turns the animations off; forced colors (Windows high contrast) keep the controls
  visible.

## Performance

- The page loads the images you give it; the full-size version loads only when the zoom opens, and
  the neighbors of a gallery are preloaded.
- Animations are CSS only (transforms, `clip-path` and opacity); the script measures positions and
  waits for them to end.
- One overlay shared by every gallery on the page, and one delegated click listener per gallery.

## Advanced Usage

### Multiple Zoom Instances

```astro
<ImageZoom>
  <img src="/gallery1-image1.jpg" alt="Gallery 1" />
  <img src="/gallery1-image2.jpg" alt="Gallery 1" />
</ImageZoom>

<ImageZoom>
  <img src="/gallery2-image1.jpg" alt="Gallery 2" />
  <img src="/gallery2-image2.jpg" alt="Gallery 2" />
</ImageZoom>
```

### Custom Theme

```astro
<ImageZoom
  theme={{
    backgroundColor: 'rgba(26, 32, 44, 0.95)',
    closeButtonColor: '#f7fafc',
    navigationColor: '#63b3ed'
  }}
  animationDuration={400}
>
  <img src="/image.jpg" alt="Custom themed image" />
</ImageZoom>
```

### Programmatic Control (Advanced)

```astro
<ImageZoom class="my-gallery" />

<script>
  import { ZoomClass } from 'astro-image-zoom';

  const wrapper = document.querySelector('.my-gallery');
  const zoom = new ZoomClass(wrapper);

  // Later, if needed:
  // zoom.destroy();
</script>
```

`ZoomClass` reads the options from the `data-*` attributes that `<ImageZoom>` renders; the theme and
the duration come from the `--zoom-*` variables.

## Examples

### Blog Post Images

```astro
---
import ImageZoom from 'astro-image-zoom/ImageZoom.astro';
---

<article>
  <h1>My Blog Post</h1>
  <p>Check out these amazing photos from my trip:</p>

  <ImageZoom>
    <figure>
      <img
        src="/trip-photo-1.jpg"
        alt="Mountain landscape"
        data-zoom-caption="The view from the summit"
      />
      <figcaption>Summit view</figcaption>
    </figure>

    <figure>
      <img
        src="/trip-photo-2.jpg"
        alt="Lake reflection"
        data-zoom-caption="Perfect morning reflection"
      />
      <figcaption>Lake reflection</figcaption>
    </figure>
  </ImageZoom>
</article>
```

### Portfolio Grid

```astro
---
import ImageZoom from 'astro-image-zoom/ImageZoom.astro';

const projects = [
  { thumb: '/thumb1.jpg', full: '/full1.jpg', title: 'Project 1' },
  { thumb: '/thumb2.jpg', full: '/full2.jpg', title: 'Project 2' },
  { thumb: '/thumb3.jpg', full: '/full3.jpg', title: 'Project 3' },
];
---

<ImageZoom>
  <div class="portfolio-grid">
    {projects.map(project => (
      <img
        src={project.thumb}
        data-zoom-src={project.full}
        alt={project.title}
        data-zoom-caption={project.title}
      />
    ))}
  </div>
</ImageZoom>

<style>
  .portfolio-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
</style>
```

## Browser Support

Current browsers: the overlay uses `<dialog>`, shadow DOM, `:has()` and `light-dark()` (Chrome and
Edge 123, Firefox 120, Safari 17.5 and later). During the beta it has been tested in Chromium; reports
from Firefox and Safari, desktop or mobile, are welcome.

## License

[MIT](https://github.com/antoniohg/astro-image-zoom/blob/main/LICENSE)

## Contributing

Found a bug or have an idea? Open an [issue](https://github.com/antoniohg/astro-image-zoom/issues) or
a pull request.

Inspired by Medium's image viewer.
