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

interface ZoomTheme {
  backgroundColor?: string;
  closeButtonColor?: string;
  navigationColor?: string;
}

// The spinner only shows when the image takes longer than this to load
const SPINNER_DELAY = 200;
// Minimum horizontal distance, in pixels, of a swipe
const SWIPE_DISTANCE = 50;
// Wheel events closer than this (ms) belong to the same touchpad gesture, inertia included
const WHEEL_GESTURE_GAP = 120;
// Wheel deltas below this many pixels are ignored
const WHEEL_NOISE = 3;

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
    <figure class="astro-image-zoom-figure">
      <img class="astro-image-zoom-image" src="" alt="" loading="eager" />
      <figcaption class="astro-image-zoom-caption" aria-live="polite"></figcaption>
    </figure>
  </div>
</dialog>`;

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
  private imageElement!: HTMLImageElement;
  private captionElement!: HTMLElement;
  private closeButton!: HTMLButtonElement;
  private prevButton!: HTMLButtonElement | null;
  private nextButton!: HTMLButtonElement | null;
  private backdrop!: HTMLElement;

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
    animationDuration: 300,
    theme: {} as ZoomTheme
  };

  private isClosing = false;
  // True from open() until the image is ready and the opening animation starts
  private openPending = false;
  private previousFocus: HTMLElement | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  // Touchpad swipe: a stream of wheel events, decided once per gesture
  private wheelAxis: 'x' | 'y' = 'y';
  private wheelDeltaX = 0;
  private wheelSwiped = false;
  private lastWheelTime = 0;
  private lastWheelDeltaX = 0;
  private navigationId = 0;
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
    this.backdrop = this.overlay.querySelector('.astro-image-zoom-backdrop')!;
    this.imageElement = this.overlay.querySelector('.astro-image-zoom-image')!;
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

    if (this.options.closeOnBackdrop) {
      this.backdrop.addEventListener('click', () => this.close(), { signal });
    }

    // Click on image closes (like Medium)
    if (this.options.closeOnImage) {
      this.imageElement.addEventListener('click', () => this.close(), { signal });
    }
  }

  // Zero when the user prefers reduced motion, so animations and their timers finish at once
  private get duration(): number {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : this.options.animationDuration;
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

    // Apply animation duration
    this.overlay.style.setProperty('--zoom-animation-duration', `${this.duration}ms`);

    // Get source image and position
    const sourceImg = this.state.images[index].element.querySelector('img')!;
    const sourceRect = sourceImg.getBoundingClientRect();

    // Update content (image, caption, nav buttons)
    this.updateContent(index);

    // Listen to the overlay from now until close(), also while the image is loading
    this.openController = new AbortController();
    const { signal } = this.openController;
    this.bindOverlayListeners(signal);

    // Show overlay and prevent body scroll
    this.overlay.showModal();
    this.overlay.setAttribute('data-close-backdrop', String(this.options.closeOnBackdrop));
    this.overlay.setAttribute('data-close-image', String(this.options.closeOnImage));
    document.body.style.overflow = 'hidden';

    // Reset styles
    this.imageElement.style.transform = '';

    // Hidden until the image is ready, so the FLIP animation starts from a clean frame
    this.imageElement.style.opacity = '0';
    this.openPending = true;
    await this.loadImage();

    // Closed while loading: close() already restored everything
    if (currentOpenId !== this.openId) return;
    this.openPending = false;
    this.imageElement.style.opacity = '1';

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

    // Add touch listeners for swipe
    this.overlay.addEventListener('touchstart', this.handleTouchStart, { passive: true, signal });
    this.overlay.addEventListener('touchend', this.handleTouchEnd, { passive: true, signal });

    // Touchpad swipes arrive as wheel events, so they navigate too. Not passive: horizontal
    // ones are cancelled to block the browser's swipe-back gesture.
    this.overlay.addEventListener('wheel', this.handleWheel, { passive: false, signal });

    // Smooth close on scroll/wheel (like Medium - non-blocking)
    if (this.options.closeOnScroll) {
      this.overlay.addEventListener('touchmove', this.handleTouchMove, { passive: true, signal });
    }

    // The modal dialog traps the focus natively
    this.closeButton.focus();
  }

  private close(byScroll = false): void {
    if (!this.state.isOpen || this.isClosing) return;

    this.isClosing = true;
    this.state.isOpen = false;

    // Cancel a pending open() that is still waiting for the image to load,
    // and a pending navigation that would reload the image after the close
    this.openId++;
    this.navigationId++;
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
      this.imageElement.parentElement?.classList.remove('is-loading');
      this.finalizeClose(sourceImg);
      return;
    }

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
    if (this.state.currentIndex < this.state.images.length - 1) {
      this.navigateTo(this.state.currentIndex + 1);
    }
  }

  private prev(): void {
    if (this.state.currentIndex > 0) {
      this.navigateTo(this.state.currentIndex - 1);
    }
  }

  private async navigateTo(index: number): Promise<void> {
    const currentId = ++this.navigationId;

    // Only the thumbnail of the image on screen stays hidden
    this.showThumbnail(this.getThumbnail(this.state.currentIndex));
    this.hideThumbnail(this.getThumbnail(index));
    this.state.currentIndex = index;

    // Fade out the current image and wait for it (no transition, e.g. reduced motion: no wait)
    this.imageElement.style.opacity = '0';
    await Promise.allSettled(this.imageElement.getAnimations().map((animation) => animation.finished));
    if (currentId !== this.navigationId) return;

    this.updateContent(index);
    await this.loadImage();
    if (currentId !== this.navigationId) return;

    this.imageElement.style.opacity = '1';
  }

  // Resolves once the image is decoded, or failed: a broken image is shown as it is.
  // The spinner appears only if the wait is noticeable.
  private async loadImage(): Promise<void> {
    const figure = this.imageElement.parentElement;
    const spinner = window.setTimeout(() => figure?.classList.add('is-loading'), SPINNER_DELAY);

    try {
      await this.imageElement.decode();
    } catch {
      // Load error, or the source changed meanwhile: the callers check for the latter
    }

    clearTimeout(spinner);
    figure?.classList.remove('is-loading');
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

  private handleTouchEnd = (e: TouchEvent): void => {
    // Ignore if it was a multi-touch gesture or if touches still remain
    if (e.changedTouches.length > 1 || e.touches.length > 0) return;

    const deltaX = e.changedTouches[0].clientX - this.touchStartX;
    const deltaY = e.changedTouches[0].clientY - this.touchStartY;

    // Check if horizontal swipe is larger than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_DISTANCE) {
      deltaX > 0 ? this.prev() : this.next();
    }
  }

  private handleWheel = (e: WheelEvent): void => {
    const { deltaX, deltaY } = e;
    // The tail of the touchpad inertia sends tiny deltas: neither a gesture nor a scroll
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < WHEEL_NOISE) return;

    // A new gesture starts after a pause, or in the middle of the previous inertia when
    // the deltas stop decaying (a new push) or change direction
    const abs = Math.abs(deltaX);
    const isNewGesture =
      e.timeStamp - this.lastWheelTime > WHEEL_GESTURE_GAP ||
      (this.wheelAxis === 'x' &&
        (Math.sign(deltaX) !== Math.sign(this.wheelDeltaX) || abs > this.lastWheelDeltaX * 1.5 + 1));
    this.lastWheelTime = e.timeStamp;
    this.lastWheelDeltaX = abs;

    // The first event of a gesture decides its axis, so vertical jitter during a horizontal
    // swipe does not close the overlay
    if (isNewGesture) {
      this.wheelAxis = abs > Math.abs(deltaY) ? 'x' : 'y';
      this.wheelDeltaX = 0;
      this.wheelSwiped = false;
    }

    if (this.wheelAxis === 'y') {
      if (this.options.closeOnScroll) this.close(true);
      return;
    }

    // Also blocks the browser's swipe-back gesture
    e.preventDefault();

    // One navigation per gesture: the inertia tail keeps sending events
    if (this.wheelSwiped) return;
    this.wheelDeltaX += deltaX;
    if (Math.abs(this.wheelDeltaX) > SWIPE_DISTANCE) {
      this.wheelSwiped = true;
      this.wheelDeltaX > 0 ? this.next() : this.prev();
    }
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

  private updateContent(index: number): void {
    const { src, alt, caption } = this.state.images[index];

    // Update image
    this.imageElement.src = src;
    this.imageElement.alt = alt;

    // Update caption
    this.captionElement.textContent = caption || '';

    this.updateNavigationButtons();
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
    const originalParent = this.imageElement.parentElement;
    const originalNextSibling = this.imageElement.nextSibling;

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
      // Cancel animation to remove fill: forwards effects
      animation.cancel();

      // Restore to original parent
      if (originalParent) {
        if (originalNextSibling) {
          originalParent.insertBefore(this.imageElement, originalNextSibling);
        } else {
          originalParent.appendChild(this.imageElement);
        }
      }

      this.finalizeClose(sourceImg);
    };
  }

  private resetImageStyles(): void {
    Object.assign(this.imageElement.style, {
      transform: '', animation: '', opacity: '', zIndex: '',
      position: '', top: '', left: '', width: '', height: '', margin: ''
    });
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
    // Hide overlay image and restore thumbnail instantly - same frame
    this.imageElement.style.opacity = '0';
    this.showThumbnail(sourceImg);

    this.overlay.close();
    this.overlay.classList.remove('is-closing');
    document.body.style.overflow = '';

    this.resetImageStyles();
    this.imageElement.src = '';
    this.imageElement.alt = '';

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
