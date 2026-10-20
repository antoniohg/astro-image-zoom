/**
 * Reference lists of the docs: CSS variables, parts, props, image attributes, labels and events.
 * Text between backticks in a description is shown as code.
 */
export interface ReferenceRow {
  name: string;
  description: string;
  /** TypeScript type, for props */
  type?: string;
  default?: string;
}

// Colors of the overlay
export const colorVariables: ReferenceRow[] = [
  {
    name: "--image-zoom-bg",
    description: "Overlay background",
    default: "light-dark(rgba(255, 255, 255, 0.98), rgba(0, 0, 0, 0.95))",
  },
  {
    name: "--image-zoom-close-color",
    description: "Close icon",
    default: "light-dark(rgba(0, 0, 0, 0.88), rgba(255, 255, 255, 0.92))",
  },
  {
    name: "--image-zoom-close-bg",
    description: "Close button, translucent over a blur",
    default: "light-dark(rgba(255, 255, 255, 0.75), rgba(28, 28, 30, 0.7))",
  },
  {
    name: "--image-zoom-nav-color",
    description: "Arrows and counter",
    default: "light-dark(rgba(0, 0, 0, 0.88), rgba(255, 255, 255, 0.92))",
  },
  {
    name: "--image-zoom-nav-bg",
    description:
      "Navigation bar (or each arrow in the sides layout), translucent over a blur",
    default: "light-dark(rgba(255, 255, 255, 0.75), rgba(28, 28, 30, 0.7))",
  },
  {
    name: "--image-zoom-caption-color",
    description: "Caption text",
    default: "light-dark(rgba(0, 0, 0, 0.88), rgba(255, 255, 255, 0.92))",
  },
  {
    name: "--image-zoom-caption-bg",
    description: "Caption box, translucent over a blur",
    default: "light-dark(rgba(255, 255, 255, 0.75), rgba(28, 28, 30, 0.7))",
  },
];

// Spacing, corners, controls and caption
export const layoutVariables: ReferenceRow[] = [
  {
    name: "--image-zoom-padding",
    description: "Space between the zoomed image and the screen edges",
    default: "0",
  },
  {
    name: "--image-zoom-image-radius",
    description: "Corners of the zoomed image",
    default: "0",
  },
  {
    name: "--image-zoom-button-size",
    description: "Size of the arrows and the close button",
    default: "40px (36px on phones)",
  },
  {
    name: "--image-zoom-button-radius",
    description: "Shape of the buttons and the navigation bar",
    default: "999px",
  },
  {
    name: "--image-zoom-controls-offset",
    description:
      "Distance from the controls and the caption to the screen edges",
    default: "16px (12px on phones)",
  },
  {
    name: "--image-zoom-caption-max-width",
    description: "Widest the caption can get",
    default: "70% (100% on phones)",
  },
  {
    name: "--image-zoom-caption-font",
    description: "Font family of the caption",
    default: "inherit",
  },
  {
    name: "--image-zoom-caption-font-size",
    description: "Font size of the caption",
    default: "13px (12px on phones)",
  },
  {
    name: "--image-zoom-caption-radius",
    description: "Corners of the caption box",
    default: "10px",
  },
];

