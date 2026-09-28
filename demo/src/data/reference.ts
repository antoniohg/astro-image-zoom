/**
 * Reference lists of the docs: CSS variables, parts, props and image attributes. Text between
 * backticks in a description is shown as code.
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
    name: "--zoom-bg",
    description: "Overlay background",
    default: "light-dark(rgba(255, 255, 255, 0.98), rgba(0, 0, 0, 0.95))",
  },
  {
    name: "--zoom-close-color",
    description: "Close icon",
    default: "light-dark(rgba(0, 0, 0, 0.88), rgba(255, 255, 255, 0.92))",
  },
  {
    name: "--zoom-close-bg",
    description: "Close button, translucent over a blur",
    default: "light-dark(rgba(255, 255, 255, 0.75), rgba(28, 28, 30, 0.7))",
  },
  {
    name: "--zoom-nav-color",
    description: "Arrows and counter",
    default: "light-dark(rgba(0, 0, 0, 0.88), rgba(255, 255, 255, 0.92))",
  },
  {
    name: "--zoom-nav-bg",
    description: "Navigation bar (or each arrow in the sides layout), translucent over a blur",
    default: "light-dark(rgba(255, 255, 255, 0.75), rgba(28, 28, 30, 0.7))",
  },
  {
    name: "--zoom-caption-color",
    description: "Caption text",
    default: "light-dark(rgba(0, 0, 0, 0.88), rgba(255, 255, 255, 0.92))",
  },
  {
    name: "--zoom-caption-bg",
    description: "Caption box, translucent over a blur",
    default: "light-dark(rgba(255, 255, 255, 0.75), rgba(28, 28, 30, 0.7))",
  },
];

// Spacing, corners, controls and caption
export const layoutVariables: ReferenceRow[] = [
  {
    name: "--zoom-padding",
    description: "Space between the zoomed image and the screen edges",
    default: "0",
  },
  { name: "--zoom-image-radius", description: "Corners of the zoomed image", default: "0" },
  {
    name: "--zoom-button-size",
    description: "Size of the arrows and the close button",
    default: "40px (36px on phones)",
  },
  {
    name: "--zoom-button-radius",
    description: "Shape of the buttons and the navigation bar",
    default: "999px",
  },
  {
    name: "--zoom-controls-offset",
    description: "Distance from the controls and the caption to the screen edges",
    default: "16px (12px on phones)",
  },
  {
    name: "--zoom-caption-max-width",
    description: "Widest the caption can get",
    default: "70% (100% on phones)",
  },
  { name: "--zoom-caption-font", description: "Font family of the caption", default: "inherit" },
  {
    name: "--zoom-caption-font-size",
    description: "Font size of the caption",
    default: "13px (12px on phones)",
  },
  { name: "--zoom-caption-radius", description: "Corners of the caption box", default: "10px" },
];

// Color scheme and motion
export const otherVariables: ReferenceRow[] = [
  {
    name: "--zoom-color-scheme",
    description: "Set dark or light to follow your own theme toggle instead of the system",
    default: "light dark",
  },
  {
    name: "--zoom-animation-duration",
    description: "Zoom animation; the animationDuration prop wins over it",
    default: "300ms",
  },
  {
    name: "--zoom-slide-duration",
    description: "The glide to the next image with the arrows and keys",
    default: "400ms",
  },
  {
    name: "--zoom-slide-easing",
    description: "Its easing",
    default: "cubic-bezier(0.2, 0, 0, 1)",
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
    description: "Milliseconds; overrides `--zoom-animation-duration`",
    type: "number",
    default: "300",
  },
  {
    name: "showNavigation",
    description: "Arrows and counter in galleries",
    type: "boolean",
    default: "true",
  },
  {
    name: "navigationLayout",
    description: "Arrows and counter in a bar at the bottom, or arrows at the sides of the screen",
    type: "\"bar\" | \"sides\"",
    default: "\"bar\"",
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
    type: "\"bottom\" | \"top\"",
    default: "\"bottom\"",
  },
  {
    name: "ignore",
    description:
      "Images left out of the zoom and the gallery: simple selectors (tag, `.class`, `#id`, `[attribute]`) matched on each image and the elements around it",
    type: "string",
    default: "\"\"",
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
    description: "Scrolling or a vertical swipe closes it",
    type: "boolean",
    default: "true",
  },
  { name: "class", description: "Class for the `<astro-image-zoom>` element", type: "string" },
];

// Attributes of each image
export const attributes: ReferenceRow[] = [
  {
    name: "data-zoom-src",
    description: "Full-size image for the zoom. Needed when the image on the page is resized",
  },
  {
    name: "data-zoom-caption",
    description: "Caption shown with the zoomed image; on the `<a>` itself for a link with `data-zoom`",
  },
  {
    name: "data-zoom",
    description:
      "On an `<a href>` around an image: the zoom opens its `href`. The component leaves the link as it is",
  },
  {
    name: "data-zoom-ignore",
    description:
      "On an image or any element around it: left out of the zoom and the gallery, like the `ignore` prop for a single image",
  },
];
