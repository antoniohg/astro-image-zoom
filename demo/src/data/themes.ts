import type { PhotoName } from "@data/photos";

/**
 * Ready-to-copy themes made only of --image-zoom-* variables, shown live on the overview with their CSS
 * and listed in the docs. Variables work per gallery, so each theme is one class around one
 * <ImageZoom>; ::part() would style every gallery of the page, as the overlay is shared. Every color
 * is a light-dark() pair: the overlay follows the light or dark preference of the system, as the
 * site does. The buttons and the caption sit over the photo and blur it: their backgrounds are
 * glass(), mostly opaque, so their text keeps its contrast over a black or a white picture alike
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
  /** Playful themes, listed after the everyday ones */
  fun?: boolean;
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
const SNAPPY = "cubic-bezier(0.05, 0.7, 0.1, 1)";
const SMOOTH = "cubic-bezier(0.22, 1, 0.36, 1)";
const GENTLE_BACK = "cubic-bezier(0.34, 1.3, 0.64, 1)";
const BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SPRING =
  "linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)";
const BOUNCE =
  "linear(0, 0.01, 0.04, 0.09, 0.16, 0.25, 0.36, 0.49, 0.64, 0.81, 1 36.4%, 0.891, 0.813, 0.766, 0.75 54.5%, 0.766, 0.813, 0.891, 1 72.7%, 0.953, 0.938 81.8%, 0.953, 1 90.9%, 0.988, 0.984 95.5%, 0.988, 1)";

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
      "For photographers: nothing but the picture, on white or on black, fading in with quiet controls.",
    photos: ["antennae", "magellanicStorm"],
    ink: "light-dark(#111111, #f2f2f2)",
    motion: {
      label: "Expo",
      duration: 500,
      in: EXPO,
      out: "cubic-bezier(0.7, 0, 0.84, 0)",
      slide: { duration: 600, easing: EXPO },
      caption: { duration: 400 },
    },
    layout: { animation: "fade", navigationLayout: "sides" },
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
      "--image-zoom-button-size": "40px",
      "--image-zoom-button-radius": "999px",
      "--image-zoom-padding": "3vmin",
      "--image-zoom-image-radius": "0px",
      "--image-zoom-controls-offset": "24px",
    },
  },
  {
    value: "magazine",
    name: "Magazine",
    description:
      "For long reads: warm paper or a dark page, a serif caption and a wide margin around the photo.",
    photos: ["johnson1962", "johnson1980"],
    ink: "light-dark(#1a1a1a, #f1ece4)",
    motion: {
      label: "Quart",
      duration: 550,
      in: QUART,
      out: "cubic-bezier(0.5, 0, 0.75, 0)",
      slide: { duration: 550, easing: QUART },
      caption: { x: "120px" },
    },
    layout: { captionPosition: "top" },
    vars: {
      "--image-zoom-bg": "light-dark(#faf7f2, #161412)",
      ...controls(
        "light-dark(#1a1a1a, #f1ece4)",
        "light-dark(#ebe4d8, #2e2a25)",
      ),
      "--image-zoom-caption-color": "light-dark(#1a1a1a, #f1ece4)",
      "--image-zoom-caption-bg": "light-dark(#faf7f2, #221f1b)",
      "--image-zoom-caption-font": SERIF,
      "--image-zoom-caption-font-size": "15px",
      "--image-zoom-caption-radius": "0px",
      "--image-zoom-button-size": "40px",
      "--image-zoom-button-radius": "0px",
      "--image-zoom-controls-offset": "20px",
      "--image-zoom-padding": "8vmin",
      "--image-zoom-image-radius": "0px",
    },
  },
  {
    value: "storefront",
    name: "Storefront",
    description:
      "For products: a clean white or zinc stage, solid pill buttons and softly rounded photos.",
    photos: ["mcclainSelfie", "cupola"],
    ink: "light-dark(#18181b, #fafafa)",
    motion: {
      label: "Snappy",
      duration: 350,
      in: SNAPPY,
      out: "cubic-bezier(0.3, 0, 0.8, 0.15)",
      slide: { duration: 300, easing: SNAPPY },
      caption: { x: "64px" },
    },
    layout: { navigationLayout: "sides" },
    vars: {
      "--image-zoom-bg": "light-dark(#ffffff, #18181b)",
      ...controls(
        "light-dark(#ffffff, #18181b)",
        "light-dark(#18181b, #fafafa)",
      ),
      "--image-zoom-caption-color": "light-dark(#ffffff, #18181b)",
      "--image-zoom-caption-bg": "light-dark(#18181b, #fafafa)",
      "--image-zoom-caption-radius": "999px",
      "--image-zoom-button-size": "44px",
      "--image-zoom-button-radius": "999px",
      "--image-zoom-controls-offset": "20px",
      "--image-zoom-padding": "6vmin",
      "--image-zoom-image-radius": "12px",
    },
  },
  {
    value: "midnight",
    name: "Midnight",
    description:
      "For apps and dashboards: cool grey or deep navy, an indigo accent and rounded cards.",
    photos: ["apollo11Control", "apollo13Control"],
    ink: "light-dark(#3730a3, #c7d2fe)",
    motion: {
      label: "Smooth",
      duration: 400,
      in: SMOOTH,
      out: "cubic-bezier(0.64, 0, 0.78, 0)",
      slide: { duration: 450, easing: SMOOTH },
      caption: { duration: 350, easing: SMOOTH, y: "8px" },
    },
    layout: { captionPosition: "top" },
    vars: {
      "--image-zoom-bg": "light-dark(#f4f6fb, #0b1020)",
      ...controls(
        "light-dark(#3730a3, #c7d2fe)",
        "light-dark(#e0e3ff, #222b52)",
      ),
      "--image-zoom-caption-color": "light-dark(#1e2240, #e6e9f5)",
      "--image-zoom-caption-bg": "light-dark(#ffffff, #1a2135)",
      "--image-zoom-caption-radius": "12px",
      "--image-zoom-button-size": "44px",
      "--image-zoom-button-radius": "12px",
      "--image-zoom-padding": "4vmin",
      "--image-zoom-image-radius": "16px",
    },
  },
  {
    value: "linen",
    name: "Linen",
    description:
      "For personal blogs: linen or espresso, terracotta buttons and round shapes that settle gently.",
    photos: ["curiositySelfie", "niliDunes"],
    ink: "light-dark(#8a3818, #f0a47a)",
    motion: {
      label: "Gentle back",
      duration: 500,
      in: GENTLE_BACK,
      slide: { duration: 550, easing: GENTLE_BACK },
      caption: { duration: 400, easing: GENTLE_BACK, y: "10px" },
    },
    vars: {
      "--image-zoom-bg": "light-dark(#f6f1ea, #1d1916)",
      ...controls(
        "light-dark(#ffffff, #2a1408)",
        "light-dark(#86361a, #f0a47a)",
      ),
      "--image-zoom-caption-color": "light-dark(#fff8f2, #2a1408)",
      "--image-zoom-caption-bg": "light-dark(#86361a, #f0a47a)",
      "--image-zoom-caption-font-size": "14px",
      "--image-zoom-caption-radius": "999px",
      "--image-zoom-button-size": "46px",
      "--image-zoom-button-radius": "999px",
      "--image-zoom-padding": "5vmin",
      "--image-zoom-image-radius": "24px",
    },
  },
  {
    value: "docs",
    name: "Docs",
    description:
      "For documentation, maps and diagrams: the look of a docs site, a blue accent, monospaced captions and a quick zoom.",
    photos: ["curiosityRoute", "mountSharpPath"],
    ink: "light-dark(#1d4ed8, #93c5fd)",
    motion: {
      label: "Default curve",
      duration: 250,
      slide: { duration: 250 },
      caption: { duration: 0 },
    },
    layout: { navigationLayout: "sides" },
    vars: {
      "--image-zoom-bg": "light-dark(#ffffff, #0f1115)",
      ...controls(
        "light-dark(#1e3a8a, #bfdbfe)",
        "light-dark(#e3ebfd, #1e3a5f)",
      ),
      "--image-zoom-caption-color": "light-dark(#0f172a, #e2e8f0)",
      "--image-zoom-caption-bg": "light-dark(#f1f5f9, #1e293b)",
      "--image-zoom-caption-font": MONOSPACE,
      "--image-zoom-caption-font-size": "12px",
      "--image-zoom-caption-radius": "8px",
      "--image-zoom-button-size": "36px",
      "--image-zoom-button-radius": "8px",
      "--image-zoom-padding": "6vmin",
      "--image-zoom-image-radius": "8px",
    },
  },
  {
    value: "arcade",
    name: "Arcade",
    description:
      "Hot pink, cyan and yellow on deep purple, square pixels and a zoom in five frames, like an 8-bit game.",
    fun: true,
    photos: ["jupiterAuroras", "uranusAuroras"],
    ink: "light-dark(#7a0a52, #ff7ac4)",
    motion: {
      label: "8-bit steps",
      duration: 450,
      in: "steps(5, jump-none)",
      out: "steps(5, jump-none)",
      slide: { duration: 360, easing: "steps(4, jump-none)" },
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
    value: "terminal",
    name: "Terminal",
    description:
      "Green phosphor on black, or green ink on pale paper: a 1960s computer room, monospaced to the last label.",
    fun: true,
    photos: ["ibmInstall", "dataProcessing"],
    ink: "light-dark(#0b5d27, #39ff7a)",
    motion: {
      label: "Snappy",
      duration: 300,
      in: SNAPPY,
      out: "cubic-bezier(0.3, 0, 0.8, 0.15)",
      slide: { duration: 240, easing: "steps(3, jump-none)" },
      caption: { duration: 0 },
    },
    layout: { captionPosition: "top" },
    vars: {
      "--image-zoom-bg": "light-dark(#eef7ee, #030a05)",
      ...controls(
        "light-dark(#06441c, #39ff7a)",
        "light-dark(#d3ead6, #0d2a16)",
      ),
      "--image-zoom-caption-color": "light-dark(#06441c, #39ff7a)",
      "--image-zoom-caption-bg": "light-dark(#d3ead6, #0d2a16)",
      "--image-zoom-caption-font": MONOSPACE,
      "--image-zoom-caption-font-size": "12px",
      "--image-zoom-caption-radius": "2px",
      "--image-zoom-button-size": "40px",
      "--image-zoom-button-radius": "2px",
      "--image-zoom-padding": "5vmin",
      "--image-zoom-image-radius": "2px",
      "--image-zoom-controls-offset": "0px",
      "--image-zoom-caption-max-width": "100%",
    },
  },
  {
    value: "comic",
    name: "Comic",
    description:
      "Black on yellow, or yellow on black, like a comic strip: big square buttons, a white speech-bubble caption and a bouncing zoom.",
    fun: true,
    photos: ["snoopyConsole", "hadfieldGuitar"],
    ink: "light-dark(#111111, #ffde33)",
    motion: {
      label: "Bounce",
      duration: 900,
      in: BOUNCE,
      slide: { duration: 500, easing: BACK },
      caption: { duration: 700, easing: BOUNCE, y: "16px" },
    },
    layout: { captionPosition: "top", navigationLayout: "sides" },
    vars: {
      "--image-zoom-bg": "light-dark(#ffde33, #111111)",
      ...controls(
        "light-dark(#ffde33, #111111)",
        "light-dark(#111111, #ffde33)",
      ),
      "--image-zoom-caption-color": "#111111",
      "--image-zoom-caption-bg": "#ffffff",
      "--image-zoom-caption-font-size": "15px",
      "--image-zoom-caption-radius": "0px",
      "--image-zoom-button-size": "52px",
      "--image-zoom-button-radius": "0px",
      "--image-zoom-controls-offset": "28px",
      "--image-zoom-padding": "6vmin",
      "--image-zoom-image-radius": "0px",
    },
  },
  {
    value: "bubblegum",
    name: "Bubblegum",
    description:
      "Candy pink, very round and a little springy: for anything that should feel sweet.",
    fun: true,
    photos: ["roseGalaxies", "candyBag"],
    ink: "light-dark(#a3125f, #ff9ccf)",
    motion: {
      label: "Spring",
      duration: 800,
      in: SPRING,
      slide: { duration: 700, easing: SPRING },
      caption: { x: "120px", y: "12px" },
    },
    layout: { captionPosition: "top", showCounter: false },
    vars: {
      "--image-zoom-bg": "light-dark(#ffe8f3, #2b0e22)",
      ...controls(
        "light-dark(#ffffff, #2b0e22)",
        "light-dark(#a8105f, #ff8cc6)",
      ),
      "--image-zoom-caption-color": "light-dark(#5a0f3c, #2b0e22)",
      "--image-zoom-caption-bg": "light-dark(#ffffff, #ffd1e8)",
      "--image-zoom-caption-font-size": "14px",
      "--image-zoom-caption-radius": "999px",
      "--image-zoom-button-size": "52px",
      "--image-zoom-button-radius": "999px",
      "--image-zoom-padding": "5vmin",
      "--image-zoom-image-radius": "32px",
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
