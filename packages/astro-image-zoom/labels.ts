/**
 * The texts the component reads to assistive technology. All of them are `aria-label`s: nothing
 * visible is translated. The defaults are English; the `labels` prop overrides them, key by key.
 */
export interface ImageZoomLabels {
  /** Name of the dialog */
  overlay: string;
  /** Close button */
  close: string;
  /** Name of the group of slides */
  images: string;
  /** Previous image button */
  previous: string;
  /** Next image button */
  next: string;
  /** Name of the link around an image with no alt text */
  enlarge: string;
  /** Name of the link around an image; `{alt}` is replaced with its alt text */
  enlargeNamed: string;
}

export const DEFAULT_LABELS: ImageZoomLabels = {
  overlay: "Image zoom overlay",
  close: "Close zoom overlay",
  images: "Images",
  previous: "Previous image",
  next: "Next image",
  enlarge: "Enlarge image",
  enlargeNamed: "Enlarge image: {alt}",
};
