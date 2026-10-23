import type { PhotoName } from "@data/photos";

/**
 * Ready-to-copy themes made of --image-zoom-* variables, shown live on the overview with their CSS.
 * Variables work per gallery, so each theme is one class on one <ImageZoom>; ::part() would style
 * every gallery of the page, as the overlay is shared. Every color is a light-dark() pair: the
 * overlay follows the light or dark preference of the system, as the site does. The buttons and
 * the caption sit over the photo and blur it: their backgrounds are glass(), mostly opaque, so
 * their text keeps its contrast over a black or a white picture alike
 */
interface Timing {
  duration: number;
  easing?: string;
}

/** How each new caption comes in: --image-zoom-caption-* (the glide of the images by default) */
interface CaptionMotion {
  duration?: number;
  easing?: string;
  /** Where it starts: its opacity, a parallax from the side of the image, a rise into place */
  opacity?: number;
  x?: string;
  y?: string;
}

export interface Theme {
  value: string;
  name: string;
  /** The kind of site it suits */
  description: string;
  photos: [Exclude<PhotoName, "blueMarble">, Exclude<PhotoName, "blueMarble">];
  /** Text color of its card on the overview; not part of the theme */
  ink: string;
  /**
   * The zoom, its curves in and out, the glide to the next image and the caption that comes with
   * it: one feel for everything that moves
   */
  motion: {
    label: string;
    duration: number;
    in?: string;
    out?: string;
    slide?: Timing;
    /** How the close button and the navigation fade in and out */
    controls?: Timing;
    caption?: CaptionMotion;
  };
  /** How the image comes in, and where the caption and the arrows go: props of <ImageZoom>, not
   * variables */
  layout?: {
    animation?: "zoom" | "fade";
    captionPosition?: "top" | "bottom";
    navigationLayout?: "bar" | "sides";
    showCounter?: boolean;
  };
  vars: Record<`--image-zoom-${string}`, string>;
}

const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const QUART = "cubic-bezier(0.25, 1, 0.5, 1)";
const BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";
// A spring that overshoots once and settles by the end: a long, still tail would leave the crop of the
// thumbnail unfolding after the image has stopped
const SPRING =
  "linear(0, 0.041 3%, 0.143 6%, 0.283 9%, 0.438 12%, 0.642 16%, 0.819 20%, 0.984 25%, 1.082 30%, 1.122 35%, 1.122 40%, 1.093 46%, 1.054 52%, 1.020 58%, 0.995 65%, 0.985 72%, 0.986 80%, 0.994 90%, 1)";

const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const MONOSPACE = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

// The controls of a theme: the close button and the navigation share their colors
const controls = (color: string, background: string) => ({
  "--image-zoom-close-color": color,
  "--image-zoom-close-bg": background,
  "--image-zoom-nav-color": color,
  "--image-zoom-nav-bg": background,
});