// Color scheme and motion
export const otherVariables: ReferenceRow[] = [
  {
    name: "--image-zoom-color-scheme",
    description:
      "Set dark or light to follow your own theme toggle instead of the system",
    default: "light dark",
  },
  {
    name: "--image-zoom-animation-duration",
    description: "Zoom animation; the animationDuration prop wins over it",
    default: "300ms",
  },
  {
    name: "--image-zoom-easing-in",
    description: "The curve of the opening",
    default: "cubic-bezier(0.2, 0, 0.2, 1)",
  },
  {
    name: "--image-zoom-easing-out",
    description: "The curve of the closing",
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  {
    name: "--image-zoom-controls-duration",
    description:
      "The fade of the buttons and the caption, after most of the zoom; three quarters of it when closing",
    default: "40% of the zoom",
  },
  {
    name: "--image-zoom-controls-easing",
    description: "Its curve",
    default: "ease-out in, ease-in out",
  },
  {
    name: "--image-zoom-slide-duration",
    description: "The glide to the next image with the arrows and keys",
    default: "400ms",
  },
  {
    name: "--image-zoom-slide-easing",
    description: "Its easing",
    default: "cubic-bezier(0.2, 0, 0, 1)",
  },
  {
    name: "--image-zoom-caption-duration",
    description:
      "The caption of each new image in a gallery coming in, and its rise on opening; 0s changes it at once",
    default: "the slide",
  },
  {
    name: "--image-zoom-caption-easing",
    description: "Its curve",
    default: "the curve of the slide",
  },
  {
    name: "--image-zoom-caption-enter-opacity",
    description: "The opacity a new caption starts from",
    default: "0",
  },
  {
    name: "--image-zoom-caption-enter-x",
    description:
      "A parallax: how far to the side a new caption starts, the side its image comes from",
    default: "0px",
  },
  {
    name: "--image-zoom-caption-enter-y",
    description:
      "A rise: how far below a new caption starts (above at the top), also on opening",
    default: "0px",
  },
];

// Parts of the overlay, for ::part()
export const parts: ReferenceRow[] = [
  { name: "overlay", description: "The `<dialog>`" },
  { name: "backdrop", description: "The background behind the image" },
  { name: "track", description: "The carousel that holds the slides" },
  { name: "slide, image", description: "Each slide and its image" },
  { name: "caption", description: "The caption" },
  { name: "close", description: "The close button" },
  { name: "toolbar", description: "The navigation bar" },
  { name: "nav, prev, next", description: "The arrows (`nav` matches both)" },
  { name: "counter", description: "The position in the gallery" },
];

// Props of <ImageZoom>
export const props: ReferenceRow[] = [
  {
    name: "theme",
    description:
      "The colors of this gallery: `backgroundColor`, `closeButtonColor`, `closeButtonBackground`, `navigationColor`, `navigationBackground`, `captionColor` and `captionBackground`",
    type: "object",
    default: "{}",
  },
  {
    name: "animationDuration",
    description: "Milliseconds; overrides `--image-zoom-animation-duration`",
    type: "number",
    default: "300",
  },
  {
    name: "animation",
    description:
      "How the image opens and closes: it grows from its thumbnail, or fades in where it lands",
    type: '"zoom" | "fade"',
    default: '"zoom"',
  },
  {
    name: "showNavigation",
    description:
      "Arrows and counter in galleries; keys and swipes work without them",
    type: "boolean",
    default: "true",
  },
  {
    name: "navigationLayout",
    description:
      "Arrows and counter in a bar at the bottom, or arrows at the sides of the screen",
    type: '"bar" | "sides"',
    default: '"bar"',
  },
  {
    name: "showCounter",
    description: "Position in the gallery, such as “3 / 8”",
    type: "boolean",
    default: "true",
  },
  {
    name: "showCaption",
    description: "Caption of the zoomed image",
    type: "boolean",
    default: "true",
  },
  {
    name: "captionPosition",
    description: "Where the caption sits on the screen",
    type: '"bottom" | "top"',
    default: '"bottom"',
  },
  {
    name: "ignore",
    description:
      "Images left out of the zoom and the gallery: simple selectors (tag, `.class`, `#id`, `[attribute]`) matched on each image and the elements around it",
    type: "string",
    default: '""',
  },
  {
    name: "labels",
    description:
      "Texts read by screen readers, key by key; the keys you leave out stay in English",
    type: "Partial<ImageZoomLabels>",
    default: "English",
  },
  {
    name: "closeOnBackdrop",
    description: "A click beside the image closes it",
    type: "boolean",
    default: "true",
  },
  {
    name: "closeOnImage",
    description: "A click on the image closes it",
    type: "boolean",
    default: "true",
  },
  {
    name: "closeOnScroll",
    description: "A wheel or touchpad scroll, or a vertical swipe, closes it",
    type: "boolean",
    default: "true",
  },
  {
    name: "class",
    description: "Class for the `<astro-image-zoom>` element",
    type: "string",
  },
];

// Attributes of each image
export const attributes: ReferenceRow[] = [
  {
    name: "data-image-zoom-src",
    description:
      "Full-size image for the zoom. Needed when the file on the page is a smaller version",
  },
  {
    name: "data-image-zoom-caption",
    description:
      "Caption shown with the zoomed image; on the `<a>` itself for a link with `data-image-zoom`, where its `title` works too",
  },
  {
    name: "data-image-zoom",
    description:
      "On an `<a href>` around an image: the zoom opens its `href`. The component leaves the link as it is",
  },
  {
    name: "data-image-zoom-ignore",
    description:
      "On an image or any element around it: left out of the zoom and the gallery, like the `ignore` prop for a single image",
  },
];

// Keys of the labels prop, all of them aria-labels
export const labels: ReferenceRow[] = [
  { name: "overlay", description: "The dialog", default: "Image zoom overlay" },
  {
    name: "close",
    description: "The close button",
    default: "Close zoom overlay",
  },
  { name: "images", description: "The group of images", default: "Images" },
  {
    name: "previous",
    description: "The previous image button",
    default: "Previous image",
  },
  { name: "next", description: "The next image button", default: "Next image" },
  {
    name: "enlarge",
    description: "The link the component adds around an image with no alt text",
    default: "Enlarge image",
  },
  {
    name: "enlargeNamed",
    description:
      "The link the component adds around an image; `{alt}` is replaced with its alt text",
    default: "Enlarge image: {alt}",
  },
];

// Events dispatched by each <astro-image-zoom>; they bubble
export const events: ReferenceRow[] = [
  {
    name: "astro-image-zoom:open",
    description:
      "A zoom starts to open (a click, Enter on a link), before its image has loaded",
  },
  {
    name: "astro-image-zoom:change",
    description:
      "The gallery moves to another image (arrows, keys, a swipe). Not dispatched on open",
  },
  {
    name: "astro-image-zoom:close",
    description: "The zoom starts to close, however it closes",
  },
  {
    name: "astro-image-zoom:closed",
    description:
      "The zoom has closed: the closing animation has ended and the image is back on the page",
  },
];

// The detail of every event: the image on screen
export const eventDetail: ReferenceRow[] = [
  {
    name: "index",
    description: "Position of the image in its gallery, from 0",
    type: "number",
  },
  {
    name: "total",
    description: "Number of images in the gallery",
    type: "number",
  },
  {
    name: "src",
    description: "URL of the image the zoom shows",
    type: "string",
  },
  { name: "alt", description: "Alt text of the image", type: "string" },
  {
    name: "caption",
    description: "Caption, or an empty string",
    type: "string",
  },
  {
    name: "link",
    description: "The link on the page that opens this image",
    type: "HTMLElement",
  },
];
