/**
 * Zoom TypeScript Module
 * Medium-style zoom with accessibility and performance optimizations
 */

import overlayStyles from './overlay.css?inline';

interface ZoomImage {
  src: string;
  alt: string;
  caption?: string;
  element: HTMLElement;
}

interface ZoomState {
  isOpen: boolean;
  currentIndex: number;
  images: ZoomImage[];
}

/**
 * The detail of the events an <astro-image-zoom> dispatches: astro-image-zoom:open when a zoom
 * opens, astro-image-zoom:change when the gallery moves to another image and astro-image-zoom:close
 * when it closes. They bubble, so one listener on the document hears every gallery.
 */
export interface ZoomEventDetail {
  /** Position of the image in its gallery, from 0 */
  index: number;
  /** Number of images in the gallery */
  total: number;
  /** URL of the full-size image the zoom shows */
  src: string;
  alt: string;
  caption: string;
  /** The link on the page that opens this image */
  link: HTMLElement;
}

type ZoomEvents = {
  'astro-image-zoom:open': CustomEvent<ZoomEventDetail>;
  'astro-image-zoom:change': CustomEvent<ZoomEventDetail>;
  'astro-image-zoom:close': CustomEvent<ZoomEventDetail>;
};

// Typed addEventListener for the events, on any element (HTMLElementEventMap extends this one), and
// on the document and the window they bubble to
declare global {
  interface ElementEventMap extends ZoomEvents {}
  interface DocumentEventMap extends ZoomEvents {}
  interface WindowEventMap extends ZoomEvents {}
}

// One slide of the carousel: the overlay holds a slide per image, scrolled and snapped natively
interface ZoomSlide {
  figure: HTMLElement;
  img: HTMLImageElement;
  loaded?: Promise<void>;
}

// The custom properties of the overlay. When it opens, it takes the values set around the
// <astro-image-zoom> that opened it, so each gallery can have its own
const ZOOM_VARIABLES = [
  '--zoom-bg',
  '--zoom-close-color',
  '--zoom-close-bg',
  '--zoom-nav-color',
  '--zoom-nav-bg',
  '--zoom-caption-color',
  '--zoom-caption-bg',
  '--zoom-controls-offset',
  '--zoom-caption-max-width',
  '--zoom-caption-font',
  '--zoom-caption-font-size',
  '--zoom-caption-radius',
  '--zoom-padding',
  '--zoom-image-radius',
  '--zoom-button-size',
  '--zoom-button-radius',
  '--zoom-animation-duration',
  '--zoom-slide-duration',
  '--zoom-slide-easing',
  '--zoom-color-scheme'
];

const CAPTION_POSITIONS = ['bottom', 'top'];
const NAVIGATION_LAYOUTS = ['bar', 'sides'];

// The CSS animations of the overlay that open() and close() wait for
const OPEN_ANIMATIONS = ['astro-image-zoom-in', 'astro-image-zoom-backdrop-in'];
const CLOSE_ANIMATIONS = ['astro-image-zoom-out', 'astro-image-zoom-backdrop-out'];
// How long (ms) a requested slide counts as the target while the smooth scroll runs
const SCROLL_TARGET_TTL = 500;
// Vertical wheel deltas below this many pixels do not close the overlay
const WHEEL_CLOSE_DELTA = 4;
// After a horizontal wheel event (ms), vertical jitter of the same touchpad swipe is ignored
const WHEEL_HORIZONTAL_GRACE = 250;

const OVERLAY_ID = 'astro-image-zoom-global-overlay';

// The caption and the navigation bar live inside the track, after the slides: fixed, so they do not
// scroll with it, and a scrollable region with focusable controls needs no Tab stop of its own
// (WCAG 2.1.1). tabindex="-1" keeps the track itself out of the tab order: Firefox makes any
// scroller focusable, even with controls inside, and that stop did nothing. The dialog has
// tabindex="-1" too: Safari makes it a Tab stop of its own, with nothing visible focused.
const OVERLAY_HTML = `
<dialog class="astro-image-zoom-overlay" part="overlay" tabindex="-1" aria-label="Image zoom overlay">
  <div class="astro-image-zoom-backdrop" part="backdrop" aria-hidden="true"></div>
  <div class="astro-image-zoom-content" role="document">
    <button class="astro-image-zoom-close" part="close" aria-label="Close zoom overlay" type="button">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    </button>
    <div class="astro-image-zoom-track" part="track" tabindex="-1" role="group" aria-label="Images">
      <div class="astro-image-zoom-bottom">
        <p class="astro-image-zoom-caption" part="caption" aria-live="polite"></p>
        <div class="astro-image-zoom-toolbar" part="toolbar">
          <button class="astro-image-zoom-nav astro-image-zoom-prev" part="nav prev" aria-label="Previous image" type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <span class="astro-image-zoom-counter" part="counter"></span>
          <button class="astro-image-zoom-nav astro-image-zoom-next" part="nav next" aria-label="Next image" type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</dialog>`;

