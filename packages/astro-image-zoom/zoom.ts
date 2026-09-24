/**
 * Zoom TypeScript Module
 * Medium-style zoom with accessibility and performance optimizations
 */

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

// One slide of the carousel: the overlay holds a slide per image, scrolled and snapped natively
interface ZoomSlide {
  figure: HTMLElement;
  img: HTMLImageElement;
  loaded?: Promise<void>;
}

interface ZoomTheme {
  backgroundColor?: string;
  closeButtonColor?: string;
  navigationColor?: string;
}

// Animation duration (ms) when neither the prop nor --zoom-animation-duration sets one
const DEFAULT_DURATION = 300;
// The spinner only shows when the image takes longer than this to load
const SPINNER_DELAY = 200;
// How long (ms) a requested slide counts as the target while the smooth scroll runs
const SCROLL_TARGET_TTL = 500;
// Vertical wheel deltas below this many pixels do not close the overlay
const WHEEL_CLOSE_DELTA = 4;
// After a horizontal wheel event (ms), vertical jitter of the same touchpad swipe is ignored
const WHEEL_HORIZONTAL_GRACE = 250;

const OVERLAY_ID = 'astro-image-zoom-global-overlay';

const OVERLAY_HTML = `
<dialog id="${OVERLAY_ID}" class="astro-image-zoom-overlay" aria-label="Image zoom overlay">
  <div class="astro-image-zoom-backdrop" aria-hidden="true"></div>
  <div class="astro-image-zoom-content" role="document">
    <button class="astro-image-zoom-close" aria-label="Close zoom overlay" type="button">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    </button>
    <button class="astro-image-zoom-nav astro-image-zoom-prev" aria-label="Previous image" type="button">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </button>
    <button class="astro-image-zoom-nav astro-image-zoom-next" aria-label="Next image" type="button">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </button>
    <div class="astro-image-zoom-track"></div>
    <p class="astro-image-zoom-caption" aria-live="polite"></p>
  </div>
</dialog>`;

// Milliseconds of a CSS time such as `400ms` or `0.4s`; null when it is not one
function parseDuration(value: string): number | null {
  const match = /^([\d.]+)(m?s)$/.exec(value.trim());
  if (!match) return null;

  const duration = Number.parseFloat(match[1]) * (match[2] === 's' ? 1000 : 1);
  return Number.isFinite(duration) ? duration : null;
}

/**
 * Returns the overlay shared by every zoom instance, creating it on first use.
 * Built on the client so the page HTML never repeats its id, however many
 * <ImageZoom> components it has; without JavaScript the links simply open the image.
 */
function getOverlay(): HTMLDialogElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing instanceof HTMLDialogElement) return existing;

  const template = document.createElement('template');
  template.innerHTML = OVERLAY_HTML.trim();
  const overlay = template.content.firstElementChild as HTMLDialogElement;
  document.body.append(overlay);
  return overlay;
}

class Zoom {
  private wrapper: HTMLElement;
  private overlay!: HTMLDialogElement;
  private track!: HTMLElement;
  private captionElement!: HTMLElement;
  private closeButton!: HTMLButtonElement;
  private prevButton!: HTMLButtonElement | null;
  private nextButton!: HTMLButtonElement | null;
  private slides: ZoomSlide[] = [];

  private state: ZoomState = {
    isOpen: false,
    currentIndex: 0,
    images: []
  };

  private options = {
    keyboardNavigation: true,
    closeOnBackdrop: true,
    closeOnImage: true,
    closeOnScroll: true,
    showNavigation: true,
    // null: the duration comes from --zoom-animation-duration
    animationDuration: null as number | null,
    theme: {} as ZoomTheme
  };

  private isClosing = false;
  // True from open() until the image is ready and the opening animation starts
  private openPending = false;
  private previousFocus: HTMLElement | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private lastHorizontalWheel = 0;
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
    this.options.keyboardNavigation = wrapper.dataset.keyboard !== 'false';
    this.options.closeOnBackdrop = wrapper.dataset.closeBackdrop !== 'false';
    this.options.closeOnImage = wrapper.dataset.closeImage !== 'false';
    this.options.closeOnScroll = wrapper.dataset.closeScroll !== 'false';
    this.options.showNavigation = wrapper.dataset.showNav !== 'false';

