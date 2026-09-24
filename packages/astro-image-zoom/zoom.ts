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
  previousFocus: HTMLElement | null;
  touchStartX: number;
  touchStartY: number;
}

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
    images: [],
    previousFocus: null,
    touchStartX: 0,
    touchStartY: 0
  };

  private options = {
    keyboardNavigation: true,
    closeOnBackdrop: true,
    closeOnImage: true,
    closeOnScroll: true,
    showNavigation: true,
    animationDuration: 300,
    theme: {}
  };

  private focusableElements: HTMLElement[] = [];
  private isClosing = false;
  private closedByScroll = false;
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
    if (duration) {
      this.options.animationDuration = parseInt(duration, 10);
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

    this.collectImages();
    this.setupEventListeners();
  }

  private collectImages(): void {
    const links = this.wrapper.querySelectorAll<HTMLAnchorElement>(
      'a[data-zoom-generated], a[data-zoom], a:has(img):not(.astro-image-zoom-overlay *)'
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
    // Click listeners for links containing images
    // Links already handle keyboard navigation natively (Enter key)
    this.state.images.forEach((image, index) => {
      image.element.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          this.open(index);
        },
        { signal: this.controller.signal }
      );
    });
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
    this.state.previousFocus = document.activeElement as HTMLElement;

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

    // Check if image is already loaded (cached)
    if (this.imageElement.complete && this.imageElement.naturalWidth > 0) {
      // Image is ready, show immediately
      this.imageElement.style.opacity = '1';
    } else {
      // Image needs loading, show spinner
      this.imageElement.parentElement?.classList.add('is-loading');

      await new Promise<void>((resolve) => {
        this.imageElement.onload = () => resolve();
        this.imageElement.onerror = () => resolve();
      });

      // Closed while loading: close() already restored everything
      if (currentOpenId !== this.openId) return;

      // Remove loading state and show image
      this.imageElement.parentElement?.classList.remove('is-loading');
      this.imageElement.style.opacity = '1';
    }

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

    // Smooth close on scroll/wheel (like Medium - non-blocking)
    if (this.options.closeOnScroll) {
      this.overlay.addEventListener('wheel', this.handleWheel, { passive: true, signal });
      this.overlay.addEventListener('touchmove', this.handleTouchMove, { passive: true, signal });
    }

    // Focus management
    this.setupFocusTrap();
    this.closeButton.focus();
  }

  private close(): void {
    if (!this.state.isOpen || this.isClosing) return;

    this.isClosing = true;
    this.state.isOpen = false;

    // Cancel a pending open() that is still waiting for the image to load
    this.openId++;
    const isLoading = this.imageElement.parentElement?.classList.contains('is-loading') ?? false;

    // Release the shared overlay: no listener of this instance survives the close
    this.openController?.abort();
    this.openController = null;

    // Get source image BEFORE any DOM changes
    const sourceElement = this.state.images[this.state.currentIndex].element;
    const sourceImg = sourceElement.querySelector('img')!;

    // Closed while loading: the opening animation never ran, so close without animating
    if (isLoading) {
      this.imageElement.parentElement?.classList.remove('is-loading');
      this.closedByScroll = false;
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
    if (this.closedByScroll) {
      document.body.style.overflow = '';
      this.closedByScroll = false;
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

    // Fade out current image
    this.imageElement.style.opacity = '0';

    // Wait for fade out to complete
    await this.waitForTransition(this.imageElement);

    // Check if navigation was superseded
    if (currentId !== this.navigationId) return;

    const img = this.imageElement;
    let resolveImageLoad: () => void;

    // Create a promise that resolves when image loads
    // We create this BEFORE setting src to ensure we don't miss events
    const imageLoadPromise = new Promise<void>((resolve) => {
      resolveImageLoad = resolve;
    });

    // Setup handlers
    const handleLoad = () => {
      if (resolveImageLoad) resolveImageLoad();
    };

    img.onload = handleLoad;
    img.onerror = handleLoad;

    // Now set the src
    this.updateContent(index);

    // Check if already complete (e.g. cached)
    if (img.complete && img.naturalWidth > 0) {
      handleLoad();
    }

    // Race between image load and a small delay for the spinner
    // If image loads within 50ms, we don't show spinner at all
    let showSpinner = true;

    const spinnerDelayPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        // Only show spinner if this is still the active navigation
        if (showSpinner && currentId === this.navigationId) {
          img.parentElement?.classList.add('is-loading');
        }
        resolve();
      }, 200);
    });

    // Wait for image to load
    await Promise.race([
      imageLoadPromise.then(() => {
        showSpinner = false; // Image loaded fast, cancel spinner
      }),
      spinnerDelayPromise // Wait for spinner delay if needed
    ]);

    // Check if navigation was superseded
    if (currentId !== this.navigationId) return;

    // If spinner was shown, we need to wait for image load to finish if it hasn't already
    if (showSpinner) {
      await imageLoadPromise;
      if (currentId === this.navigationId) {
        img.parentElement?.classList.remove('is-loading');
      }
    }

    // Show image
    if (currentId === this.navigationId) {
      img.style.opacity = '1';
    }
  }

  private waitForTransition(element: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const duration = parseFloat(getComputedStyle(element).transitionDuration) * 1000;

      // If no transition or very short, resolve immediately
      if (!duration || duration < 10) {
        resolve();
        return;
      }

      let resolved = false;

      const onTransitionEnd = (e: TransitionEvent) => {
        if (e.target === element && e.propertyName === 'opacity') {
          if (!resolved) {
            resolved = true;
            element.removeEventListener('transitionend', onTransitionEnd);
            resolve();
          }
        }
      };

      element.addEventListener('transitionend', onTransitionEnd);

      // Safety fallback: resolve after duration + buffer if event doesn't fire
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          element.removeEventListener('transitionend', onTransitionEnd);
          resolve();
        }
      }, duration + 50);
    });
  }

  private updateNavigationButtons(): void {
    if (!this.prevButton || !this.nextButton) return;

    const shouldShowNav = this.options.showNavigation && this.state.images.length > 1;

    // Toggle visibility class
    this.overlay.classList.toggle('nav-hidden', !shouldShowNav);

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
    this.prevButton.classList.toggle('disabled', isFirst);
    this.prevButton.setAttribute('aria-disabled', String(isFirst));

    // Update next button state
    const isLast = this.state.currentIndex === this.state.images.length - 1;
    this.nextButton.classList.toggle('disabled', isLast);
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
      case 'Tab':
        this.handleTabKey(e);
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

    this.state.touchStartX = e.touches[0].clientX;
    this.state.touchStartY = e.touches[0].clientY;
  }

  private handleTouchEnd = (e: TouchEvent): void => {
    // Ignore if it was a multi-touch gesture or if touches still remain
    if (e.changedTouches.length > 1 || e.touches.length > 0) return;

    const deltaX = e.changedTouches[0].clientX - this.state.touchStartX;
    const deltaY = e.changedTouches[0].clientY - this.state.touchStartY;

    // Check if horizontal swipe is larger than vertical (min 50px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      deltaX > 0 ? this.prev() : this.next();
    }
  }

  private handleWheel = (): void => {
    if (!this.isClosing) {
      this.closedByScroll = true;
      this.close();
    }
  }

  private handleTouchMove = (e: TouchEvent): void => {
    // Ignore multi-touch (pinch to zoom)
    if (e.touches.length > 1) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - this.state.touchStartX);
    const deltaY = Math.abs(touch.clientY - this.state.touchStartY);

    // Only trigger close on vertical scroll (not horizontal swipes)
    if (deltaY > deltaX && deltaY > 10 && !this.isClosing) {
      this.closedByScroll = true;
      this.close();
    }
  }

  private setupFocusTrap(): void {
    // Get all focusable elements within the overlay
    this.focusableElements = Array.from(
      this.overlay.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
  }

  private handleTabKey(e: KeyboardEvent): void {
    if (this.focusableElements.length === 0) return;

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  private updateContent(index: number): void {
    const { src, alt, caption } = this.state.images[index];

    // Update image
    this.imageElement.src = src;
    this.imageElement.srcset = '';
    this.imageElement.sizes = '';
    this.imageElement.loading = 'eager';
    this.imageElement.alt = alt;

    // Update caption
    this.captionElement.textContent = caption || '';
    this.captionElement.style.display = caption ? 'block' : 'none';

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
    const theme = this.options.theme as any;

    const themeMap: Record<string, string[]> = {
      backgroundColor: ['--zoom-bg'],
      closeButtonColor: ['--zoom-close-color'],
      navigationColor: ['--zoom-nav-color']
    };

    Object.entries(themeMap).forEach(([key, vars]) => {
      const value = theme[key];
      vars.forEach(cssVar => {
        if (value) {
          this.overlay.style.setProperty(cssVar, value);
        } else {
          this.overlay.style.removeProperty(cssVar);
        }
      });
    });
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
    if (this.state.previousFocus) {
      this.state.previousFocus.focus({ preventScroll: true });
      this.state.previousFocus = null;
    }

    this.isClosing = false;
  }
}

// Export initialization function
export function initZoom(wrapper: HTMLElement): Zoom {
  return new Zoom(wrapper);
}

// Export class for advanced usage
export { Zoom };
