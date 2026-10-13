import overlayStyles from "./overlay.css?inline";
import { DEFAULT_LABELS, type ImageZoomLabels } from "./labels";

// The size of a full-size file, from data-image-zoom-width and data-image-zoom-height
interface ZoomDimensions {
  width: number;
  height: number;
}

interface ZoomImage {
  src: string;
  alt: string;
  caption?: string;
  element: HTMLElement;
  dimensions?: ZoomDimensions | undefined;
}

interface ZoomState {
  currentIndex: number;
  images: ZoomImage[];
}

/**
 * The detail of the events an <astro-image-zoom> dispatches: astro-image-zoom:open when a zoom
 * opens, astro-image-zoom:change when the gallery moves to another image, astro-image-zoom:close
 * when it starts to close and astro-image-zoom:closed once the image is back on the page. They
 * bubble, so one listener on the document hears every gallery.
 */
export interface ZoomEventDetail {
  /** Position of the image in its gallery, from 0 */
  index: number;
  /** Number of images in the gallery */
  total: number;
  /** URL of the image the zoom shows: data-image-zoom-src, or the src of the image */
  src: string;
  alt: string;
  caption: string;
  /** The link on the page that opens this image */
  link: HTMLElement;
}

type ZoomEvents = {
  "astro-image-zoom:open": CustomEvent<ZoomEventDetail>;
  "astro-image-zoom:change": CustomEvent<ZoomEventDetail>;
  "astro-image-zoom:close": CustomEvent<ZoomEventDetail>;
  "astro-image-zoom:closed": CustomEvent<ZoomEventDetail>;
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
  // URL of the full-size image
  src: string;
  // Resolves when the image can be shown: see loadSlide()
  ready?: Promise<void>;
  // Whether the full-size file has decoded, so the placeholder can go
  decoded?: boolean;
  // Resolves when the full-size file has decoded, or failed
  loaded?: Promise<void>;
  // The size of the file, when the page said it: the image opens with its final shape
  dimensions?: ZoomDimensions | undefined;
  // Laid out at the size in `dimensions`, as the slide lets it: see fitKnown()
  fixedSize?: boolean;
  // Laid out with the shape of its thumbnail, until the size of the file is known: see loadSlide()
  provisional?: boolean;
  // Whether the size of the file is known
  sized?: boolean;
}

// Resolves once the browser knows the size of the image, from its first bytes, long before a large
// file has loaded; or when the load ends, also in error. There is no event for it, so the frames poll
function sizeKnown(
  img: HTMLImageElement,
  decoded: Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    void decoded.then(() => {
      settled = true;
      resolve();
    });
    const check = () => {
      if (settled) return;
      if (img.naturalWidth > 0) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

// The custom properties of the overlay. When it opens, it takes the values set around the
// <astro-image-zoom> that opened it, so each gallery can have its own
const ZOOM_VARIABLES = [
  "--zoom-bg",
  "--zoom-close-color",
  "--zoom-close-bg",
  "--zoom-nav-color",
  "--zoom-nav-bg",
  "--zoom-caption-color",
  "--zoom-caption-bg",
  "--zoom-controls-offset",
  "--zoom-caption-max-width",
  "--zoom-caption-font",
  "--zoom-caption-font-size",
  "--zoom-caption-radius",
  "--zoom-padding",
  "--zoom-image-radius",
  "--zoom-button-size",
  "--zoom-button-radius",
  "--zoom-animation-duration",
  "--zoom-slide-duration",
  "--zoom-slide-easing",
  "--zoom-color-scheme",
];

// The options of a gallery, from the data-image-zoom-* attributes of its wrapper
interface ZoomOptions {
  closeOnBackdrop: boolean;
  closeOnImage: boolean;
  closeOnScroll: boolean;
  showNavigation: boolean;
  showCaption: boolean;
  showCounter: boolean;
  captionPosition: "bottom" | "top";
  navigationLayout: "bar" | "sides";
}

// The first value is the default, also for a value it does not know
function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly [T, ...T[]],
): T {
  return allowed.find((option) => option === value) ?? allowed[0];
}

// Read on each opening, so a page can change them after load. A flag is on unless it says "false"
function readOptions(dataset: DOMStringMap): ZoomOptions {
  const flag = (value: string | undefined): boolean => value !== "false";
  return {
    closeOnBackdrop: flag(dataset.imageZoomCloseBackdrop),
    closeOnImage: flag(dataset.imageZoomCloseImage),
    closeOnScroll: flag(dataset.imageZoomCloseScroll),
    showNavigation: flag(dataset.imageZoomShowNav),
    showCaption: flag(dataset.imageZoomShowCaption),
    showCounter: flag(dataset.imageZoomShowCounter),
    captionPosition: oneOf(dataset.imageZoomCaptionPosition, ["bottom", "top"]),
    navigationLayout: oneOf(dataset.imageZoomNavigationLayout, [
      "bar",
      "sides",
    ]),
  };
}

// The CSS animations of the overlay that open() and close() wait for
// The clip-path of the image animates apart from its transform, and only when there is something
// to clip (isFlatClip()): a transform alone can run on the compositor, off the main thread
const OPEN_ANIMATIONS = [
  "astro-image-zoom-in",
  "astro-image-zoom-clip-in",
  "astro-image-zoom-backdrop-in",
];
const CLOSE_ANIMATIONS = [
  "astro-image-zoom-out",
  "astro-image-zoom-clip-out",
  "astro-image-zoom-backdrop-out",
];

// Whether the user has zoomed the page in with a pinch (the visual viewport is scaled up)
const isPageZoomed = (): boolean => (window.visualViewport?.scale ?? 1) > 1.01;

// How long (ms) a requested slide counts as the target while the smooth scroll runs
const SCROLL_TARGET_TTL = 500;
// Vertical wheel deltas below this many pixels do not close the overlay
const WHEEL_CLOSE_DELTA = 4;
// Pixels in a line, for the wheels that scroll by lines (deltaMode 1)
const WHEEL_LINE_HEIGHT = 16;
// After a horizontal wheel event (ms), vertical jitter of the same touchpad swipe is ignored
const WHEEL_HORIZONTAL_GRACE = 250;

// The vertical delta of a wheel in pixels, whether it scrolls by pixels, lines or pages. deltaY is
// read before deltaMode: Firefox reports lines to the pages that read deltaMode first
function wheelPixels(e: WheelEvent): number {
  const { deltaY } = e;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE)
    return deltaY * WHEEL_LINE_HEIGHT;
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE)
    return deltaY * window.innerHeight;
  return deltaY;
}

const OVERLAY_ID = "astro-image-zoom-global-overlay";

// The caption and the navigation bar live inside the track, after the slides: fixed, so they do not
// scroll with it, and a scrollable region with focusable controls needs no Tab stop of its own
// (WCAG 2.1.1). tabindex="-1" keeps the track itself out of the tab order: Firefox makes any
// scroller focusable, even with controls inside, and that stop did nothing. The dialog has
// tabindex="-1" too: Safari makes it a Tab stop of its own, with nothing visible focused.
const OVERLAY_HTML = `
<dialog class="astro-image-zoom-overlay" part="overlay" tabindex="-1" data-label="overlay">
  <div class="astro-image-zoom-backdrop" part="backdrop" aria-hidden="true"></div>
  <div class="astro-image-zoom-content" role="document">
    <button class="astro-image-zoom-close" part="close" data-label="close" type="button">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    </button>
    <div class="astro-image-zoom-track" part="track" tabindex="-1" role="group" data-label="images">
      <div class="astro-image-zoom-bottom">
        <p class="astro-image-zoom-caption" part="caption" aria-live="polite"></p>
        <div class="astro-image-zoom-toolbar" part="toolbar">
          <button class="astro-image-zoom-nav astro-image-zoom-prev" part="nav prev" data-label="previous" type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <span class="astro-image-zoom-counter" part="counter"></span>
          <button class="astro-image-zoom-nav astro-image-zoom-next" part="nav next" data-label="next" type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</dialog>`;

// Whether a click came from the keyboard (Enter or Space): it has no pointer. Not by its click count
// alone: Firefox gives Enter on a link a count of 1, like a mouse click
function fromKeyboard(e: MouseEvent): boolean {
  return e.detail === 0 || (e as PointerEvent).pointerType === "";
}

