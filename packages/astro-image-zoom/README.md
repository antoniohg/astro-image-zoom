# 🖼️ astro-image-zoom

A beautiful, accessible, and performant zoom component for Astro with Medium-style animations.

## ✨ Features

- **🎨 Medium-style animations** - Smooth zoom transitions from source image
- **♿ Fully accessible** - ARIA labels, keyboard navigation, focus management
- **⚡ High performance** - CSS transforms, optimized animations, lazy loading
- **📱 Touch-friendly** - Swipe gestures for mobile devices
- **🎛️ Highly configurable** - Customizable themes, animations, and behavior
- **🌙 Dark mode by default** - Beautiful dark overlay like Medium
- **🖱️ Multiple navigation methods** - Click, keyboard, touch, buttons
- **📦 Zero dependencies** - Pure TypeScript and CSS
- **🔌 Works with View Transitions** - Astro 3.0+ compatible

## 📦 Installation

```bash
npm install astro-image-zoom
```

## 🚀 Quick Start

### Basic Usage

Wrap your images in `<ImageZoom>`. You can mix Astro's `<Image>` and `<Picture>` with plain `<img>`
tags, local or remote:

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


## ⚙️ Configuration

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
| `theme.backgroundColor` | `string` | `rgba(0, 0, 0, 0.95)` | Overlay background color |
| `theme.closeButtonColor` | `string` | `#ffffff` | Close button color |
| `theme.navigationColor` | `string` | `#ffffff` | Navigation arrows color |
| `animationDuration` | `number` | `300` | Animation duration in milliseconds; overrides `--zoom-animation-duration` |
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

  /* Layout */
  --zoom-padding: 0; /* space between the zoomed image and the screen edges */
  --zoom-image-radius: 0; /* corners of the zoomed image */
  --zoom-button-size: 44px; /* arrows and close button */
  --zoom-button-radius: 999px; /* shape of the buttons and the navigation bar */
  --zoom-controls-offset: 1.25rem; /* distance from the controls and the caption to the edges */
  --zoom-caption-max-width: 70%; /* 90% on phones */
  --zoom-caption-font: inherit;
  --zoom-caption-font-size: 0.8125rem;
  --zoom-caption-radius: 6px;

  /* Focus ring drawn on the image when its link has keyboard focus */
  --zoom-focus-outline: 3px solid rebeccapurple; /* default: 2px solid currentColor */
  --zoom-focus-offset: 3px; /* use a negative value if a parent with overflow: hidden clips it */
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

The component loads its own stylesheet, so you don't need to import `zoom.css` yourself. Import
`astro-image-zoom/zoom.css` directly only if you use `ZoomClass` without the `<ImageZoom>` component.

#### Cascade layer

All the component styles live in the `astro-image-zoom` [cascade layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer).
Any unlayered CSS on your page overrides them, with no specificity tricks or `!important`.

If your site uses its own layers, add `astro-image-zoom` to your layer order so you decide what wins.
Declare the order before any stylesheet loads (for example, in an inline `<style>` at the top of
`<head>`), because the first time a layer appears fixes its position:

```html
<style is:inline>
  @layer reset, base, astro-image-zoom, components;
</style>
```

With this order your reset can't break the zoom overlay, and your `components` layer can still
customize it. Class names (`.astro-image-zoom-*`) and animation names are prefixed, so the styles
don't clash with the rest of your site.

Or apply custom styles to specific instances:

```astro
<ImageZoom class="custom-zoom">
  <!-- Your images -->
</ImageZoom>

<style>
  .custom-zoom img {
    border-radius: 8px;
  }

  .custom-zoom img:hover {
    transform: scale(1.05);
  }
</style>
```

## 🎮 Keyboard Shortcuts

- **Escape** - Close zoom
- **Arrow Left** - Previous image
- **Arrow Right** - Next image
- **Tab / Shift+Tab** - Navigate between controls

## 📱 Touch Gestures

- **Swipe Left** - Next image (also two-finger swipe on a touchpad)
- **Swipe Right** - Previous image
- **Tap backdrop** - Close zoom

## ♿ Accessibility Features

- ✅ ARIA labels and roles
- ✅ Keyboard navigation
- ✅ Focus trap (Tab key cycles through controls)
- ✅ Focus restoration (returns to trigger element)
- ✅ Screen reader announcements
- ✅ Reduced motion support
- ✅ High contrast mode support
- ✅ Keyboard-accessible images (tabindex)

## 🚀 Performance Features

- ✅ CSS transforms for smooth animations
- ✅ `will-change` optimization
- ✅ Event delegation
- ✅ Optimized reflows
- ✅ Lazy loading support
- ✅ Efficient event listeners cleanup
- ✅ RequestAnimationFrame for animations
- ✅ Minimal JavaScript bundle

## 🔧 Advanced Usage

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

## 🎨 Examples

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

## 🌐 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📄 License

MIT © Antonio

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

Found a bug? Please open an issue on [GitHub](https://github.com/antoniohg/astro-image-zoom/issues).

## 🙏 Credits

Inspired by Medium's beautiful image viewer and built with modern web standards.

---

Made with ❤️ for the Astro community