    // Get animation duration from data attribute
    const duration = wrapper.dataset.animationDuration;
    const parsedDuration = Number.parseInt(duration ?? '', 10);
    if (Number.isFinite(parsedDuration)) {
      this.options.animationDuration = parsedDuration;
    }

    // Store theme config to apply when opening
    const themeConfig = wrapper.dataset.themeConfig;
    if (themeConfig && themeConfig !== '{}') {
      try {
        this.options.theme = JSON.parse(themeConfig);
      } catch (e) {
        console.error('Failed to parse theme config:', e);
      }
    }

    // One overlay is shared by every zoom instance on the page
    this.overlay = getOverlay();
    this.track = this.overlay.querySelector('.astro-image-zoom-track')!;
    this.captionElement = this.overlay.querySelector('.astro-image-zoom-caption')!;
    this.closeButton = this.overlay.querySelector('.astro-image-zoom-close')!;
    this.prevButton = this.overlay.querySelector('.astro-image-zoom-prev');
    this.nextButton = this.overlay.querySelector('.astro-image-zoom-next');

    this.setupEventListeners();
  }

  private collectImages(): void {
    const links = this.wrapper.querySelectorAll<HTMLAnchorElement>(
      'a[data-zoom-generated], a[data-zoom], a:has(img)'
    );

    this.state.images = Array.from(links)
      .map((anchor) => {
        const img = anchor.querySelector('img');
        return {
          src: anchor.href,
          alt: img?.alt || '',
          caption: anchor.dataset.zoomCaption || anchor.title || '',
          element: anchor
        };
      })
      .filter(({ src }) => src && src !== window.location.origin + '/' && src !== 'about:blank');
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

    if (this.prevButton && this.nextButton && this.options.showNavigation) {
      this.prevButton.addEventListener('click', () => this.prev(), { signal });
      this.nextButton.addEventListener('click', () => this.next(), { signal });
    }

    // The slides cover the backdrop, so they receive its clicks. Click on the image closes
    // (like Medium), click beside it counts as a backdrop click
    this.track.addEventListener(
      'click',
      (e) => {
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

  // Zero when the user prefers reduced motion, so animations and their timers finish at once.
  // Otherwise the animationDuration prop, or else the --zoom-animation-duration variable
  private get duration(): number {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    if (this.options.animationDuration !== null) return this.options.animationDuration;

    const value = getComputedStyle(this.overlay).getPropertyValue('--zoom-animation-duration');
    return parseDuration(value) ?? DEFAULT_DURATION;
  }

  private async open(index: number): Promise<void> {
    if (this.state.isOpen) return;

    // Identifies this opening; close() increments it to cancel a pending open
    const currentOpenId = ++this.openId;

    // Store current focused element
    this.previousFocus = document.activeElement as HTMLElement;

    // Update state
    this.state.isOpen = true;
    this.state.currentIndex = index;

    // Apply theme configuration for this instance
    this.applyTheme();

    // Pin the duration on the overlay, so the CSS animations and the JS timers agree. The inline
    // value of a previous opening goes first: it would hide the page's --zoom-animation-duration
    this.overlay.style.removeProperty('--zoom-animation-duration');
    this.overlay.style.setProperty('--zoom-animation-duration', `${this.duration}ms`);

    // Get source image and position
    const sourceImg = this.state.images[index].element.querySelector('img')!;
    const sourceRect = sourceImg.getBoundingClientRect();

    this.buildSlides();
    this.renderActive(index);

    // Listen to the overlay from now until close(), also while the image is loading
    this.openController = new AbortController();
    const { signal } = this.openController;
    this.bindOverlayListeners(signal);

    // Show overlay and prevent body scroll
    this.overlay.showModal();
    this.overlay.setAttribute('data-close-backdrop', String(this.options.closeOnBackdrop));
    this.overlay.setAttribute('data-close-image', String(this.options.closeOnImage));
    document.body.style.overflow = 'hidden';

    // Show the slide of the image, without letting a swipe move it away while it loads
    this.track.style.overflowX = 'hidden';
    this.track.scrollLeft = index * this.track.clientWidth;

    // Hidden until the image is ready, so the FLIP animation starts from a clean frame
    this.imageElement.style.opacity = '0';
    this.openPending = true;
    await this.loadSlide(index);

    // Closed while loading: close() already restored everything
    if (currentOpenId !== this.openId) return;
    this.openPending = false;
    this.track.style.overflowX = '';
    this.imageElement.style.opacity = '1';
    this.preloadNeighbors(index);

    // FLIP Animation
    const finalRect = this.imageElement.getBoundingClientRect();
    const transform = this.calculateFlipTransform(sourceRect, finalRect);

    // Set CSS variables for animation
    this.setAnimationVariables(transform);

    // Hide thumbnail instantly and trigger CSS animation simultaneously
    this.hideThumbnail(sourceImg);
    this.overlay.classList.add('is-opening');

    // After animation completes, switch to is-open state
    setTimeout(() => {
      if (currentOpenId !== this.openId) return;
      this.overlay.classList.remove('is-opening');
      this.overlay.classList.add('is-open');
    }, this.duration);

    // Add keyboard listener
    if (this.options.keyboardNavigation) {
      document.addEventListener('keydown', this.handleKeydown, { signal });
    }

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

    // Stop a smooth scroll still running, so the image closes from a still position
    this.scrollTargetUntil = 0;
    this.track.scrollLeft = this.state.currentIndex * this.track.clientWidth;

    this.overlay.classList.remove('is-open', 'is-opening');
    this.overlay.classList.add('is-closing');

    const startRect = this.imageElement.getBoundingClientRect();
    const targetRect = sourceImg.getBoundingClientRect();

    // Calculate transform for closing animation
    const transform = this.calculateFlipTransform(targetRect, startRect);

    // Set CSS variables for closing animation
    this.setAnimationVariables(transform);

    // If closed by scroll, unlock scroll immediately and use special animation
    if (byScroll) {
      document.body.style.overflow = '';
      this.animateScrollClose(startRect, targetRect, sourceImg);
    } else {
      // Normal close: cleanup after animation completes (closing animation is 75% of duration)
      const closeDuration = this.duration * 0.75;
      setTimeout(() => {
        this.finalizeClose(sourceImg);
      }, closeDuration);
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
    this.track.scrollTo({
      left: index * this.track.clientWidth,
      behavior: this.duration === 0 ? 'auto' : 'smooth'
    });
  }

  private buildSlides(): void {
    this.slides = this.state.images.map(({ alt }) => {
      const figure = document.createElement('figure');
      figure.className = 'astro-image-zoom-slide';
      const img = document.createElement('img');
      img.className = 'astro-image-zoom-image';
      img.alt = alt;
      figure.append(img);
      return { figure, img };
    });

    this.track.replaceChildren(...this.slides.map(({ figure }) => figure));
  }

  // Loads the image of a slide once; the spinner appears only if the wait is noticeable.
  // Resolves when the image is decoded, or failed: a broken image is shown as it is.
  private loadSlide(index: number): Promise<void> {
    const slide = this.slides[index];

    slide.loaded ??= (async () => {
      slide.img.src = this.state.images[index].src;
      const spinner = window.setTimeout(() => slide.figure.classList.add('is-loading'), SPINNER_DELAY);

      try {
        await slide.img.decode();
      } catch {
        // Load error: nothing to do
      }

      clearTimeout(spinner);
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
    void this.loadSlide(index);
    this.preloadNeighbors(index);
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

  private updateNavigationButtons(): void {
    if (!this.prevButton || !this.nextButton) return;

    const shouldShowNav = this.options.showNavigation && this.state.images.length > 1;

    if (!shouldShowNav) {
      this.prevButton.hidden = true;
      this.nextButton.hidden = true;
      return;
    }

    // Show navigation buttons
    this.prevButton.hidden = false;
    this.nextButton.hidden = false;

    // Update prev button state
    const isFirst = this.state.currentIndex === 0;
    this.prevButton.setAttribute('aria-disabled', String(isFirst));

    // Update next button state
    const isLast = this.state.currentIndex === this.state.images.length - 1;
    this.nextButton.setAttribute('aria-disabled', String(isLast));
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

  private calculateFlipTransform(sourceRect: DOMRect, finalRect: DOMRect): { x: number, y: number, scale: number, clipPath: string } {
    const scaleX = sourceRect.width / finalRect.width;
    const scaleY = sourceRect.height / finalRect.height;
    const scale = Math.max(scaleX, scaleY); // Use max to fill thumbnail

    const translateX = sourceRect.left + sourceRect.width / 2 - (finalRect.left + finalRect.width / 2);
    const translateY = sourceRect.top + sourceRect.height / 2 - (finalRect.top + finalRect.height / 2);

    // Calculate clip-path to hide parts that extend beyond the thumbnail
    // The scaled image is larger than the thumbnail, so we clip the excess
    const scaledWidth = finalRect.width * scale;
    const scaledHeight = finalRect.height * scale;

    const clipX = (scaledWidth - sourceRect.width) / 2;
    const clipY = (scaledHeight - sourceRect.height) / 2;

    // Inset values relative to the element's own dimensions
    const insetTop = clipY / scale;
    const insetRight = clipX / scale;
    const insetBottom = clipY / scale;
    const insetLeft = clipX / scale;

    const clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`;

    return { x: translateX, y: translateY, scale, clipPath };
  }


  public destroy(): void {
    // Remove the listeners on the page's links
    this.controller.abort();

    // Close if open (also releases the overlay listeners)
    if (this.state.isOpen) {
      this.close();
    }
  }

  private applyTheme(): void {
    const { backgroundColor, closeButtonColor, navigationColor } = this.options.theme;
    const variables = {
      '--zoom-bg': backgroundColor,
      '--zoom-close-color': closeButtonColor,
      '--zoom-nav-color': navigationColor
    };

    for (const [name, value] of Object.entries(variables)) {
      if (value) {
        this.overlay.style.setProperty(name, value);
      } else {
        this.overlay.style.removeProperty(name);
      }
    }
  }

  private animateScrollClose(startRect: DOMRect, targetRect: DOMRect, sourceImg: HTMLImageElement): void {
    // Use transform + clip-path instead of animating size to handle different aspect ratios
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;

    // Calculate the FLIP transform (same logic as normal close)
    const transform = this.calculateFlipTransform(targetRect, startRect);

    // Position image absolutely at its current visual position
    this.imageElement.style.position = 'absolute';
    this.imageElement.style.top = `${startRect.top + scrollTop}px`;
    this.imageElement.style.left = `${startRect.left + scrollLeft}px`;
    this.imageElement.style.width = `${startRect.width}px`;
    this.imageElement.style.height = `${startRect.height}px`;
    this.imageElement.style.margin = '0';
    this.imageElement.style.animation = 'none';
    this.imageElement.style.zIndex = '9999999';

    // Move to body so it scrolls with the page
    document.body.appendChild(this.imageElement);

    // Animate using transform + clip-path (maintains aspect ratio)
    const animation = this.imageElement.animate([
      {
        transform: 'translate(0, 0) scale(1)',
        clipPath: 'inset(0px)'
      },
      {
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        clipPath: transform.clipPath
      }
    ], {
      duration: this.duration * 0.75,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    });

    animation.onfinish = () => {
      // finalizeClose() discards the slides, so the image does not go back to its slide
      this.imageElement.remove();
      this.finalizeClose(sourceImg);
    };
  }

  private setAnimationVariables(transform: { x: number, y: number, scale: number, clipPath: string }): void {
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
    document.body.style.overflow = '';

    // The slides belong to the instance that opened the overlay: discard them
    this.track.replaceChildren();
    this.track.style.overflowX = '';
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