// Whether the element sits in a sticky or fixed box, which does not scroll away with the page
function staysOnScreen(element: Element): boolean {
  for (let box = element.parentElement; box; box = box.parentElement) {
    const { position } = getComputedStyle(box);
    if (position === "sticky" || position === "fixed") return true;
  }
  return false;
}

// Resolves when the named CSS animations of the element or its descendants end or are cancelled,
// and at once when none runs. The durations live in CSS only: with reduced motion they are 0s.
function animationsFinished(
  element: Element,
  names: string[],
): Promise<unknown> {
  const animations = element
    .getAnimations({ subtree: true })
    .filter(
      (animation) =>
        animation instanceof CSSAnimation &&
        names.includes(animation.animationName),
    );
  return Promise.allSettled(animations.map(({ finished }) => finished));
}

/**
 * Returns the overlay shared by every zoom instance, creating it on first use.
 * Built on the client so the page HTML never repeats its id, however many
 * <ImageZoom> components it has; without JavaScript the links simply open the image.
 */
function getOverlay(): HTMLDialogElement {
  const existing = document
    .getElementById(OVERLAY_ID)
    ?.shadowRoot?.querySelector("dialog");
  if (existing) return existing;

  // The dialog lives in the shadow root of a host element: the CSS of the page cannot reach it
  const host = document.createElement("astro-image-zoom-overlay");
  host.id = OVERLAY_ID;
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = overlayStyles;
  const template = document.createElement("template");
  template.innerHTML = OVERLAY_HTML.trim();
  root.append(style, template.content);
  document.body.append(host);
  return root.querySelector("dialog")!;
}

// An element of the overlay, which OVERLAY_HTML always has
function overlayPart<T extends HTMLElement>(
  overlay: HTMLDialogElement,
  name: string,
): T {
  const element = overlay.querySelector<T>(`.astro-image-zoom-${name}`);
  if (!element) throw new Error(`astro-image-zoom: no ${name} in the overlay`);
  return element;
}

// A box on the screen, such as the one getBoundingClientRect() returns
type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;

// How a thumbnail draws its file inside its box: the computed object-fit and object-position of the
// <img>, and the size of the file. `corners`: its computed corner radii, top-left first, clockwise
export interface ThumbnailFit {
  objectFit: string;
  objectPosition: string;
  naturalWidth: number;
  naturalHeight: number;
  corners?: string[];
}

interface FlipTransform {
  x: number;
  y: number;
  scale: number;
  clipPath: string;
}

function thumbnailFit(img: HTMLImageElement): ThumbnailFit {
  const style = getComputedStyle(img);
  return {
    objectFit: style.objectFit,
    objectPosition: style.objectPosition,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    corners: [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ],
  };
}

// The round part of an inset() with the corners of a thumbnail, in the image's own pixels: each
// computed radius is one length, or a horizontal and a vertical one, in px or % of the box. Empty
// when the corners are square
function roundCorners(
  corners: string[] | undefined,
  source: Box,
  scale: number,
): string {
  const length = (value: string | undefined, size: number) => {
    const number = Number.parseFloat(value ?? "");
    if (!Number.isFinite(number)) return 0;
    return (value?.endsWith("%") ? (size * number) / 100 : number) / scale;
  };
  const radii = (corners ?? []).map((radius) => {
    const [x, y = x] = radius.split(" ");
    return [length(x, source.width), length(y, source.height)];
  });
  if (radii.length !== 4 || radii.every(([x, y]) => !x && !y)) return "";
  const xs = radii.map(([x]) => `${x}px`).join(" ");
  const ys = radii.map(([, y]) => `${y}px`).join(" ");
  return ` round ${xs} / ${ys}`;
}

// Where object-position puts the drawn file along one axis, given the free space of the box
// (negative when the file overflows it). Browsers compute it as a percentage of that space, a
// length in px, or calc() of both: "right 10px" is calc(100% - 10px). Anything else, or nothing,
// centers the file, the default
function positionOffset(value: string | undefined, free: number): number {
  const percent = /(-?[\d.]+)%/.exec(value ?? "");
  const pixels = /([+-]?)\s*(-?[\d.]+)px/.exec(value ?? "");
  if (!percent && !pixels) return free / 2;

  const offset =
    (percent ? (free * Number(percent[1])) / 100 : 0) +
    (pixels ? Number(pixels[2]) * (pixels[1] === "-" ? -1 : 1) : 0);
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
    "scale-down": Math.min(1, widthRatio, heightRatio),
  };
  const scale = scales[fit.objectFit];
  if (scale === undefined) return source;

  const width = fit.naturalWidth * scale;
  const height = fit.naturalHeight * scale;
  // One value per axis; a calc() has spaces of its own
  const [positionX, positionY] =
    fit.objectPosition.match(/calc\([^)]*\)|\S+/g) ?? [];
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
 * image's own, unscaled pixels) that trims what the thumbnail does not show, and rounds its corners
 * like the thumbnail's.
 *
 * `fit` tells how the thumbnail draws its file (object-fit, object-position). That file may also be
 * cropped from the full image already, as Astro's <Image> does with a width and a height of another
 * shape: it is taken as a centered crop, so the scale matches what the thumbnail really shows.
 * Without `fit`, the image covers the source box, as object-fit: cover does.
 */
