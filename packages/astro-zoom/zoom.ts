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

    // Use global overlay
    const overlay = document.getElementById('astro-zoom-global-overlay') as HTMLDialogElement;

    if (!overlay) {
      console.error('Zoom global overlay not found');
      return;
    }

    this.overlay = overlay;
    this.backdrop = this.overlay.querySelector('.astro-zoom-backdrop')!;
    this.imageElement = this.overlay.querySelector('.astro-zoom-image')!;
    this.captionElement = this.overlay.querySelector('.astro-zoom-caption')!;
    this.closeButton = this.overlay.querySelector('.astro-zoom-close')!;
    this.prevButton = this.overlay.querySelector('.astro-zoom-prev');
    this.nextButton = this.overlay.querySelector('.astro-zoom-next');

    this.collectImages();
    this.setupEventListeners();
  }

  private collectImages(): void {
    const links = this.wrapper.querySelectorAll<HTMLAnchorElement>(
      'a[data-zoom-generated], a[data-zoom], a:has(img):not(.astro-zoom-overlay *)'
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
      image.element.addEventListener('click', (e) => {
        e.preventDefault();
        this.open(index);
      });
    });

    // Close button
    this.closeButton.addEventListener('click', () => this.close());

    // Navigation buttons
    if (this.prevButton && this.nextButton && this.options.showNavigation) {
      this.prevButton.addEventListener('click', () => this.prev());
      this.nextButton.addEventListener('click', () => this.next());
    }

    // Backdrop click
    if (this.options.closeOnBackdrop) {
      this.backdrop.addEventListener('click', () => this.close());
    }

    // Click on image closes (like Medium)
    if (this.options.closeOnImage) {
      this.imageElement.addEventListener('click', () => this.close());
    }
  }

  private async open(index: number): Promise<void> {
    if (this.state.isOpen) return;

    // Store current focused element
    this.state.previousFocus = document.activeElement as HTMLElement;

    // Update state
    this.state.isOpen = true;
    this.state.currentIndex = index;

    // Apply theme configuration for this instance
    this.applyTheme();

    // Apply animation duration
    this.overlay.style.setProperty('--zoom-animation-duration', `${this.options.animationDuration}ms`);

    // Get source image and position
    const sourceImg = this.state.images[index].element.querySelector('img')!;
    const sourceRect = sourceImg.getBoundingClientRect();

    // Update content (image, caption, nav buttons)
    this.updateContent(index);

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
      });

      // Remove loading state and show image
      this.imageElement.parentElement?.classList.remove('is-loading');
      this.imageElement.style.opacity = '1';
    }

    // FLIP Animation
    const finalRect = this.imageElement.getBoundingClientRect();
    const transform = this.calculateFlipTransform(sourceRect, finalRect);

    // Set CSS variables for animation
    this.imageElement.style.setProperty('--tx-from', `${transform.x}px`);
    this.imageElement.style.setProperty('--ty-from', `${transform.y}px`);
    this.imageElement.style.setProperty('--scale-from', transform.scale.toString());
    this.imageElement.style.setProperty('--clip-from', transform.clipPath);
    this.imageElement.style.setProperty('--clip-to', 'inset(0px)');

    // Trigger CSS animation
    this.overlay.classList.add('is-opening');

    // After animation completes, switch to is-open state
    setTimeout(() => {
      this.overlay.classList.remove('is-opening');
      this.overlay.classList.add('is-open');
    }, this.options.animationDuration);

    // Add keyboard listener
    if (this.options.keyboardNavigation) {
      document.addEventListener('keydown', this.handleKeydown);
    }

    // Add touch listeners for swipe
    this.overlay.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.overlay.addEventListener('touchend', this.handleTouchEnd, { passive: true });

    // Handle native dialog cancel (Escape key)
    this.overlay.addEventListener('cancel', this.handleCancel);

    // Smooth close on scroll/wheel (like Medium - non-blocking)
    if (this.options.closeOnScroll) {
      this.overlay.addEventListener('wheel', this.handleWheel, { passive: true });
      this.overlay.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    }

    // Focus management
    this.setupFocusTrap();
    this.closeButton.focus();
  }

  private close(): void {
    if (!this.state.isOpen || this.isClosing) return;

    this.isClosing = true;
    this.state.isOpen = false;

    this.overlay.classList.remove('is-open');
    this.overlay.classList.add('is-closing');

    // Get source image and its rect BEFORE any DOM changes
    const sourceElement = this.state.images[this.state.currentIndex].element;
    const sourceImg = sourceElement.querySelector('img')!;
    const startRect = this.imageElement.getBoundingClientRect();
    const targetRect = sourceImg.getBoundingClientRect();

    // Calculate transform for closing animation
    const transform = this.calculateFlipTransform(targetRect, startRect);

    // Set CSS variables for closing animation
    this.imageElement.style.setProperty('--tx-from', `${transform.x}px`);
    this.imageElement.style.setProperty('--ty-from', `${transform.y}px`);
    this.imageElement.style.setProperty('--scale-from', transform.scale.toString());
    this.imageElement.style.setProperty('--clip-from', transform.clipPath);
    this.imageElement.style.setProperty('--clip-to', 'inset(0px)');

    // If closed by scroll, unlock scroll immediately and use special animation
    if (this.closedByScroll) {
      document.body.style.overflow = '';
      this.closedByScroll = false;
      this.animateScrollClose(startRect, targetRect);
    }

    // Cleanup after animation completes
    setTimeout(() => {
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
    }, this.options.animationDuration);

    // Remove listeners
    document.removeEventListener('keydown', this.handleKeydown);
    this.overlay.removeEventListener('touchstart', this.handleTouchStart);
    this.overlay.removeEventListener('touchend', this.handleTouchEnd);
    this.overlay.removeEventListener('cancel', this.handleCancel);
    if (this.options.closeOnScroll) {
      this.overlay.removeEventListener('wheel', this.handleWheel);
      this.overlay.removeEventListener('touchmove', this.handleTouchMove);
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
    this.state.touchStartX = e.touches[0].clientX;
    this.state.touchStartY = e.touches[0].clientY;
  }

  private handleTouchEnd = (e: TouchEvent): void => {
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
    // Remove event listeners from images
    this.state.images.forEach((image) => {
      const clonedElement = image.element.cloneNode(true);
      image.element.parentNode?.replaceChild(clonedElement, image.element);
    });

    // Close if open
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

  private animateScrollClose(startRect: DOMRect, targetRect: DOMRect): void {
    // Reparenting strategy:
    // 1. Move the EXISTING image to the body (no cloning = no flicker)
    // 2. Position it absolutely so it scrolls with the page
    // 3. Animate it to the thumbnail position
    // 4. Move it back to the overlay when done

    const originalParent = this.imageElement.parentElement;
    const originalNextSibling = this.imageElement.nextSibling;

    // Set initial position (absolute relative to document)
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;

    // Apply styles to the existing element
    this.imageElement.style.position = 'absolute';
    this.imageElement.style.top = `${startRect.top + scrollTop}px`;
    this.imageElement.style.left = `${startRect.left + scrollLeft}px`;
    this.imageElement.style.width = `${startRect.width}px`;
    this.imageElement.style.height = `${startRect.height}px`;
    this.imageElement.style.transform = 'none';
    this.imageElement.style.animation = 'none';
    this.imageElement.style.margin = '0';
    this.imageElement.style.zIndex = '9999999'; // Ensure it's on top of everything

    // Move to body
    document.body.appendChild(this.imageElement);

    // Calculate target position (absolute relative to document)
    const targetTop = targetRect.top + scrollTop;
    const targetLeft = targetRect.left + scrollLeft;
    const targetWidth = targetRect.width;
    const targetHeight = targetRect.height;

    // Animate using WAAPI
    const animation = this.imageElement.animate([
      {
        top: `${startRect.top + scrollTop}px`,
        left: `${startRect.left + scrollLeft}px`,
        width: `${startRect.width}px`,
        height: `${startRect.height}px`
      },
      {
        top: `${targetTop}px`,
        left: `${targetLeft}px`,
        width: `${targetWidth}px`,
        height: `${targetHeight}px`
      }
    ], {
      duration: this.options.animationDuration * 0.75,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    });

    animation.onfinish = () => {
      // Hide it until full reset to prevent jump
      this.imageElement.style.opacity = '0';

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
    };
  }

  private resetImageStyles(): void {
    Object.assign(this.imageElement.style, {
      transform: '', animation: '', opacity: '', zIndex: '',
      position: '', top: '', left: '', width: '', height: '', margin: ''
    });
  }
}

// Export initialization function
export function initZoom(wrapper: HTMLElement): Zoom {
  return new Zoom(wrapper);
}

// Export class for advanced usage
export { Zoom };