const themes: Theme[] = [
  {
    value: "darkroom",
    name: "Darkroom",
    description:
      "For photographers: nothing but the picture, almost edge to edge on white or black, no counter, and controls that fade in slowly.",
    photos: ["antennae", "magellanicStorm"],
    ink: "light-dark(#111111, #f2f2f2)",
    motion: {
      label: "Expo fade",
      duration: 500,
      in: EXPO,
      out: "cubic-bezier(0.7, 0, 0.84, 0)",
      slide: { duration: 600, easing: EXPO },
      controls: { duration: 700, easing: EXPO },
      caption: { duration: 400 },
    },
    layout: {
      animation: "fade",
      navigationLayout: "sides",
      showCounter: false,
    },
    vars: {
      "--image-zoom-bg": "light-dark(#ffffff, #000000)",
      ...controls(
        "light-dark(#111111, #f2f2f2)",
        "light-dark(#ececec, #262626)",
      ),
      "--image-zoom-caption-color": "light-dark(#111111, #f2f2f2)",
      "--image-zoom-caption-bg": "light-dark(#ffffff, #1a1a1a)",
      "--image-zoom-caption-font-size": "12px",
      "--image-zoom-caption-radius": "999px",
      "--image-zoom-button-size": "36px",
      "--image-zoom-button-radius": "999px",
      "--image-zoom-padding": "2vmin",
      "--image-zoom-image-radius": "0px",
      "--image-zoom-controls-offset": "16px",
    },
  },
  {
    value: "editorial",
    name: "Editorial",
    description:
      "For long reads: cream paper or a dark page, a serif caption set like a printed one above the photo, wide margins and a claret accent.",
    photos: ["johnson1962", "johnson1980"],
    ink: "light-dark(#1f1a17, #efe6d8)",
    motion: {
      label: "Quart",
      duration: 600,
      in: QUART,
      out: "cubic-bezier(0.5, 0, 0.75, 0)",
      slide: { duration: 600, easing: QUART },
      caption: { x: "120px" },
    },
    layout: { captionPosition: "top" },
    vars: {
      "--image-zoom-bg": "light-dark(#f6f1e7, #1b1714)",
      ...controls(
        "light-dark(#ffffff, #1b1714)",
        "light-dark(#7a1f2b, #e8a8a0)",
      ),
      "--image-zoom-caption-color": "light-dark(#1f1a17, #efe6d8)",
      "--image-zoom-caption-bg": "light-dark(#f6f1e7, #1b1714)",
      "--image-zoom-caption-font": SERIF,
      "--image-zoom-caption-font-size": "17px",
      "--image-zoom-caption-max-width": "560px",
      "--image-zoom-caption-radius": "0px",
      "--image-zoom-button-size": "40px",
      "--image-zoom-button-radius": "0px",
      "--image-zoom-controls-offset": "20px",
      "--image-zoom-padding": "10vmin",
      "--image-zoom-image-radius": "0px",
    },
  },
  {
    value: "museum",
    name: "Museum",
    description:
      "For art and archives: a warm grey or deep green wall, a lot of room around the picture, a small label plate and brass controls, in no hurry.",
    photos: ["roseGalaxies", "mcclainSelfie"],
    ink: "light-dark(#2b2a26, #e9e2cf)",
    motion: {
      label: "Slow quart",
      duration: 750,
      in: QUART,
      out: "cubic-bezier(0.5, 0, 0.75, 0)",
      slide: { duration: 800, easing: QUART },
      caption: { duration: 500, y: "6px" },
    },
    layout: { navigationLayout: "sides", showCounter: false },
    vars: {
      "--image-zoom-bg": "light-dark(#e6e1d6, #1c2621)",
      ...controls(
        "light-dark(#ffffff, #1c2621)",
        "light-dark(#5e4818, #d4b26a)",
      ),
      "--image-zoom-caption-color": "light-dark(#2b2a26, #1c2621)",
      "--image-zoom-caption-bg": "light-dark(#fbf8f1, #f4efe2)",
      "--image-zoom-caption-font": SERIF,
      "--image-zoom-caption-font-size": "13px",
      "--image-zoom-caption-max-width": "320px",
      "--image-zoom-caption-radius": "2px",
      "--image-zoom-button-size": "40px",
      "--image-zoom-button-radius": "2px",
      "--image-zoom-controls-offset": "24px",
      "--image-zoom-padding": "12vmin",
      "--image-zoom-image-radius": "0px",
    },
  },
  {
    value: "blueprint",
    name: "Blueprint",
    description:
      "For maps, diagrams and technical docs: blueprint blue, monospaced labels, a counter to keep your place and a quick, mechanical zoom.",
    photos: ["curiosityRoute", "mountSharpPath"],
    ink: "light-dark(#0b3d91, #dbe8ff)",
    motion: {
      label: "Mechanical",
      duration: 220,
      in: "cubic-bezier(0.2, 0, 0, 1)",
      out: "cubic-bezier(0.3, 0, 1, 1)",
      slide: { duration: 200, easing: "linear" },
      caption: { duration: 0 },
    },
    vars: {
      "--image-zoom-bg": "light-dark(#e8f0fb, #0a2a5e)",
      ...controls(
        "light-dark(#ffffff, #0a2a5e)",
        "light-dark(#0b3d91, #dbe8ff)",
      ),
      "--image-zoom-caption-color": "light-dark(#0b3d91, #ffffff)",
      "--image-zoom-caption-bg": "light-dark(#ffffff, #0d3a7a)",
      "--image-zoom-caption-font": MONOSPACE,
      "--image-zoom-caption-font-size": "12px",
      "--image-zoom-caption-radius": "2px",
      "--image-zoom-button-size": "36px",
      "--image-zoom-button-radius": "2px",
      "--image-zoom-controls-offset": "16px",
      "--image-zoom-padding": "5vmin",
      "--image-zoom-image-radius": "0px",
    },
  },
  {
    value: "arcade",
    name: "Arcade",
    description:
      "Hot pink, cyan and yellow on deep purple, square pixels and a zoom in five frames, like an 8-bit game.",
    photos: ["jupiterAuroras", "uranusAuroras"],
    ink: "light-dark(#7a0a52, #ff7ac4)",
    motion: {
      label: "8-bit steps",
      duration: 450,
      in: "steps(5, jump-none)",
      out: "steps(5, jump-none)",
      slide: { duration: 360, easing: "steps(4, jump-none)" },
      controls: { duration: 200, easing: "steps(2, jump-none)" },
      caption: { duration: 0 },
    },
    layout: { captionPosition: "top", navigationLayout: "sides" },
    vars: {
      "--image-zoom-bg": "light-dark(#fff0fa, #16062c)",
      "--image-zoom-close-color": "light-dark(#ffffff, #1a0628)",
      "--image-zoom-close-bg": "light-dark(#a80e5f, #ff5cb8)",
      "--image-zoom-nav-color": "light-dark(#ffffff, #1a0628)",
      "--image-zoom-nav-bg": "light-dark(#075560, #3ee6f5)",
      "--image-zoom-caption-color": "light-dark(#ffe74c, #1a0628)",
      "--image-zoom-caption-bg": "light-dark(#3b0a5c, #ffe74c)",
      "--image-zoom-caption-font": MONOSPACE,
      "--image-zoom-caption-font-size": "12px",
      "--image-zoom-caption-radius": "0px",
      "--image-zoom-button-size": "48px",
      "--image-zoom-button-radius": "0px",
      "--image-zoom-padding": "5vmin",
      "--image-zoom-image-radius": "0px",
    },
  },
  {
    value: "bubblegum",
    name: "Bubblegum",
    description:
      "Playful and soft: candy pink or plum, big round buttons, round photos and a springy zoom that overshoots and settles.",
    photos: ["candyBag", "hadfieldGuitar"],
    ink: "light-dark(#8a1458, #ffb3dc)",
    motion: {
      label: "Spring",
      duration: 400,
      in: SPRING,
      slide: { duration: 400, easing: BACK },
      caption: { duration: 400, easing: BACK, y: "20px" },
    },
    layout: { navigationLayout: "sides" },
    vars: {
      "--image-zoom-bg": "light-dark(#ffe4f1, #2a0f2e)",
      ...controls(
        "light-dark(#ffffff, #2a0f2e)",
        "light-dark(#ad1457, #ffb3dc)",
      ),
      "--image-zoom-caption-color": "light-dark(#4a0d33, #2a0f2e)",
      "--image-zoom-caption-bg": "light-dark(#ffffff, #fff0f7)",
      "--image-zoom-caption-font-size": "15px",
      "--image-zoom-caption-radius": "999px",
      "--image-zoom-button-size": "56px",
      "--image-zoom-button-radius": "999px",
      "--image-zoom-controls-offset": "28px",
      "--image-zoom-padding": "7vmin",
      "--image-zoom-image-radius": "28px",
    },
  },
];