export function flipTransform(
  source: Box,
  final: Box,
  fit?: ThumbnailFit,
): FlipTransform {
  const drawn = drawnBox(source, fit);

  // The whole image around the drawn file, at the same scale, taking the file as a centered crop
  const imageRatio = final.width / final.height;
  const drawnRatio = drawn.width / drawn.height;
  const width =
    imageRatio > drawnRatio ? drawn.height * imageRatio : drawn.width;
  const height = width / imageRatio;
  const left = drawn.left + (drawn.width - width) / 2;
  const top = drawn.top + (drawn.height - height) / 2;
  const scale = width / final.width;

  const x = left + width / 2 - (final.left + final.width / 2);
  const y = top + height / 2 - (final.top + final.height / 2);

  // Only what the thumbnail shows stays visible: the drawn file, cut to the box of the thumbnail
  const visibleLeft = Math.max(drawn.left, source.left);
  const visibleTop = Math.max(drawn.top, source.top);
  const visibleRight = Math.min(
    drawn.left + drawn.width,
    source.left + source.width,
  );
  const visibleBottom = Math.min(
    drawn.top + drawn.height,
    source.top + source.height,
  );
  const insetTop = (visibleTop - top) / scale;
  const insetRight = (left + width - visibleRight) / scale;
  const insetBottom = (top + height - visibleBottom) / scale;
  const insetLeft = (visibleLeft - left) / scale;
  // Rounded like the corners of the thumbnail, so the image takes its shape back as it lands
  const round = roundCorners(fit?.corners, source, scale);
  const clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px${round})`;

  return { x, y, scale, clipPath };
}

// Whether the file of a thumbnail can paint at once somewhere else, as the background of the zoomed
// image: the browser keeps it in memory. Not with the cache disabled (DevTools), where it would load
// again and leave the image empty meanwhile
function paintsAtOnce(
  thumbnail: HTMLImageElement | null,
): thumbnail is HTMLImageElement {
  if (!thumbnail?.complete || !thumbnail.naturalWidth) return false;
  const probe = new Image();
  probe.src = thumbnail.currentSrc;
  return probe.complete;
}

// Crops the image at once, or uncrops it (null): the transition is for the unfolding, and would
// clip it in or out, a blink when the slide is on screen
function setCrop(img: HTMLImageElement, inset: string | null): void {
  withoutTransition(img, () => {
    if (inset) img.style.setProperty("--astro-image-zoom-crop", inset);
    else img.style.removeProperty("--astro-image-zoom-crop");
  });
}

// Applies a change of style at once, without its transition
function withoutTransition(element: HTMLElement, change: () => void): void {
  element.style.transition = "none";
  change();
  void element.offsetWidth;
  element.style.transition = "";
}

// How long the opening waits for the size of the full-size file before it shows the thumbnail in
// its place (whenShowable()). Its first bytes often arrive by then, and the image opens with its
// real shape. Under the 200ms after which the spinner shows (overlay.css)
const SIZE_WAIT = 150;

// How long the opening waits for the bytes of the file (LOAD_GRACE), and for them and its decoding
// together (DECODE_GRACE), before the thumbnail stands in for it (whenShowable()): the first is all a
// file on a slow network costs
const LOAD_GRACE = 30;
const DECODE_GRACE = 60;

// How much smaller than the slide lets it the thumbnail stands in for the image (fitProvisional()):
// the full-size file may show more of the picture than its thumbnail (a crop), so the image is
// bigger than the thumbnail on screen. Up to this many times wider or taller than the thumbnail, the
// part the thumbnail shows only grows when the image takes its shape, never shrinks
const PROVISIONAL_SCALE = 1.25;

/**
 * Where the thumbnail, already loaded, stands in for the full-size image until it decodes, in % of
 * the image: `size` for its background-size, and `inset` for the insets of a clip-path that hides
 * the rest of the image, which has nothing to show yet (overlay.css rounds it). All of it for a file
 * of the whole picture, the middle for a file cropped from it, taken as a centered crop like
 * flipTransform() does, however little of the picture it shows. Null when a file has no size yet.
 */
export function placeholderBox(
  thumbnail: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight">,
  image: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight">,
): { size: string; inset: string } | null {
  if (
    !thumbnail.naturalWidth ||
    !thumbnail.naturalHeight ||
    !image.naturalWidth ||
    !image.naturalHeight
  )
    return null;

  // How much wider the thumbnail is than the image, in shape
  const ratio =
    thumbnail.naturalWidth /
    thumbnail.naturalHeight /
    (image.naturalWidth / image.naturalHeight);
  if (Math.abs(ratio - 1) <= 0.02) return { size: "100% 100%", inset: "0%" };

  // A wider crop keeps the whole width and loses height, a narrower one the other way around
  const [width, height] = ratio > 1 ? [1, 1 / ratio] : [ratio, 1];
  const percent = (part: number) => `${Number((part * 100).toFixed(4))}%`;
  const insetY = percent((1 - height) / 2);
  const insetX = percent((1 - width) / 2);
  return {
    size: `${percent(width)} ${percent(height)}`,
    inset: `${insetY} ${insetX} ${insetY} ${insetX}`,
  };
}

/**
 * How wide an image shows in `room`, with the shape and size of its `dimensions`: as the room lets
 * it, and no bigger than its file.
 */
export function fitWidth(
  dimensions: ZoomDimensions,
  room: { width: number; height: number },
): number {
  const scale = Math.min(
    1,
    room.width / dimensions.width,
    room.height / dimensions.height,
  );
  return dimensions.width * scale;
}

/**
 * Whether a clip-path, as the browser serializes it, clips nothing: every length in it (the insets
 * and the corner radii) is under half a pixel or a percent. The zoom animation then leaves
 * clip-path out, and runs as a transform alone.
 */
export function isFlatClip(clipPath: string): boolean {
  if (clipPath === "none") return true;
  const numbers = clipPath.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  return numbers.every((number) => Math.abs(Number(number)) < 0.5);
}

// How many files asked for ahead of a click are kept (a hover is rarely followed by another)
const PRELOAD_LIMIT = 3;
// How long (ms) a pointer or the focus stays on a link before its file is asked for: less than
// that is passing by, and Astro's prefetch has had its turn by then
const PRELOAD_WAIT = 200;

class Zoom {
  private wrapper: HTMLElement;
  // The element that holds the overlay's shadow root, and its --zoom-* variables
  private host: HTMLElement;
  private overlay: HTMLDialogElement;
  private backdrop: HTMLElement;
  private track: HTMLElement;
  private captionElement: HTMLElement;
  private closeButton: HTMLButtonElement;
  private toolbar: HTMLElement;
  private counter: HTMLElement;
  private prevButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private slides: ZoomSlide[] = [];

  private state: ZoomState = {
    currentIndex: 0,
    images: [],
  };

  // Set by open(), for that opening
  private options!: ZoomOptions;

  // closed, then loading while the full-size image loads, opening during the opening animation,
  // open, and closing until finalizeClose()
  private phase: "closed" | "loading" | "opening" | "open" | "closing" =
    "closed";
  // The inline styles of <html> that lockScroll() changed, to restore them; null while unlocked
  private lockedStyles: Record<
    "overflow-x" | "overflow-y" | "padding-right",
    [string, string]
  > | null = null;
  private returnFocus: HTMLElement | null = null;
  // Whether the link that gets the focus back draws its ring: only after a close from the keyboard
  private returnFocusVisible = false;
  // The dialog's cancel event comes from Escape, but also from the back gesture on Android
  private escapePressed = false;
  private touchStartX = 0;
  private touchStartY = 0;
  // A pinch started this touch gesture: the finger left on screen pans, it does not close
  private touchPinched = false;
  // timeStamp of the last horizontal wheel event; none yet, so the first vertical one always counts
  private lastHorizontalWheel = -Infinity;
  private scrollTarget = 0;
  private scrollTargetUntil = 0;
  private openId = 0;
  // The files asked for when a link was pointed at or focused, by what they are: see preload()
  private preloaded = new Map<string, HTMLImageElement>();
  private preloadTimer: number | undefined;

  // Listeners on the page's links live as long as the instance
  private controller = new AbortController();
  // Listeners on the shared overlay live only while this instance has it open
  private openController: AbortController | null = null;

  constructor(wrapper: HTMLElement) {
    this.wrapper = wrapper;

    // One overlay is shared by every zoom instance on the page
    this.overlay = getOverlay();
    this.host = (this.overlay.getRootNode() as ShadowRoot).host as HTMLElement;
    this.backdrop = overlayPart(this.overlay, "backdrop");
    this.track = overlayPart(this.overlay, "track");
    this.captionElement = overlayPart(this.overlay, "caption");
    this.closeButton = overlayPart(this.overlay, "close");
    this.toolbar = overlayPart(this.overlay, "toolbar");
    this.counter = overlayPart(this.overlay, "counter");
    this.prevButton = overlayPart(this.overlay, "prev");
    this.nextButton = overlayPart(this.overlay, "next");

    this.setupEventListeners();
  }

  // The labels of the gallery, English for the ones it lacks
  private applyLabels(): void {
    let labels: Partial<ImageZoomLabels> = {};
    try {
      labels = JSON.parse(this.wrapper.dataset.imageZoomLabels ?? "{}") ?? {};
    } catch {
      // Malformed (a page that sets the attribute by hand): the overlay opens in English
    }
    for (const element of [
      this.overlay,
      ...this.overlay.querySelectorAll<HTMLElement>("[data-label]"),
    ]) {
      const name = element.dataset.label as keyof ImageZoomLabels;
      element.setAttribute("aria-label", labels[name] ?? DEFAULT_LABELS[name]);
    }
  }

  // Only the links the component generated and those the site marks with data-image-zoom: any other link
  // with an image (a card, a logo) keeps navigating. So does a data-image-zoom link without an image: the
  // zoom grows from the image of the link
  private collectImages(): void {
    const links = this.wrapper.querySelectorAll<HTMLAnchorElement>(
      "a[data-image-zoom-generated], a[data-image-zoom]",
    );

    this.state.images = Array.from(links)
      .map((anchor) => this.describe(anchor))
      .filter((image): image is ZoomImage => image !== null && !!image.src);
  }

  // What the zoom needs to know of a link, or null when it is no image to zoom: a link without an
  // image, or one the page leaves out
  private describe(anchor: HTMLAnchorElement): ZoomImage | null {
    const img = anchor.querySelector("img");
    if (!img || this.isIgnored(anchor)) return null;

    // On the image, or on the link of a site's own markup
    const data = (name: "Width" | "Height") =>
      img.dataset[`imageZoom${name}`] ?? anchor.dataset[`imageZoom${name}`];
    const width = Number.parseFloat(data("Width") ?? "");
    const height = Number.parseFloat(data("Height") ?? "");
    return {
      src: anchor.href,
      alt: img.alt || "",
      caption: this.captionOf(anchor, img),
      element: anchor,
      dimensions:
        width > 0 && height > 0 && Number.isFinite(width + height)
          ? { width, height }
          : undefined,
    };
  }

  // Asks for the full-size file when a link is pointed at or focused, so the click finds it in the
  // cache and the zoom opens as the image itself, not as a blurry thumbnail. A moment after, not
  // at once: a pointer only passing over is no intent, and a site that prefetches its links with
  // Astro (prefetch, data-astro-prefetch) will have asked for the same file by then, which is then
  // left to it. Not with the data saver on
  private preload(anchor: HTMLAnchorElement, wait = PRELOAD_WAIT): void {
    clearTimeout(this.preloadTimer);
    this.preloadTimer = window.setTimeout(() => {
      const connection = (
        navigator as Navigator & { connection?: { saveData?: boolean } }
      ).connection;
      if (this.isOpen || connection?.saveData) return;

      const image = this.describe(anchor);
      if (!image || this.preloaded.has(image.src)) return;
      const prefetched = [
        ...document.head.querySelectorAll<HTMLLinkElement>(
          'link[rel="prefetch"]',
        ),
      ].some((link) => link.href === image.src);
      if (prefetched) return;

      const file = new Image();
      file.src = image.src;
      // Decoded too, off the main thread: the slide that shows it then finds it ready
      void file.decode().catch(() => {
        // A broken file: the opening shows the thumbnail instead (showThumbnailInstead())
      });
      this.preloaded.set(image.src, file);
      if (this.preloaded.size > PRELOAD_LIMIT) {
        const [oldest] = this.preloaded.entries();
        if (oldest) {
          // Still on its way: a pointer that went on, no use for the bytes. A loaded one is not harmed
          if (!oldest[1].complete) oldest[1].src = "";
          this.preloaded.delete(oldest[0]);
        }
      }
    }, wait);
  }

  // The caption of a link: its data-image-zoom-caption (an empty one means no caption), then the
  // figcaption of the figure around it, then a title, the link's or the image's (Markdown's
  // ![alt](src "title")). A figcaption shared by several images describes the group, so it only
  // counts when the figure holds this one image, zoomable or not
  private captionOf(
    anchor: HTMLAnchorElement,
    img: HTMLImageElement | null,
  ): string {
    const explicit = anchor.dataset.imageZoomCaption;
    if (explicit !== undefined) return explicit;

    const figure = anchor.closest("figure");
    const figcaption = figure?.querySelector(":scope > figcaption");
    if (figure && figcaption && figure.querySelectorAll("img").length === 1) {
      const text = figcaption.textContent?.replace(/\s+/g, " ").trim();
      if (text) return text;
    }

    return anchor.title || img?.title || "";
  }

  // data-image-zoom-ignore, or a selector of the ignore prop, on the image of a link or on an element
  // around it, up to the wrapper, leaves the link out of the zoom and the gallery. The generated
  // links are the images the server kept: matching them here, with the new <a> in between, could
  // leave out images the server wrapped. Only the site's own links with data-image-zoom are checked
  private isIgnored(anchor: HTMLAnchorElement): boolean {
    if (anchor.hasAttribute("data-image-zoom-generated")) return false;
    const start = anchor.querySelector("img") ?? anchor;
    const inside = (match: Element | null): boolean =>
      match !== null && match !== this.wrapper && this.wrapper.contains(match);
    if (inside(start.closest("[data-image-zoom-ignore]"))) return true;

    const ignore = this.wrapper.dataset.imageZoomIgnoreSelector;
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
      "click",
      (e) => {
        // Let the browser handle "open in new tab" and similar clicks
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return;

        // Most clicks in an article are not on a zoom link: no need to collect the images
        const link = (e.target as Element).closest(
          "a[data-image-zoom-generated], a[data-image-zoom]",
        );
        if (!link) return;

        this.collectImages();
        const index = this.state.images.findIndex(
          ({ element }) => element === link,
        );
        if (index === -1) return;

        e.preventDefault();
        void this.open(index, fromKeyboard(e));
      },
      { signal: this.controller.signal },
    );

    // Intent: a pointer over a link (not on touch screens, where there is no hover), the focus of
    // the keyboard, or a finger or button going down, a moment before the click
    const intent = (e: Event): void => {
      if (e instanceof PointerEvent && e.type === "pointerover") {
        if (e.pointerType === "touch") return;
      }
      const link = (e.target as Element).closest?.<HTMLAnchorElement>(
        "a[data-image-zoom-generated], a[data-image-zoom]",
      );
      // A press is the click about to happen: no wait
      if (link) this.preload(link, e.type === "pointerdown" ? 0 : undefined);
    };
    for (const type of ["pointerover", "pointerdown", "focusin"]) {
      this.wrapper.addEventListener(type, intent, {
        passive: true,
        signal: this.controller.signal,
      });
    }
    // Gone before the wait ended: it was passing by
    for (const type of ["pointerout", "focusout"]) {
      this.wrapper.addEventListener(
        type,
        () => clearTimeout(this.preloadTimer),
        { passive: true, signal: this.controller.signal },
      );
    }
  }

  // The overlay is shared, so only the instance that has it open may listen to it
  private bindOverlayListeners(signal: AbortSignal): void {
    // Handle native dialog cancel (Escape key), also while the image is loading
    this.escapePressed = false;
    this.overlay.addEventListener(
      "keydown",
      (e) => (this.escapePressed = e.key === "Escape"),
      { signal },
    );
    this.overlay.addEventListener("cancel", this.handleCancel, { signal });
    // Closed from outside (a script calling close(), a close the browser forces): clean up. The
    // listener is gone by the time finalizeClose() closes the dialog itself
    this.overlay.addEventListener("close", () => this.close(), { signal });

    this.closeButton.addEventListener(
      "click",
      (e) => this.close(false, fromKeyboard(e)),
      { signal },
    );

    this.prevButton.addEventListener("click", () => this.prev(), { signal });
    this.nextButton.addEventListener("click", () => this.next(), { signal });

    // The slides cover the backdrop, so they receive its clicks. Click on the image closes
    // (like Medium), click beside it counts as a backdrop click. The caption and the controls
    // live in the track too: their clicks are theirs
    this.track.addEventListener(
      "click",
      (e) => {
        if ((e.target as Element).closest(".astro-image-zoom-bottom")) return;
        const onImage =
          (e.target as Element).closest(".astro-image-zoom-image") !== null;
        if (onImage ? this.options.closeOnImage : this.options.closeOnBackdrop)
          this.close();
      },
      { signal },
    );
  }

  // The overlay is shared: each opening sets the options and the labels of its gallery
  private applyOverlayConfig(): void {
    const { options } = this;
    Object.assign(this.overlay.dataset, {
      closeBackdrop: String(options.closeOnBackdrop),
      closeImage: String(options.closeOnImage),
      captionPosition: options.captionPosition,
      showCaption: String(options.showCaption),
      showNav: String(options.showNavigation),
      showCounter: String(options.showCounter),
      navigationLayout: options.navigationLayout,
    });
    this.applyLabels();
  }

  // The gestures and keys of the open zoom, once the image is shown
  private bindOpenListeners(signal: AbortSignal): void {
    // Arrow keys move through the gallery
    document.addEventListener("keydown", this.handleKeydown, { signal });

    // Horizontal swipes scroll the track natively; the slide on screen follows the scroll
    this.track.addEventListener("scroll", this.handleScroll, {
      passive: true,
      signal,
    });

    // Zoomed in with a pinch, the swipes pan the page zoom instead of moving through the gallery
    window.visualViewport?.addEventListener("resize", this.handlePageZoom, {
      signal,
    });
    this.handlePageZoom();

    // An image with the shape of its thumbnail is sized in px: it follows its slide
    window.addEventListener("resize", this.handleResize, { signal });

    // Smooth close on vertical scroll/wheel (like Medium - non-blocking)
    if (this.options.closeOnScroll) {
      this.overlay.addEventListener("touchstart", this.handleTouchStart, {
        passive: true,
        signal,
      });
      this.overlay.addEventListener("touchmove", this.handleTouchMove, {
        passive: true,
        signal,
      });
      this.overlay.addEventListener("wheel", this.handleWheel, {
        passive: true,
        signal,
      });
    }
  }

  // From open() until close() starts
  private get isOpen(): boolean {
    return this.phase !== "closed" && this.phase !== "closing";
  }

  // The slide on screen. The slides exist from open() until finalizeClose()
  private get currentSlide(): ZoomSlide {
    const slide = this.slides[this.state.currentIndex];
    if (!slide) throw new Error("astro-image-zoom: no slide on screen");
    return slide;
  }

  private get imageElement(): HTMLImageElement {
    return this.currentSlide.img;
  }

  private async open(index: number, byKeyboard = false): Promise<void> {
    const sourceImg = this.getThumbnail(index);
    if (this.phase !== "closed" || !sourceImg) return;

    // Identifies this opening; close() increments it to cancel a pending open
    const currentOpenId = ++this.openId;

    this.phase = "loading";
    this.state.currentIndex = index;
    // The grace period after a horizontal wheel belongs to one opening, not to the previous one
    this.lastHorizontalWheel = -Infinity;

    // The options of this gallery, and its variables (the theme and animationDuration among them)
    this.options = readOptions(this.wrapper.dataset);
    this.inheritVariables();

    const sourceRect = sourceImg.getBoundingClientRect();
    const sourceFit = thumbnailFit(sourceImg);

    this.buildSlides();
    this.renderActive(index);
    this.placeSpinner(this.currentSlide.figure, sourceRect);
    this.emit("open");
    // Hidden until the image is ready, so the FLIP animation starts from a clean frame. Before any
    // layout, so its opacity transition does not run: it would show the image for a frame
    this.imageElement.style.opacity = "0";

    // Listen to the overlay from now until close(), also while the image is loading
    this.openController = new AbortController();
    const { signal } = this.openController;
    this.bindOverlayListeners(signal);

    // Show overlay and prevent body scroll
    this.overlay.showModal();
    this.applyOverlayConfig();
    this.lockScroll();

    // Show the slide of the image, without letting a swipe move it away while it loads
    this.track.style.overflowX = "hidden";
    this.jumpToSlide(index);

    await this.loadSlide(index);

    // Closed while loading: close() already restored everything
    if (currentOpenId !== this.openId) return;
    this.track.style.overflowX = "";
    // Shown at once, in the frame the thumbnail hides: its opacity transition would fade it in over
    // an empty spot, a blink. The transition comes back for later changes
    withoutTransition(this.imageElement, () => {
      this.imageElement.style.opacity = "1";
    });

    const finalRect = this.imageElement.getBoundingClientRect();
    const transform = flipTransform(sourceRect, finalRect, sourceFit);

    this.setAnimationVariables(transform);
    // Only an image that is cropped or rounded animates its clip-path
    this.imageElement.classList.toggle(
      "is-clipped",
      !isFlatClip(transform.clipPath) ||
        !isFlatClip(getComputedStyle(this.imageElement).clipPath),
    );

    // Hide thumbnail instantly and trigger CSS animation simultaneously
    this.hideThumbnail(sourceImg);
    this.phase = "opening";
    this.overlay.classList.add("is-opening");

    // After the animation, switch to the is-open state
    void animationsFinished(this.overlay, OPEN_ANIMATIONS).then(() => {
      if (currentOpenId !== this.openId) return;
      this.phase = "open";
      this.overlay.classList.remove("is-opening");
      this.overlay.classList.add("is-open");
      // Their files would decode under the animation: the neighbors wait for its end
      this.preloadNeighbors(index);
      // The images whose size became known during the opening take their shape now, and the ones
      // that decoded unfold
      this.slides.forEach((slide, i) => this.settle(i, slide));
    });

    this.bindOpenListeners(signal);

    // The modal dialog traps the focus natively. Its ring only after a keyboard opening: Safari
    // draws it after a click or a tap too, and carries it to the link the close then focuses
    this.closeButton.focus({ focusVisible: byKeyboard });
  }

  private close(byScroll = false, byKeyboard = false): void {
    if (!this.isOpen) return;

    const closedFrom = this.phase;
    this.phase = "closing";
    this.emit("close");

    // Cancel a pending open() that is still waiting for the image to load
    this.openId++;

    // Release the shared overlay: no listener of this instance survives the close
    this.openController?.abort();
    this.openController = null;

    // Get source image BEFORE any DOM changes
    const sourceElement = this.state.images[this.state.currentIndex]?.element;
    const sourceImg = this.getThumbnail(this.state.currentIndex);

    // Focus goes to the link of the image on screen, where the close lands, not to the one that
    // opened the zoom: a keyboard user goes on from the image they were looking at. Not
    // document.activeElement at open: Safari does not focus a link on click, so it would be <body>
    this.returnFocus = sourceElement ?? null;
    this.returnFocusVisible = byKeyboard;

    // Closed while loading: the opening animation never ran, so close without animating. Nor when
    // the dialog is already closed, or the page removed the thumbnail while the zoom was open:
    // there is nothing on screen to animate, or nowhere to fly back to
    if (
      closedFrom === "loading" ||
      !this.overlay.open ||
      !sourceImg?.isConnected
    ) {
      this.finalizeClose(sourceImg);
      return;
    }

    // Stop a slide still gliding, so the image closes from a still position
    this.scrollTargetUntil = 0;
    this.setSlideOffset(0, false);
    this.jumpToSlide(this.state.currentIndex);

    // The close starts from where the image is, read before the classes change: it may be moving
    // during the opening, or taking its shape (reshape()), or unfolding from the crop of its
    // placeholder, which the close stops
    const image = getComputedStyle(this.imageElement);
    this.imageElement.style.setProperty("--transform-now", image.transform);
    const clipNow = image.clipPath;
    this.imageElement.style.setProperty("--clip-now", clipNow);

    // Closed during the opening: the backdrop too, read before the opening stops
    if (closedFrom === "opening") {
      this.backdrop.style.setProperty(
        "--backdrop-now",
        getComputedStyle(this.backdrop).opacity,
      );
    }

    // The box the animation moves, without its transform: during the opening, the rect on screen
    // is the one of a moving image. The slide is the offset parent of the image
    const slideRect = (
      this.imageElement.offsetParent as HTMLElement
    ).getBoundingClientRect();
    const { offsetLeft, offsetTop, offsetWidth, offsetHeight } =
      this.imageElement;
    const startRect = new DOMRect(
      slideRect.left + offsetLeft,
      slideRect.top + offsetTop,
      offsetWidth,
      offsetHeight,
    );

    this.overlay.classList.remove("is-open", "is-opening");
    this.overlay.classList.add("is-closing");

    // To the thumbnail of the image on screen, which may not be the one the opening started from.
    // The gallery may have moved to one off screen: the page, hidden under the overlay, scrolls to
    // it first, so the image lands in view and so does the focus. Not on a scroll close, where the
    // page is already moving with the gesture
    if (!byScroll)
      sourceImg.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "instant",
      });
    const targetRect = sourceImg.getBoundingClientRect();
    const transform = flipTransform(
      targetRect,
      startRect,
      thumbnailFit(sourceImg),
    );
    this.setAnimationVariables(transform);
    this.imageElement.classList.toggle(
      "is-clipped",
      !isFlatClip(transform.clipPath) || !isFlatClip(clipNow),
    );

    // If closed by scroll, unlock scroll immediately and use special animation
    if (byScroll) {
      this.unlockScroll();
      this.animateScrollClose(startRect, sourceImg);
    } else {
      void animationsFinished(this.overlay, CLOSE_ANIMATIONS).then(() =>
        this.finalizeClose(sourceImg),
      );
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
    return performance.now() < this.scrollTargetUntil
      ? this.scrollTarget
      : this.state.currentIndex;
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
    return image
      ? Number.parseFloat(getComputedStyle(image).translate) || 0
      : 0;
  }

  // Moves the images of the slides by `offset` px, gliding there when `animate`, at once otherwise
  private setSlideOffset(offset: number, animate: boolean): void {
    this.track.classList.toggle("is-sliding", animate);
    this.track.style.setProperty(
      "--astro-image-zoom-slide-offset",
      `${offset}px`,
    );
    // Commit the offset before the transition starts from it
    if (!animate) void this.track.offsetWidth;
  }

  // Shows a slide without the smooth scroll
  private jumpToSlide(index: number): void {
    this.track.scrollTo({
      left: index * this.track.clientWidth,
      behavior: "instant",
    });
  }

  private buildSlides(): void {
    this.slides = this.state.images.map(({ src, alt, dimensions }) => {
      const figure = document.createElement("figure");
      figure.className = "astro-image-zoom-slide";
      figure.part.add("slide");
      const img = document.createElement("img");
      img.className = "astro-image-zoom-image";
      img.part.add("image");
      img.alt = alt;
      figure.append(img);
      return { figure, img, src, dimensions };
    });

    // Before the caption and the controls, which stay in the track
    this.removeSlides();
    this.track.prepend(...this.slides.map(({ figure }) => figure));
  }

  private removeSlides(): void {
    for (const slide of this.track.querySelectorAll(".astro-image-zoom-slide"))
      slide.remove();
  }

  // Starts loading the full-size image of a slide, and resolves when it can be shown: see
  // whenShowable()
  private loadSlide(index: number): Promise<void> {
    const slide = this.slides[index];
    if (!slide) return Promise.resolve();
    if (slide.ready) return slide.ready;

    const { img, figure } = slide;
    // The page said the size: the image has its final box from the start, before its file loads,
    // and keeps it when the file takes its place
    this.fitKnown(slide);
    // The file the person is waiting for goes first; the neighbors load behind it
    img.fetchPriority = index === this.state.currentIndex ? "high" : "low";
    img.src = slide.src;
    // The CSS shows the spinner only if the wait lasts
    figure.classList.add("is-loading");

    const decoded = img
      .decode()
      .catch(() => this.showThumbnailInstead(index, img));
    slide.loaded = decoded;
    slide.ready = this.whenShowable(index, slide, decoded).then(() =>
      figure.classList.remove("is-loading"),
    );
    void decoded.then(() => {
      slide.decoded = true;
      // During the opening the thumbnail stays and the file stays out of the box: see release()
      if (this.phase !== "opening") this.release(slide);
      this.settle(index, slide);
    });

    return slide.ready;
  }

  // The decoded file takes the place of the thumbnail that stood in for it. Not while the zoom
  // animation runs: a large image that paints for the first time mid-animation drops frames (a
  // retina screen, 2000 px and more), so the file waits out of the box (is-holding, overlay.css)
  // and comes in when the animations end
  private release(slide: ZoomSlide): void {
    const { img } = slide;
    img.classList.remove("is-holding");
    img.style.removeProperty("background-image");
    img.style.removeProperty("background-size");
    // The size the page said holds, so the file takes its place without a jump. Not if the file has
    // another shape: it is laid out as its own
    const { naturalWidth, naturalHeight } = img;
    const { dimensions } = slide;
    if (
      slide.fixedSize &&
      dimensions &&
      naturalWidth > 0 &&
      naturalHeight > 0 &&
      Math.abs(
        naturalWidth / naturalHeight / (dimensions.width / dimensions.height) -
          1,
      ) > 0.02
    )
      this.unfit(slide);
  }

  // Leaves the image to the size its file and the slide give it
  private unfit(slide: ZoomSlide): void {
    slide.img.style.removeProperty("width");
    slide.img.style.removeProperty("height");
    slide.fixedSize = false;
  }

  // The thumbnail, already loaded, stands in for the full-size image until it decodes. With the
  // shape of the thumbnail, when the size of the file takes longer than SIZE_WAIT (a slow network):
  // the image takes its real shape once the size is known (reshape()). Once the size is known
  // otherwise. Without a thumbnail that can paint at once, the image waits for its file
  private async whenShowable(
    index: number,
    slide: ZoomSlide,
    decoded: Promise<void>,
  ): Promise<void> {
    // A file that is there within a moment (in memory, in the cache, a local server) and decodes at
    // once opens as the image itself, with no placeholder to swap. Painting it for the first time
    // costs a few frames, which in the first frame of the animation only delay its start, where
    // under the animation they would be a stutter. The wait comes in two steps, so a file still on
    // its way costs only the first: its bytes within LOAD_GRACE, then its decoding, all within
    // DECODE_GRACE
    const { img } = slide;
    const started = performance.now();
    const arrived = img.complete
      ? Promise.resolve(true)
      : new Promise<boolean>((resolve) => {
          img.addEventListener("load", () => resolve(true), { once: true });
          setTimeout(() => resolve(false), LOAD_GRACE);
        });
    if (await arrived) {
      const quick = await Promise.race([
        decoded.then(() => true),
        new Promise<false>((resolve) =>
          setTimeout(
            () => resolve(false),
            Math.max(0, DECODE_GRACE - (performance.now() - started)),
          ),
        ),
      ]);
      if (quick) return;
    }

    // The page said the size: the final shape at once, with no wait for the first bytes
    if (slide.dimensions && slide.fixedSize) {
      const { width, height } = slide.dimensions;
      const naturalSize = { naturalWidth: width, naturalHeight: height };
      if (this.showPlaceholder(index, slide.img, naturalSize)) return;
      this.unfit(slide);
    }

    const size = sizeKnown(slide.img, decoded);
    const known = await Promise.race([
      size.then(() => true),
      new Promise<false>((resolve) =>
        setTimeout(() => resolve(false), SIZE_WAIT),
      ),
    ]);
    if (!known && this.showProvisional(index, slide)) {
      void size.then(() => {
        slide.sized = true;
        this.settle(index, slide);
      });
      return;
    }
    await size;
    if (!this.showPlaceholder(index, slide.img)) await decoded;
  }

  // Sizes the image to the shape the page said for its file, as the slide lets it: in the room its
  // max-width and max-height (overlay.css) leave, and no bigger than the file. The size is kept after
  // the file decodes, so nothing moves
  private fitKnown(slide: ZoomSlide): boolean {
    const { img, dimensions } = slide;
    if (!dimensions) return false;

    img.style.width = img.style.height = "100vmax";
    const width = fitWidth(dimensions, {
      width: img.offsetWidth,
      height: img.offsetHeight,
    });
    if (!(width > 0)) {
      this.unfit(slide);
      return false;
    }
    img.style.width = `${width}px`;
    img.style.height = `${(width * dimensions.height) / dimensions.width}px`;
    slide.fixedSize = true;
    return true;
  }

  // Lays the image out with the shape of its thumbnail, smaller than the slide lets it
  // (PROVISIONAL_SCALE), with the thumbnail over all of it. object-fit: cover, so the file, if it decodes before its shape is
  // taken, shows the same centered crop
  private showProvisional(index: number, slide: ZoomSlide): boolean {
    const thumbnail = this.getThumbnail(index);
    if (!paintsAtOnce(thumbnail) || !this.fitProvisional(index, slide))
      return false;

    const { img } = slide;
    img.style.objectFit = "cover";
    img.style.backgroundImage = `url(${JSON.stringify(thumbnail.currentSrc)})`;
    img.classList.add("is-holding");
    slide.provisional = true;
    return true;
  }

  // Sizes an image with the shape of its thumbnail to its slide: on show, and again when the slide
  // changes size (a phone rotated) before the image takes its own shape. The room it has is the box
  // its max-width and max-height (overlay.css) leave to an image too big for it
  private fitProvisional(index: number, slide: ZoomSlide): boolean {
    const thumbnail = this.getThumbnail(index);
    if (!thumbnail) return false;

    const { img } = slide;
    img.style.width = img.style.height = "100vmax";
    const ratio = thumbnail.naturalWidth / thumbnail.naturalHeight;
    const boxWidth =
      Math.min(img.offsetWidth, img.offsetHeight * ratio) / PROVISIONAL_SCALE;

    img.style.width = `${boxWidth}px`;
    img.style.height = `${boxWidth / ratio}px`;
    if (boxWidth > 0) return true;
    img.style.width = img.style.height = "";
    return false;
  }

  // An image with the shape of its thumbnail takes its own as soon as its size is known (reshape()),
  // also while the zoom animation runs: it goes on from where the image is, in one movement. The rest
  // of the picture unfolds from the crop of the thumbnail that stood in for it once the file decodes
  // and the zoom animations end (a transition in overlay.css; started under them, it would show once
  // they end, as a jump)
  private settle(index: number, slide: ZoomSlide): void {
    if (this.phase !== "open" && this.phase !== "opening") return;
    if (slide.provisional) {
      if (!slide.sized) return;
      this.reshape(index, slide);
    }
    if (this.phase === "open" && slide.decoded) {
      // The zoom animation that held the crop has just gone: commit the style without it, or the
      // unfold would start from a style that still had the animation, and jump instead of running
      void getComputedStyle(slide.img).clipPath;
      this.release(slide);
      slide.img.style.removeProperty("--astro-image-zoom-crop");
    }
  }

  // The image leaves the shape of its thumbnail for its own, with the thumbnail as its placeholder
  // (showPlaceholder()). On screen, the part the thumbnail shows moves and scales from where it was
  // (a FLIP, astro-image-zoom-reshape in overlay.css). During the opening, from where the zoom
  // animation has taken it, which stops: it only goes on when there is a placeholder part to follow,
  // else it waits for the animation to end (settle() runs again)
  private reshape(index: number, slide: ZoomSlide): void {
    const { img } = slide;
    if (this.phase === "opening") {
      const thumbnail = this.getThumbnail(index);
      const hasPart =
        (img.style.backgroundImage || slide.decoded) &&
        thumbnail &&
        placeholderBox(thumbnail, img);
      if (!hasPart) return;
    }
    const first = img.getBoundingClientRect();
    if (this.phase === "opening") {
      for (const animation of img.getAnimations()) {
        if (
          animation instanceof CSSAnimation &&
          (animation.animationName === "astro-image-zoom-in" ||
            animation.animationName === "astro-image-zoom-clip-in")
        )
          animation.cancel();
      }
    }
    img.style.removeProperty("width");
    img.style.removeProperty("height");
    img.style.removeProperty("object-fit");
    slide.provisional = false;
    // The file failed and the thumbnail took its place: nothing stands in for it any more
    if (!img.style.backgroundImage && !slide.decoded) return;

    const thumbnail = this.getThumbnail(index);
    const box = thumbnail && placeholderBox(thumbnail, img);
    if (!box) return;
    if (!slide.decoded) img.style.backgroundSize = box.size;
    setCrop(img, box.inset);
    if (index !== this.state.currentIndex) return;

    // The part the thumbnail shows is centered (placeholderBox()), so its center is the image's
    const last = img.getBoundingClientRect();
    const scale =
      first.width / ((last.width * Number.parseFloat(box.size)) / 100);
    const x = first.left + first.width / 2 - (last.left + last.width / 2);
    const y = first.top + first.height / 2 - (last.top + last.height / 2);
    img.style.setProperty("--reshape-x", `${x}px`);
    img.style.setProperty("--reshape-y", `${y}px`);
    img.style.setProperty("--reshape-scale", String(scale));
    img.classList.add("is-reshaping");
    void animationsFinished(img, ["astro-image-zoom-reshape"]).then(() =>
      img.classList.remove("is-reshaping"),
    );
  }

  // A full-size image that fails to load (a wrong data-image-zoom-src, a 404) shows the file of its
  // thumbnail, already loaded, instead of a broken image
  private showThumbnailInstead(
    index: number,
    img: HTMLImageElement,
  ): Promise<void> {
    const source = this.getThumbnail(index)?.currentSrc;
    if (!source || img.src === source) return Promise.resolve();
    // The thumbnail is the whole image now: no placeholder behind it, nor its crop, and its own size
    img.classList.remove("is-holding");
    const slide = this.slides[index];
    if (slide) this.unfit(slide);
    img.style.removeProperty("background-image");
    img.style.removeProperty("background-size");
    setCrop(img, null);
    img.src = source;
    return img.decode().catch(() => {
      // The thumbnail failed too: nothing to show
    });
  }

  // Shows the thumbnail, already loaded, behind the full-size image until it decodes: stretched
  // over it, or in its middle when the thumbnail file is a crop of the picture, with the image
  // clipped to it (placeholderBox())
  private showPlaceholder(
    index: number,
    img: HTMLImageElement,
    size: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight"> = img,
  ): boolean {
    const thumbnail = this.getThumbnail(index);
    if (img.complete || !paintsAtOnce(thumbnail)) return false;

    const box = placeholderBox(thumbnail, size);
    if (!box) return false;

    img.style.backgroundImage = `url(${JSON.stringify(thumbnail.currentSrc)})`;
    img.style.backgroundSize = box.size;
    img.classList.add("is-holding");
    setCrop(img, box.inset);
    return true;
  }

  // While the opening waits for the image, the backdrop is not there yet: the spinner goes on the
  // thumbnail that was clicked, where the eyes are, and no bigger than a part of it
  private placeSpinner(
    figure: HTMLElement,
    { left, top, width, height }: DOMRect,
  ): void {
    figure.classList.add("is-from-thumbnail");
    figure.style.setProperty(
      "--astro-image-zoom-spinner-x",
      `${left + width / 2}px`,
    );
    figure.style.setProperty(
      "--astro-image-zoom-spinner-y",
      `${top + height / 2}px`,
    );
    figure.style.setProperty(
      "--astro-image-zoom-spinner-size",
      `${Math.min(32, Math.min(width, height) * 0.4)}px`,
    );
  }

  // Once the file of the image on screen has loaded: the image opens before it, and on a slow
  // network the files of its neighbors would share the bandwidth with it
  private preloadNeighbors(index: number): void {
    const { slides } = this;
    void slides[index]?.loaded?.then(() => {
      // Closed meanwhile: the slides are gone
      if (this.slides !== slides) return;
      for (const neighbor of [index - 1, index + 1]) {
        if (slides[neighbor]) void this.loadSlide(neighbor);
      }
    });
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
    this.emit("change");
    void this.loadSlide(index);
    this.preloadNeighbors(index);
  };

  // Tells the page what the zoom shows now; see ZoomEventDetail
  private emit(type: "open" | "change" | "close" | "closed"): void {
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
          caption: image.caption ?? "",
          link: image.element,
        },
      }),
    );
  }

  // Marks the slide on screen and updates what depends on it: caption and buttons
  private renderActive(index: number): void {
    this.state.currentIndex = index;

    this.slides.forEach(({ figure }, i) => {
      figure.classList.toggle("is-active", i === index);
      figure.setAttribute("aria-hidden", String(i !== index));
    });

    this.captionElement.textContent = this.state.images[index]?.caption ?? "";
    this.updateNavigationButtons();
  }

  // The navigation bar: arrows and counter, each one on its own, only for galleries
  private updateNavigationButtons(): void {
    const total = this.state.images.length;
    const { showNavigation, showCounter } = this.options;
    this.toolbar.hidden = !(showNavigation || showCounter) || total < 2;
    if (this.toolbar.hidden) return;

    const index = this.state.currentIndex;
    this.counter.textContent = `${index + 1} / ${total}`;
    this.prevButton.setAttribute("aria-disabled", String(index === 0));
    this.nextButton.setAttribute("aria-disabled", String(index === total - 1));
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        this.prev();
        break;
      case "ArrowRight":
        e.preventDefault();
        this.next();
        break;
    }
  };

  private handleCancel = (e: Event): void => {
    // Not the native close at once: the animated one
    e.preventDefault();
    this.close(false, this.escapePressed);
  };

  private handlePageZoom = (): void => {
    this.overlay.classList.toggle("is-page-zoomed", isPageZoomed());
  };

  private handleResize = (): void => {
    this.slides.forEach((slide, i) => {
      if (slide.provisional) this.fitProvisional(i, slide);
      else if (slide.fixedSize) this.fitKnown(slide);
    });
  };

  private handleTouchStart = (e: TouchEvent): void => {
    // Ignore multi-touch (pinch to zoom) until every finger has left the screen
    if (e.touches.length > 1) {
      this.touchPinched = true;
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;
    this.touchPinched = false;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  };

  private handleWheel = (e: WheelEvent): void => {
    // A touchpad pinch (and Ctrl + wheel) comes as a wheel with ctrlKey: it zooms, it does not scroll
    if (e.ctrlKey) return;
    // Zoomed in with a pinch, the wheel pans the page zoom: it does not close
    if (isPageZoomed()) return;

    // Horizontal gestures scroll the track natively; the vertical jitter of a touchpad
    // swipe must not close the overlay
    if (Math.abs(e.deltaX) * 2 >= Math.abs(e.deltaY)) {
      this.lastHorizontalWheel = e.timeStamp;
      return;
    }

    if (Math.abs(wheelPixels(e)) < WHEEL_CLOSE_DELTA) return;
    if (e.timeStamp - this.lastHorizontalWheel < WHEEL_HORIZONTAL_GRACE) return;
    this.close(true);
  };

  private handleTouchMove = (e: TouchEvent): void => {
    // Ignore multi-touch (pinch to zoom), and the swipes that pan the page zoom: zoomed in on an
    // image, the instinct is to drag it around to see the rest of it
    if (e.touches.length > 1 || this.touchPinched || isPageZoomed()) return;

    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = Math.abs(touch.clientX - this.touchStartX);
    const deltaY = Math.abs(touch.clientY - this.touchStartY);

    // Only trigger close on vertical scroll (not horizontal swipes)
    if (deltaY > deltaX && deltaY > 10) {
      this.close(true);
    }
  };

  public destroy(): void {
    // Remove the listeners on the page's links
    this.controller.abort();
    clearTimeout(this.preloadTimer);

    // Close if open (also releases the overlay listeners)
    if (this.isOpen) this.close();
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

  // Stops the page from scrolling behind the overlay. On <html>, which the viewport takes its overflow
  // from before <body>: a site that sets overflow on <html> (html, body { overflow-x: hidden }) is
  // locked too. A classic scrollbar (Windows, Linux) goes away with it: the page gets that width back
  // as padding, so it does not shift under the overlay and the zoom grows from the thumbnail
  private lockScroll(): void {
    const root = document.documentElement;
    const { style } = root;
    const saved = (name: string): [string, string] => [
      style.getPropertyValue(name),
      style.getPropertyPriority(name),
    ];
    this.lockedStyles = {
      "overflow-x": saved("overflow-x"),
      "overflow-y": saved("overflow-y"),
      "padding-right": saved("padding-right"),
    };

    const width = root.clientWidth;
    style.setProperty("overflow-x", "hidden");
    style.setProperty("overflow-y", "hidden");
    const scrollbar = root.clientWidth - width;
    if (scrollbar > 0) {
      const padding =
        Number.parseFloat(getComputedStyle(root).paddingRight) || 0;
      style.setProperty("padding-right", `${padding + scrollbar}px`);
    }
  }

  private unlockScroll(): void {
    if (!this.lockedStyles) return;
    const { style } = document.documentElement;
    for (const [name, [value, priority]] of Object.entries(this.lockedStyles)) {
      if (value) style.setProperty(name, value, priority);
      else style.removeProperty(name);
    }
    this.lockedStyles = null;
  }

  // The image shrinks back to the thumbnail with the closing animation (its variables are set),
  // but out of the dialog and positioned on the page, so it scrolls away with it. A thumbnail in a
  // sticky or fixed box stays on screen while the page scrolls: the image is fixed then
  private animateScrollClose(
    startRect: DOMRect,
    sourceImg: HTMLImageElement,
  ): void {
    const image = this.imageElement;
    const fixed = staysOnScreen(sourceImg);
    if (fixed) image.style.position = "fixed";
    image.style.top = "0px";
    image.style.left = "0px";
    image.style.width = `${startRect.width}px`;
    image.style.height = `${startRect.height}px`;
    image.classList.add("is-detached");
    this.backdrop.classList.add("is-detached");

    // The dialog stays open, transparent, until the end: the gesture that closes it goes on over
    // it. The image and the backdrop stay in the shadow root: they keep the overlay styles and
    // the CSS of the page still cannot reach them. The backdrop first, so the image covers it.
    // Mouse wheels and Chrome go on scrolling the page with the same gesture. Firefox touchpads and
    // touch screens keep a gesture on the element it started on, the overlay, even once it is gone:
    // the page scrolls from the next gesture. Closing the dialog earlier does not change that
    (this.overlay.getRootNode() as ShadowRoot).append(this.backdrop, image);

    // Placed against its containing block: the page, or a <body> the site positions or transforms.
    // Measured at 0,0 without the animation, then moved in the same frame
    image.style.animation = "none";
    const origin = image.getBoundingClientRect();
    image.style.removeProperty("animation");
    const top = startRect.top - origin.top;
    const left = startRect.left - origin.left;
    image.style.top = `${top}px`;
    image.style.left = `${left}px`;

    // Then it follows the thumbnail where the page alone does not take it: a sticky box that sticks
    // or comes unstuck, a fixed one in a box that scrolls, a scroller inside the page
    const thumbnail = sourceImg.getBoundingClientRect();
    const page = { x: scrollX, y: scrollY };
    let following = true;
    const follow = () => {
      if (!following) return;
      const { top: thumbnailTop, left: thumbnailLeft } =
        sourceImg.getBoundingClientRect();
      const scrolledY = fixed ? 0 : scrollY - page.y;
      const scrolledX = fixed ? 0 : scrollX - page.x;
      image.style.top = `${top + thumbnailTop - thumbnail.top + scrolledY}px`;
      image.style.left = `${left + thumbnailLeft - thumbnail.left + scrolledX}px`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);

    void Promise.all([
      animationsFinished(image, CLOSE_ANIMATIONS),
      animationsFinished(this.backdrop, CLOSE_ANIMATIONS),
    ]).then(() => {
      // finalizeClose() discards the slides, so the image does not go back to its slide
      following = false;
      image.remove();
      this.backdrop.classList.remove("is-detached");
      this.overlay.prepend(this.backdrop);
      this.finalizeClose(sourceImg);
    });
  }

  private setAnimationVariables(transform: FlipTransform): void {
    this.imageElement.style.setProperty("--tx-from", `${transform.x}px`);
    this.imageElement.style.setProperty("--ty-from", `${transform.y}px`);
    this.imageElement.style.setProperty(
      "--scale-from",
      transform.scale.toString(),
    );
    this.imageElement.style.setProperty("--clip-from", transform.clipPath);
  }

  private getThumbnail(index: number): HTMLImageElement | null {
    return this.state.images[index]?.element.querySelector("img") ?? null;
  }

  // The thumbnail is hidden while its image is shown in the overlay
  private hideThumbnail(img: HTMLImageElement | null): void {
    if (!img) return;
    img.style.transition = "none";
    img.style.opacity = "0";
    img.style.pointerEvents = "none";
  }

  private showThumbnail(img: HTMLImageElement | null): void {
    if (!img) return;
    img.style.opacity = "";
    img.style.pointerEvents = "";

    // Force reflow then restore transition, so the thumbnail reappears without fading
    void img.offsetHeight;
    img.style.transition = "";
  }

  private finalizeClose(sourceImg: HTMLImageElement | null): void {
    // Restore the thumbnail as the overlay goes away - same frame
    this.showThumbnail(sourceImg);

    this.overlay.close();
    this.overlay.classList.remove(
      "is-opening",
      "is-open",
      "is-closing",
      "is-page-zoomed",
    );
    this.backdrop.style.removeProperty("--backdrop-now");
    this.unlockScroll();

    // The slides belong to the instance that opened the overlay: discard them
    this.removeSlides();
    this.track.style.overflowX = "";
    this.track.classList.remove("is-sliding");
    this.track.style.removeProperty("--astro-image-zoom-slide-offset");
    this.captionElement.textContent = "";
    this.slides = [];

    // Restore focus. close() may have given it back already to the link a click focused, with the
    // browser's own ring: focus() on the focused element does nothing, so it leaves first
    if (this.returnFocus) {
      if (document.activeElement === this.returnFocus) this.returnFocus.blur();
      this.returnFocus.focus({
        preventScroll: true,
        focusVisible: this.returnFocusVisible,
      });
      this.returnFocus = null;
    }

    this.phase = "closed";
    this.emit("closed");
  }
}

export { Zoom };