// Resolves when the named CSS animations of the element or its descendants end or are cancelled,
// and at once when none runs. The durations live in CSS only: with reduced motion they are 0s.
function animationsFinished(element: Element, names: string[]): Promise<unknown> {
  const animations = element
    .getAnimations({ subtree: true })
    .filter((animation) => animation instanceof CSSAnimation && names.includes(animation.animationName));
  return Promise.allSettled(animations.map(({ finished }) => finished));
}

/**
 * Returns the overlay shared by every zoom instance, creating it on first use.
 * Built on the client so the page HTML never repeats its id, however many
 * <ImageZoom> components it has; without JavaScript the links simply open the image.
 */
function getOverlay(): HTMLDialogElement {
  const existing = document.getElementById(OVERLAY_ID)?.shadowRoot?.querySelector('dialog');
  if (existing) return existing;

  // The dialog lives in the shadow root of a host element: the CSS of the page cannot reach it
  const host = document.createElement('astro-image-zoom-overlay');
  host.id = OVERLAY_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = overlayStyles;
  const template = document.createElement('template');
  template.innerHTML = OVERLAY_HTML.trim();
  root.append(style, template.content);
  document.body.append(host);
  return root.querySelector('dialog')!;
}

// A box on the screen, such as the one getBoundingClientRect() returns
type Box = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

// How a thumbnail draws its file inside its box: the computed object-fit and object-position of the
// <img>, and the size of the file
export interface ThumbnailFit {
  objectFit: string;
  objectPosition: string;
  naturalWidth: number;
  naturalHeight: number;
}

interface FlipTransform {
  x: number;
  y: number;
  scale: number;
  clipPath: string;
}

function thumbnailFit(img: HTMLImageElement): ThumbnailFit {
  const { objectFit, objectPosition } = getComputedStyle(img);
  return { objectFit, objectPosition, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
}

// Where object-position puts the drawn file along one axis, given the free space of the box
// (negative when the file overflows it). Browsers compute it as a percentage of that space, a
// length in px, or calc() of both: "right 10px" is calc(100% - 10px). Anything else, or nothing,
// centers the file, the default
function positionOffset(value: string | undefined, free: number): number {
  const percent = /(-?[\d.]+)%/.exec(value ?? '');
  const pixels = /([+-]?)\s*(-?[\d.]+)px/.exec(value ?? '');
  if (!percent && !pixels) return free / 2;

  const offset =
    (percent ? (free * Number(percent[1])) / 100 : 0) +
    (pixels ? Number(pixels[2]) * (pixels[1] === '-' ? -1 : 1) : 0);
  return Number.isFinite(offset) ? offset : free / 2;
}

// The box where a thumbnail draws its file on the screen, which object-fit can make smaller than
// its box (contain) or bigger (cover, none). Without a fit, or with fill, it is the box itself.
// fill also stretches a file of another shape, which one uniform scale cannot follow: such a
// thumbnail animates as with cover
function drawnBox(source: Box, fit?: ThumbnailFit): Box {
  if (!fit || !fit.naturalWidth || !fit.naturalHeight) return source;

  const widthRatio = source.width / fit.naturalWidth;
  const heightRatio = source.height / fit.naturalHeight;
  const scales: Record<string, number> = {
    contain: Math.min(widthRatio, heightRatio),
    cover: Math.max(widthRatio, heightRatio),
    none: 1,
    'scale-down': Math.min(1, widthRatio, heightRatio),
  };
  const scale = scales[fit.objectFit];
  if (scale === undefined) return source;

  const width = fit.naturalWidth * scale;
  const height = fit.naturalHeight * scale;
  // One value per axis; a calc() has spaces of its own
  const [positionX, positionY] = fit.objectPosition.match(/calc\([^)]*\)|\S+/g) ?? [];
  return {
    left: source.left + positionOffset(positionX, source.width - width),
    top: source.top + positionOffset(positionY, source.height - height),
    width,
    height,
  };
}

