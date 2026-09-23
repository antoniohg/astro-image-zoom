# 🖼️ Astro Zoom

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

```astro
---
import Zoom from 'astro-image-zoom/Zoom.astro';
import 'astro-image-zoom/zoom.css';
---

<Zoom>
  <img src="/image1.jpg" alt="Beautiful landscape" />
  <img src="/image2.jpg" alt="City skyline" />
  <img src="/image3.jpg" alt="Mountain view" />
</Zoom>
```

### With Custom Captions

```astro
<Zoom>
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
</Zoom>
```

### Gallery with Links

```astro
<Zoom>
  <a href="/full-res-image1.jpg" data-zoom>
    <img src="/thumbnail1.jpg" alt="Thumbnail 1" />
  </a>
  <a href="/full-res-image2.jpg" data-zoom>
    <img src="/thumbnail2.jpg" alt="Thumbnail 2" />
  </a>
</Zoom>
```

### High-Resolution Images

Use `data-zoom-src` to load higher resolution images in the zoom:

```astro
<Zoom>
  <img
    src="/thumbnail.jpg"
    data-zoom-src="/full-resolution.jpg"
    alt="High quality image"
  />
</Zoom>
```

### Using with Astro Assets (Optimized Images)

To use optimized Astro images, you can use the `<Image />` component. For the zoom overlay image (which requires a URL string), use the `getImage()` helper.

```astro
---
import { Image, getImage } from 'astro:assets';
import Zoom from 'astro-image-zoom/Zoom.astro';
import 'astro-image-zoom/zoom.css';

import myImage from '../assets/my-image.jpg';

// Optimize the full-resolution image for the zoom overlay
const optimizedImage = await getImage({
  src: myImage,
  format: 'webp',
  width: 1920 // Optional: limit width for better performance
});
---

<Zoom>
  <Image
    src={myImage}
    alt="A beautiful optimized image"
    width={600}
    data-zoom-src={optimizedImage.src}
  />
</Zoom>
```

> **Note:** Do not pass the `Image` component directly to `data-zoom-src` or call it as a function. The zoom script expects a string URL for the `data-zoom-src` attribute.


## ⚙️ Configuration

### Component Props

```astro
<Zoom
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
  id="my-zoom"
/>
```

#### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `theme` | `object` | `{}` | Theme configuration object |
| `theme.backgroundColor` | `string` | `rgba(0, 0, 0, 0.95)` | Overlay background color |
| `theme.closeButtonColor` | `string` | `#ffffff` | Close button color |
| `theme.navigationColor` | `string` | `#ffffff` | Navigation arrows color |
| `animationDuration` | `number` | `300` | Animation duration in milliseconds |
| `keyboardNavigation` | `boolean` | `true` | Enable keyboard shortcuts |
| `closeOnBackdrop` | `boolean` | `true` | Close when clicking backdrop |
| `closeOnImage` | `boolean` | `false` | Close when clicking the zoomed image |
| `closeOnScroll` | `boolean` | `true` | Close when scrolling/wheeling |
| `showNavigation` | `boolean` | `true` | Show navigation arrows |
| `class` | `string` | `''` | Custom CSS class |
| `id` | `string` | `'astro-zoom'` | Unique zoom ID |

### Custom Styling

You can override the default styles using CSS variables:

```css
:root {
  --zoom-bg: rgba(20, 20, 30, 0.98);
  --zoom-close-color: #ff6b6b;
  --zoom-nav-color: #4ecdc4;
  --zoom-animation-duration: 400ms;
  --zoom-z-index: 9999;
}
```

Or apply custom styles to specific instances:

```astro
<Zoom class="custom-zoom">
  <!-- Your images -->
</Zoom>

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

- **Swipe Left** - Next image
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
<Zoom id="gallery-1">
  <img src="/gallery1-image1.jpg" alt="Gallery 1" />
  <img src="/gallery1-image2.jpg" alt="Gallery 1" />
</Zoom>

<Zoom id="gallery-2">
  <img src="/gallery2-image1.jpg" alt="Gallery 2" />
  <img src="/gallery2-image2.jpg" alt="Gallery 2" />
</Zoom>
```

### Custom Theme

```astro
<Zoom
  theme={{
    backgroundColor: 'rgba(26, 32, 44, 0.95)',
    closeButtonColor: '#f7fafc',
    navigationColor: '#63b3ed'
  }}
  animationDuration={400}
>
  <img src="/image.jpg" alt="Custom themed image" />
</Zoom>
```

### Programmatic Control (Advanced)

```astro
<Zoom id="my-gallery" />

<script>
  import { ZoomClass } from 'astro-image-zoom';

  const wrapper = document.querySelector('[data-zoom-id="my-gallery"]');
  const zoom = new ZoomClass(wrapper);

  // Later, if needed:
  // zoom.destroy();
</script>
```

## 🎨 Examples

### Blog Post Images

```astro
---
import Zoom from 'astro-image-zoom/Zoom.astro';
import 'astro-image-zoom/zoom.css';
---

<article>
  <h1>My Blog Post</h1>
  <p>Check out these amazing photos from my trip:</p>

  <Zoom>
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
  </Zoom>
</article>
```

### Portfolio Grid

```astro
---
import Zoom from 'astro-image-zoom/Zoom.astro';
import 'astro-image-zoom/zoom.css';

const projects = [
  { thumb: '/thumb1.jpg', full: '/full1.jpg', title: 'Project 1' },
  { thumb: '/thumb2.jpg', full: '/full2.jpg', title: 'Project 2' },
  { thumb: '/thumb3.jpg', full: '/full3.jpg', title: 'Project 3' },
];
---

<Zoom>
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
</Zoom>

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
