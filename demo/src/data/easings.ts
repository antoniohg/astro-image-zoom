// Ready-made curves for --image-zoom-easing-in and --image-zoom-easing-out, shared by the playground and the
// Animation chapter of the docs; a missing one keeps the default of the overlay. Each comes with
// the duration it reads best at. Curves that end past their target only open: on the way out they
// would shrink past the thumbnail
export interface Easing {
  value: string;
  label: string;
  description: string;
  in?: string;
  out?: string;
  /** Milliseconds, for --image-zoom-animation-duration */
  duration: number;
}

export const easings: Easing[] = [
  {
    value: "snappy",
    label: "Snappy",
    description:
      "Leaves fast and settles slowly, like the motion of Material 3.",
    in: "cubic-bezier(0.05, 0.7, 0.1, 1)",
    out: "cubic-bezier(0.3, 0, 0.8, 0.15)",
    duration: 400,
  },
  {
    value: "back",
    label: "Back",
    description:
      "Grows past the screen and comes back; on the way out, it winds up before it shrinks.",
    in: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    out: "cubic-bezier(0.36, 0, 0.66, -0.56)",
    duration: 600,
  },
  {
    value: "spring",
    label: "Spring",
    description: "Wobbles into place, with a linear() curve.",
    in: "linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)",
    duration: 900,
  },
  {
    value: "bounce",
    label: "Bounce",
    description:
      "Lands like a ball, on the screen and back on the thumbnail. Never past either.",
    in: "linear(0, 0.01, 0.04, 0.09, 0.16, 0.25, 0.36, 0.49, 0.64, 0.81, 1 36.4%, 0.891, 0.813, 0.766, 0.75 54.5%, 0.766, 0.813, 0.891, 1 72.7%, 0.953, 0.938 81.8%, 0.953, 1 90.9%, 0.988, 0.984 95.5%, 0.988, 1)",
    out: "linear(0, 0.01, 0.04, 0.09, 0.16, 0.25, 0.36, 0.49, 0.64, 0.81, 1 36.4%, 0.891, 0.813, 0.766, 0.75 54.5%, 0.766, 0.813, 0.891, 1 72.7%, 0.953, 0.938 81.8%, 0.953, 1 90.9%, 0.988, 0.984 95.5%, 0.988, 1)",
    duration: 1000,
  },
  {
    value: "cinematic",
    label: "Cinematic",
    description: "A long, slow glide that eases all the way in.",
    in: "cubic-bezier(0.16, 1, 0.3, 1)",
    out: "cubic-bezier(0.7, 0, 0.84, 0)",
    duration: 1200,
  },
  {
    value: "stop-motion",
    label: "Stop motion",
    description: "Six frames and no tweening, like a flip book.",
    in: "steps(6, jump-none)",
    out: "steps(6, jump-none)",
    duration: 700,
  },
];

/** The variables of an easing, to set around a gallery */
export const easingVariables = ({
  in: easingIn,
  out: easingOut,
  duration,
}: Easing) => ({
  "--image-zoom-animation-duration": `${duration}ms`,
  ...(easingIn && { "--image-zoom-easing-in": easingIn }),
  ...(easingOut && { "--image-zoom-easing-out": easingOut }),
});