// The backgrounds the overlay blurs the photo behind: each hex color at 82% opacity, enough to show
// the blur and to keep the contrast of the text over any picture (checked against black and white)
const GLASS = 0.82;
const BLURRED = [
  "--image-zoom-close-bg",
  "--image-zoom-nav-bg",
  "--image-zoom-caption-bg",
];
const glass = (value: string) =>
  value.replace(
    /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/gi,
    (_, r: string, g: string, b: string) =>
      `rgb(${[r, g, b].map((hex) => Number.parseInt(hex, 16)).join(" ")} / ${GLASS})`,
  );

/** Each theme with its motion added to its variables, and the CSS to copy */
export const themeList = themes.map((theme) => {
  const {
    duration,
    in: easingIn,
    out: easingOut,
    slide,
    controls: fade,
    caption,
  } = theme.motion;
  const vars: Record<`--image-zoom-${string}`, string> = {
    ...Object.fromEntries(
      Object.entries(theme.vars).map(([name, value]) => [
        name,
        BLURRED.includes(name) ? glass(value) : value,
      ]),
    ),
    "--image-zoom-animation-duration": `${duration}ms`,
    ...(easingIn && { "--image-zoom-easing-in": easingIn }),
    ...(easingOut && { "--image-zoom-easing-out": easingOut }),
    ...(slide && { "--image-zoom-slide-duration": `${slide.duration}ms` }),
    ...(slide?.easing && { "--image-zoom-slide-easing": slide.easing }),
    ...(fade && { "--image-zoom-controls-duration": `${fade.duration}ms` }),
    ...(fade?.easing && { "--image-zoom-controls-easing": fade.easing }),
    ...(caption?.duration !== undefined && {
      "--image-zoom-caption-duration": `${caption.duration}ms`,
    }),
    ...(caption?.easing && { "--image-zoom-caption-easing": caption.easing }),
    ...(caption?.opacity !== undefined && {
      "--image-zoom-caption-enter-opacity": String(caption.opacity),
    }),
    ...(caption?.x && { "--image-zoom-caption-enter-x": caption.x }),
    ...(caption?.y && { "--image-zoom-caption-enter-y": caption.y }),
  };
  const props = Object.entries(theme.layout ?? {})
    .map(([name, value]) =>
      typeof value === "string" ? ` ${name}="${value}"` : ` ${name}={${value}}`,
    )
    .join("");
  const css = `.${theme.value} {\n${Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n")}\n}\n\n/* <ImageZoom class="${theme.value}"${props}> */`;
  return { ...theme, vars, css };
});