/**
 * The FLIP transform that lays the zoomed image, with the `final` box, over its thumbnail, with the
 * `source` box: the translation between their centers, the scale, and the clip-path (in the
 * image's own, unscaled pixels) that trims what the thumbnail does not show.
 *
 * `fit` tells how the thumbnail draws its file (object-fit, object-position). That file may also be
 * cropped from the full image already, as Astro's <Image> does with a width and a height of another
 * shape: it is taken as a centered crop, so the scale matches what the thumbnail really shows.
 * Without `fit`, the image covers the source box, as object-fit: cover does.
 */
export function flipTransform(source: Box, final: Box, fit?: ThumbnailFit): FlipTransform {
  const drawn = drawnBox(source, fit);

  // The whole image around the drawn file, at the same scale, taking the file as a centered crop
  const imageRatio = final.width / final.height;
  const drawnRatio = drawn.width / drawn.height;
  const width = imageRatio > drawnRatio ? drawn.height * imageRatio : drawn.width;
  const height = width / imageRatio;
  const left = drawn.left + (drawn.width - width) / 2;
  const top = drawn.top + (drawn.height - height) / 2;
  const scale = width / final.width;

  const x = left + width / 2 - (final.left + final.width / 2);
  const y = top + height / 2 - (final.top + final.height / 2);

  // Only what the thumbnail shows stays visible: the drawn file, cut to the box of the thumbnail
  const visibleLeft = Math.max(drawn.left, source.left);
  const visibleTop = Math.max(drawn.top, source.top);
  const visibleRight = Math.min(drawn.left + drawn.width, source.left + source.width);
  const visibleBottom = Math.min(drawn.top + drawn.height, source.top + source.height);
  const insetTop = (visibleTop - top) / scale;
  const insetRight = (left + width - visibleRight) / scale;
  const insetBottom = (top + height - visibleBottom) / scale;
  const insetLeft = (visibleLeft - left) / scale;
  const clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`;

  return { x, y, scale, clipPath };
}

class Zoom {
  private wrapper: HTMLElement;
  // The element that holds the overlay's shadow root, and its --zoom-* variables
  private host!: HTMLElement;
  private overlay!: HTMLDialogElement;
  private backdrop!: HTMLElement;
  private track!: HTMLElement;
  private captionElement!: HTMLElement;
  private closeButton!: HTMLButtonElement;
  private toolbar!: HTMLElement;
  private counter!: HTMLElement;
  private prevButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private slides: ZoomSlide[] = [];

  private state: ZoomState = {
    isOpen: false,
    currentIndex: 0,
    images: []
  };

  private options = {
    closeOnBackdrop: true,
    closeOnImage: true,
    closeOnScroll: true,
    showNavigation: true
  };

  private isClosing = false;
  // True from open() until the image is ready and the opening animation starts
  private openPending = false;
  private previousFocus: HTMLElement | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  // timeStamp of the last horizontal wheel event; none yet, so the first vertical one always counts
  private lastHorizontalWheel = -Infinity;
  private scrollTarget = 0;
  private scrollTargetUntil = 0;
  private openId = 0;

  // Listeners on the page's links live as long as the instance
  private controller = new AbortController();
  // Listeners on the shared overlay live only while this instance has it open
  private openController: AbortController | null = null;

  constructor(wrapper: HTMLElement) {
    this.wrapper = wrapper;

    // Get configuration from data attributes
    this.options.closeOnBackdrop = wrapper.dataset.closeBackdrop !== 'false';
    this.options.closeOnImage = wrapper.dataset.closeImage !== 'false';
    this.options.closeOnScroll = wrapper.dataset.closeScroll !== 'false';
    this.options.showNavigation = wrapper.dataset.showNav !== 'false';

    // One overlay is shared by every zoom instance on the page
    this.overlay = getOverlay();
    this.host = (this.overlay.getRootNode() as ShadowRoot).host as HTMLElement;
    this.backdrop = this.overlay.querySelector('.astro-image-zoom-backdrop')!;
    this.track = this.overlay.querySelector('.astro-image-zoom-track')!;
    this.captionElement = this.overlay.querySelector('.astro-image-zoom-caption')!;
    this.closeButton = this.overlay.querySelector('.astro-image-zoom-close')!;
    this.toolbar = this.overlay.querySelector('.astro-image-zoom-toolbar')!;
    this.counter = this.overlay.querySelector('.astro-image-zoom-counter')!;
    this.prevButton = this.overlay.querySelector('.astro-image-zoom-prev')!;
    this.nextButton = this.overlay.querySelector('.astro-image-zoom-next')!;

    this.setupEventListeners();
  }

  // Only the links the component generated and those the site marks with data-zoom: any other link
  // with an image (a card, a logo) keeps navigating
  private collectImages(): void {
    const links = this.wrapper.querySelectorAll<HTMLAnchorElement>('a[data-zoom-generated], a[data-zoom]');

    this.state.images = Array.from(links)
      .filter((anchor) => !this.isIgnored(anchor))
      .map((anchor) => {
        const img = anchor.querySelector('img');
        return {
          src: anchor.href,
          alt: img?.alt || '',
          caption: anchor.dataset.zoomCaption || anchor.title || '',
          element: anchor
        };
      })
      .filter(({ src }) => src);
  }

  // data-zoom-ignore, or a selector of the ignore prop, on the image of a link or on an element
  // around it, up to the wrapper, leaves the link out of the zoom and the gallery. The generated
  // links are the images the server kept: matching them here, with the new <a> in between, could
  // leave out images the server wrapped. Only the site's own links with data-zoom are checked
  private isIgnored(anchor: HTMLAnchorElement): boolean {
    if (anchor.hasAttribute('data-zoom-generated')) return false;
    const start = anchor.querySelector('img') ?? anchor;
    const inside = (match: Element | null): boolean =>
      match !== null && match !== this.wrapper && this.wrapper.contains(match);
    if (inside(start.closest('[data-zoom-ignore]'))) return true;

    const ignore = this.wrapper.dataset.ignore;
    if (!ignore) return false;
    try {
      return inside(start.closest(ignore));
    } catch {
      // An invalid selector: ImageZoom.astro rejects them at build time, ZoomClass users may not
      return false;
    }
  }

  private setupEventListeners(): void {
    // One delegated listener: links added later are picked up when clicked.
    // Links already handle keyboard navigation natively (Enter key)
    this.wrapper.addEventListener(
      'click',
      (e) => {
        // Let the browser handle "open in new tab" and similar clicks
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        this.collectImages();
        const link = (e.target as Element).closest('a');
        const index = this.state.images.findIndex(({ element }) => element === link);
        if (index === -1) return;

        e.preventDefault();
        this.open(index);
      },
      { signal: this.controller.signal }
    );
  }

  // The overlay is shared, so only the instance that has it open may listen to it
  private bindOverlayListeners(signal: AbortSignal): void {
    // Handle native dialog cancel (Escape key), also while the image is loading
    this.overlay.addEventListener('cancel', this.handleCancel, { signal });

    this.closeButton.addEventListener('click', () => this.close(), { signal });

    if (this.options.showNavigation) {
      this.prevButton.addEventListener('click', () => this.prev(), { signal });
      this.nextButton.addEventListener('click', () => this.next(), { signal });
    }

    // The slides cover the backdrop, so they receive its clicks. Click on the image closes
    // (like Medium), click beside it counts as a backdrop click. The caption and the controls
    // live in the track too: their clicks are theirs
    this.track.addEventListener(
      'click',
      (e) => {
        if ((e.target as Element).closest('.astro-image-zoom-bottom')) return;
        const onImage = (e.target as Element).closest('.astro-image-zoom-image') !== null;
        if (onImage ? this.options.closeOnImage : this.options.closeOnBackdrop) this.close();
      },
      { signal }
    );
  }

  // The image of the slide on screen
  private get imageElement(): HTMLImageElement {
    return this.slides[this.state.currentIndex].img;
  }

  private async open(index: number): Promise<void> {
    if (this.state.isOpen) return;

    // Identifies this opening; close() increments it to cancel a pending open
    const currentOpenId = ++this.openId;

    // Focus goes back to the link that opened the zoom. Not document.activeElement: Safari does not
    // focus a link on click, so it would be <body>
    this.previousFocus = this.state.images[index].element;

    // Update state
    this.state.isOpen = true;
    this.state.currentIndex = index;
    // The grace period after a horizontal wheel belongs to one opening, not to the previous one
    this.lastHorizontalWheel = -Infinity;

    // The variables of this gallery (the theme and animationDuration props among them)
    this.inheritVariables();

    // Get source image and position
    const sourceImg = this.state.images[index].element.querySelector('img')!;
    const sourceRect = sourceImg.getBoundingClientRect();
    const sourceFit = thumbnailFit(sourceImg);

    this.buildSlides();
    this.renderActive(index);
    this.emit('open');
    // Hidden until the image is ready, so the FLIP animation starts from a clean frame. Before any
    // layout, so its opacity transition does not run: it would show the image for a frame
    this.imageElement.style.opacity = '0';

    // Listen to the overlay from now until close(), also while the image is loading
    this.openController = new AbortController();
    const { signal } = this.openController;
    this.bindOverlayListeners(signal);

    // Show overlay and prevent body scroll
    this.overlay.showModal();
    this.overlay.setAttribute('data-close-backdrop', String(this.options.closeOnBackdrop));
    this.overlay.setAttribute('data-close-image', String(this.options.closeOnImage));
    // Read on each opening, so a page can change them after load
    const captionPosition = this.wrapper.dataset.captionPosition ?? '';
    this.overlay.setAttribute(
      'data-caption-position',
      CAPTION_POSITIONS.includes(captionPosition) ? captionPosition : 'bottom'
    );
    this.overlay.setAttribute('data-show-caption', String(this.wrapper.dataset.showCaption !== 'false'));
    this.overlay.setAttribute('data-show-counter', String(this.wrapper.dataset.showCounter !== 'false'));
    const navigationLayout = this.wrapper.dataset.navigationLayout ?? '';
    this.overlay.setAttribute(
      'data-navigation-layout',
      NAVIGATION_LAYOUTS.includes(navigationLayout) ? navigationLayout : 'bar'
    );
    document.body.style.overflow = 'hidden';

    // Show the slide of the image, without letting a swipe move it away while it loads
    this.track.style.overflowX = 'hidden';
    this.jumpToSlide(index);

    this.openPending = true;
    await this.loadSlide(index);

    // Closed while loading: close() already restored everything
    if (currentOpenId !== this.openId) return;
    this.openPending = false;
    this.track.style.overflowX = '';
    // Shown at once, in the frame the thumbnail hides: its opacity transition would fade it in over
    // an empty spot, a blink. The transition comes back for later changes
    this.imageElement.style.transition = 'none';
    this.imageElement.style.opacity = '1';
    void this.imageElement.offsetWidth;
    this.imageElement.style.transition = '';
    this.preloadNeighbors(index);

    // FLIP Animation
    const finalRect = this.imageElement.getBoundingClientRect();
    const transform = flipTransform(sourceRect, finalRect, sourceFit);

    // Set CSS variables for animation
    this.setAnimationVariables(transform);

    // Hide thumbnail instantly and trigger CSS animation simultaneously
    this.hideThumbnail(sourceImg);
    this.overlay.classList.add('is-opening');

    // After the animation, switch to the is-open state
    void animationsFinished(this.overlay, OPEN_ANIMATIONS).then(() => {
      if (currentOpenId !== this.openId) return;
      this.overlay.classList.remove('is-opening');
      this.overlay.classList.add('is-open');
    });

    // Arrow keys move through the gallery
    document.addEventListener('keydown', this.handleKeydown, { signal });

    // Horizontal swipes scroll the track natively; the slide on screen follows the scroll
    this.track.addEventListener('scroll', this.handleScroll, { passive: true, signal });

    // Smooth close on vertical scroll/wheel (like Medium - non-blocking)
    if (this.options.closeOnScroll) {
      this.overlay.addEventListener('touchstart', this.handleTouchStart, { passive: true, signal });
      this.overlay.addEventListener('touchmove', this.handleTouchMove, { passive: true, signal });
      this.overlay.addEventListener('wheel', this.handleWheel, { passive: true, signal });
    }

    // The modal dialog traps the focus natively
    this.closeButton.focus();
  }

  private close(byScroll = false): void {
    if (!this.state.isOpen || this.isClosing) return;

    this.isClosing = true;
    this.state.isOpen = false;
    this.emit('close');

    // Cancel a pending open() that is still waiting for the image to load
    this.openId++;
    const openWasPending = this.openPending;
    this.openPending = false;

    // Release the shared overlay: no listener of this instance survives the close
    this.openController?.abort();
    this.openController = null;

    // Get source image BEFORE any DOM changes
    const sourceElement = this.state.images[this.state.currentIndex].element;
    const sourceImg = sourceElement.querySelector('img')!;

    // Closed while loading: the opening animation never ran, so close without animating
    if (openWasPending) {
      this.finalizeClose(sourceImg);
      return;
    }

    // Stop a slide still gliding, so the image closes from a still position
    this.scrollTargetUntil = 0;
    this.setSlideOffset(0, false);
    this.jumpToSlide(this.state.currentIndex);

    // Closed during the opening: the close starts from where the image and the backdrop are, read
    // before the opening stops, not from the end of it
    if (this.overlay.classList.contains('is-opening')) {
      const image = getComputedStyle(this.imageElement);
      this.imageElement.style.setProperty('--transform-now', image.transform);
      this.imageElement.style.setProperty('--clip-now', image.clipPath);
      this.backdrop.style.setProperty('--backdrop-now', getComputedStyle(this.backdrop).opacity);
    }

    // The box the animation moves, without its transform: during the opening, the rect on screen
    // is the one of a moving image. The slide is the offset parent of the image
    const slideRect = (this.imageElement.offsetParent as HTMLElement).getBoundingClientRect();
    const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = this.imageElement;
    const startRect = new DOMRect(slideRect.left + offsetLeft, slideRect.top + offsetTop, offsetWidth, offsetHeight);

    this.overlay.classList.remove('is-open', 'is-opening');
    this.overlay.classList.add('is-closing');

    // To the thumbnail of the image on screen, which may not be the one the opening started from
    const targetRect = sourceImg.getBoundingClientRect();
    this.setAnimationVariables(flipTransform(targetRect, startRect, thumbnailFit(sourceImg)));

    // If closed by scroll, unlock scroll immediately and use special animation
    if (byScroll) {
      document.body.style.overflow = '';
      this.animateScrollClose(startRect, sourceImg);
    } else {
      void animationsFinished(this.overlay, CLOSE_ANIMATIONS).then(() => this.finalizeClose(sourceImg));
    }
  }

  private next(): void {
    this.scrollToSlide(this.slideIndex + 1);
  }

  private prev(): void {
    this.scrollToSlide(this.slideIndex - 1);
  }

  // Where the slide on screen is heading: quick presses keep adding up while the smooth
  // scroll of the previous one still runs
  private get slideIndex(): number {
    return performance.now() < this.scrollTargetUntil ? this.scrollTarget : this.state.currentIndex;
  }

  private scrollToSlide(index: number): void {
    if (!this.slides[index]) return;

    this.scrollTarget = index;
    this.scrollTargetUntil = performance.now() + SCROLL_TARGET_TTL;

    // The track jumps to the slide at once; the images then glide from where they were on
    // screen (a CSS transition, see overlay.css). An image still gliding goes on from its spot
    const from = this.track.scrollLeft - this.currentSlideOffset();
    this.jumpToSlide(index);
    this.setSlideOffset(this.track.scrollLeft - from, false);
    this.setSlideOffset(0, true);
  }

  // How far the images are from their place, in px, while they glide
  private currentSlideOffset(): number {
    const image = this.slides[0]?.img;
    return image ? Number.parseFloat(getComputedStyle(image).translate) || 0 : 0;
  }

  // Moves the images of the slides by `offset` px, gliding there when `animate`, at once otherwise
  private setSlideOffset(offset: number, animate: boolean): void {
    if (!animate) {
      this.track.classList.remove('is-sliding');
      this.track.style.setProperty('--astro-image-zoom-slide-offset', `${offset}px`);
      // Commit the offset before the transition starts from it
      void this.track.offsetWidth;
      return;
    }
    this.track.classList.add('is-sliding');
    this.track.style.setProperty('--astro-image-zoom-slide-offset', `${offset}px`);
  }

  // Shows a slide without the smooth scroll
  private jumpToSlide(index: number): void {
    this.track.scrollTo({ left: index * this.track.clientWidth, behavior: 'instant' });
  }

  private buildSlides(): void {
    this.slides = this.state.images.map(({ alt }) => {
      const figure = document.createElement('figure');
      figure.className = 'astro-image-zoom-slide';
      figure.part.add('slide');
      const img = document.createElement('img');
      img.className = 'astro-image-zoom-image';
      img.part.add('image');
      img.alt = alt;
      figure.append(img);
      return { figure, img };
    });

    // Before the caption and the controls, which stay in the track
    this.removeSlides();
    this.track.prepend(...this.slides.map(({ figure }) => figure));
  }

  private removeSlides(): void {
    for (const slide of this.track.querySelectorAll('.astro-image-zoom-slide')) slide.remove();
  }

  // Loads the image of a slide once; the spinner appears only if the wait is noticeable.
  // Resolves when the image is decoded, or failed: a broken image is shown as it is.
  private loadSlide(index: number): Promise<void> {
    const slide = this.slides[index];

    slide.loaded ??= (async () => {
      slide.img.src = this.state.images[index].src;
      // The CSS shows the spinner only if the wait lasts
      slide.figure.classList.add('is-loading');

      try {
        await slide.img.decode();
      } catch {
        // Load error: nothing to do
      }

      slide.figure.classList.remove('is-loading');
    })();

    return slide.loaded;
  }

  private preloadNeighbors(index: number): void {
    for (const neighbor of [index - 1, index + 1]) {
      if (this.slides[neighbor]) void this.loadSlide(neighbor);
    }
  }

  // The scroll moved another slide to the center of the overlay
  private handleScroll = (): void => {
    const width = this.track.clientWidth;
    if (!width) return;

    const index = Math.round(this.track.scrollLeft / width);
    if (index === this.state.currentIndex || !this.slides[index]) return;

    // Only the thumbnail of the image on screen stays hidden
    this.showThumbnail(this.getThumbnail(this.state.currentIndex));
    this.hideThumbnail(this.getThumbnail(index));

    this.renderActive(index);
    this.emit('change');
    void this.loadSlide(index);
    this.preloadNeighbors(index);
  }

  // Tells the page what the zoom shows now; see ZoomEventDetail
  private emit(type: 'open' | 'change' | 'close'): void {
    const { images, currentIndex } = this.state;
    const image = images[currentIndex];
    if (!image) return;
    this.wrapper.dispatchEvent(
      new CustomEvent<ZoomEventDetail>(`astro-image-zoom:${type}`, {
        bubbles: true,
        detail: {
          index: currentIndex,
          total: images.length,
          src: image.src,
          alt: image.alt,
          caption: image.caption ?? '',
          link: image.element,
        },
      })
    );
  }

  // Marks the slide on screen and updates what depends on it: caption and buttons
  private renderActive(index: number): void {
    this.state.currentIndex = index;

    this.slides.forEach(({ figure }, i) => {
      figure.classList.toggle('is-active', i === index);
      figure.setAttribute('aria-hidden', String(i !== index));
    });

    this.captionElement.textContent = this.state.images[index].caption || '';
    this.updateNavigationButtons();
  }

  // The navigation bar: arrows and counter, only for galleries
  private updateNavigationButtons(): void {
    const total = this.state.images.length;
    this.toolbar.hidden = !this.options.showNavigation || total < 2;
    if (this.toolbar.hidden) return;

    const index = this.state.currentIndex;
    this.counter.textContent = `${index + 1} / ${total}`;
    this.prevButton.setAttribute('aria-disabled', String(index === 0));
    this.nextButton.setAttribute('aria-disabled', String(index === total - 1));
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.state.isOpen) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.prev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.next();
        break;
    }
  }

  private handleCancel = (e: Event): void => {
    e.preventDefault(); // Prevent immediate closing
    this.close(); // Trigger animated close
  }

  private handleTouchStart = (e: TouchEvent): void => {
    // Ignore multi-touch (pinch to zoom)
    if (e.touches.length > 1) return;

    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  private handleWheel = (e: WheelEvent): void => {
    // Horizontal gestures scroll the track natively; the vertical jitter of a touchpad
    // swipe must not close the overlay
    if (Math.abs(e.deltaX) * 2 >= Math.abs(e.deltaY)) {
      this.lastHorizontalWheel = e.timeStamp;
      return;
    }

    if (Math.abs(e.deltaY) < WHEEL_CLOSE_DELTA) return;
    if (e.timeStamp - this.lastHorizontalWheel < WHEEL_HORIZONTAL_GRACE) return;
    this.close(true);
  }

  private handleTouchMove = (e: TouchEvent): void => {
    // Ignore multi-touch (pinch to zoom)
    if (e.touches.length > 1) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - this.touchStartX);
    const deltaY = Math.abs(touch.clientY - this.touchStartY);

    // Only trigger close on vertical scroll (not horizontal swipes)
    if (deltaY > deltaX && deltaY > 10) {
      this.close(true);
    }
  }

  public destroy(): void {
    // Remove the listeners on the page's links
    this.controller.abort();

    // Close if open (also releases the overlay listeners)
    if (this.state.isOpen) {
      this.close();
    }
  }

  // Copies the --zoom-* values around the wrapper to the overlay's host, which lives in <body> and
  // would otherwise only see the ones set on :root. A previous opening's values are cleared too.
  // On the host, they also reach the image that leaves the dialog when a scroll closes it.
  private inheritVariables(): void {
    const styles = getComputedStyle(this.wrapper);

    for (const name of ZOOM_VARIABLES) {
      const value = styles.getPropertyValue(name).trim();
      if (value) {
        this.host.style.setProperty(name, value);
      } else {
        this.host.style.removeProperty(name);
      }
    }
  }

  // The image shrinks back to the thumbnail with the closing animation (its variables are set),
  // but out of the dialog and positioned on the page, so it scrolls away with it
  private animateScrollClose(startRect: DOMRect, sourceImg: HTMLImageElement): void {
    const image = this.imageElement;
    image.style.top = `${startRect.top + window.scrollY}px`;
    image.style.left = `${startRect.left + window.scrollX}px`;
    image.style.width = `${startRect.width}px`;
    image.style.height = `${startRect.height}px`;
    image.classList.add('is-detached');
    this.backdrop.classList.add('is-detached');

    // The dialog stays open, transparent, until the end: the gesture that closes it goes on over
    // it. The image and the backdrop stay in the shadow root: they keep the overlay styles and
    // the CSS of the page still cannot reach them. The backdrop first, so the image covers it.
    // Mouse wheels and Chrome go on scrolling the page with the same gesture. Firefox touchpads and
    // touch screens keep a gesture on the element it started on, the overlay, even once it is gone:
    // the page scrolls from the next gesture. Closing the dialog earlier does not change that
    (this.overlay.getRootNode() as ShadowRoot).append(this.backdrop, image);

    void Promise.all([
      animationsFinished(image, CLOSE_ANIMATIONS),
      animationsFinished(this.backdrop, CLOSE_ANIMATIONS),
    ]).then(() => {
      // finalizeClose() discards the slides, so the image does not go back to its slide
      image.remove();
      this.backdrop.classList.remove('is-detached');
      this.overlay.prepend(this.backdrop);
      this.finalizeClose(sourceImg);
    });
  }

  private setAnimationVariables(transform: FlipTransform): void {
    this.imageElement.style.setProperty('--tx-from', `${transform.x}px`);
    this.imageElement.style.setProperty('--ty-from', `${transform.y}px`);
    this.imageElement.style.setProperty('--scale-from', transform.scale.toString());
    this.imageElement.style.setProperty('--clip-from', transform.clipPath);
    this.imageElement.style.setProperty('--clip-to', 'inset(0px)');
  }

  private getThumbnail(index: number): HTMLImageElement | null {
    return this.state.images[index]?.element.querySelector('img') ?? null;
  }

  // The thumbnail is hidden while its image is shown in the overlay
  private hideThumbnail(img: HTMLImageElement | null): void {
    if (!img) return;
    img.style.transition = 'none';
    img.style.opacity = '0';
    img.style.pointerEvents = 'none';
  }

  private showThumbnail(img: HTMLImageElement | null): void {
    if (!img) return;
    img.style.opacity = '';
    img.style.pointerEvents = '';

    // Force reflow then restore transition, so the thumbnail reappears without fading
    void img.offsetHeight;
    img.style.transition = '';
  }

  private finalizeClose(sourceImg: HTMLImageElement): void {
    // Restore the thumbnail as the overlay goes away - same frame
    this.showThumbnail(sourceImg);

    this.overlay.close();
    this.overlay.classList.remove('is-closing');
    this.backdrop.style.removeProperty('--backdrop-now');
    document.body.style.overflow = '';

    // The slides belong to the instance that opened the overlay: discard them
    this.removeSlides();
    this.track.style.overflowX = '';
    this.track.classList.remove('is-sliding');
    this.track.style.removeProperty('--astro-image-zoom-slide-offset');
    this.captionElement.textContent = '';
    this.slides = [];

    // Restore focus
    if (this.previousFocus) {
      this.previousFocus.focus({ preventScroll: true });
      this.previousFocus = null;
    }

    this.isClosing = false;
  }
}

// Export class for advanced usage
export { Zoom };
