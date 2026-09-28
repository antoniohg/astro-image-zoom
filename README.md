# astro-image-zoom

[![npm version](https://img.shields.io/npm/v/astro-image-zoom/beta)](https://www.npmjs.com/package/astro-image-zoom)

The source of [astro-image-zoom](./packages/astro-image-zoom), a Medium-style image zoom for Astro,
and its demo site. For how to use the component, see the
[package README](./packages/astro-image-zoom/README.md).

## Structure

- **`packages/astro-image-zoom`**: the published package, with its tests.
- **`demo`**: the demo site, which uses the package from the workspace.

## Getting started

This project uses [pnpm workspaces](https://pnpm.io/workspaces) and the Node version in `.nvmrc`.

```bash
pnpm install
pnpm dev       # the demo at http://localhost:4321
pnpm build     # astro check and build the demo
pnpm preview   # serve the built demo
```

## Tests

The package carries its own tests, as the packages of Astro itself do: unit tests in
`packages/astro-image-zoom/test` and end-to-end tests in `packages/astro-image-zoom/e2e`. None of
them are published to npm, and none depend on the demo.

```bash
pnpm check       # type check (astro check)
pnpm test        # unit tests (Vitest)
pnpm test:e2e    # end-to-end tests (Playwright, in Chromium, Firefox and WebKit)
```

The first time, install the browsers for the end-to-end tests:

```bash
pnpm --filter astro-image-zoom exec playwright install chromium firefox webkit
```

### Unit tests

With Vitest, for the code that runs without a browser:

- `wrapImages.test.ts`: how the images of the slot become zoom links (sources, captions, links
  and `<picture>` elements, and which URLs are allowed).
- `ImageZoom.test.ts`: the HTML of the component, rendered with the Astro Container API: each prop
  as its `data-*` attribute, and `theme` and `animationDuration` as `--zoom-*` variables.
- `flipTransform.test.ts`: the math of the opening and closing animation (scale, translation and
  clip of a thumbnail, following its `object-fit` and `object-position`, even when its file is
  already cropped from the full image). A file stretched to another shape with `object-fit: fill`
  animates as with `cover`, since one uniform scale cannot follow it.

### End-to-end tests

With Playwright, against `e2e/fixture`: a small Astro site that installs the package from the
workspace, as any site would, with no styles of its own. Its home page has one `<ImageZoom>` per
case, each in a section with a stable id, with SVG images; `/hostile/` adds aggressive CSS and an
image optimized by Astro. The tests build the site and serve it with `astro preview` on port 4323.

- `zoom.spec.ts`: opening and closing (Escape, button, image, backdrop, wheel, while the image is
  still loading), the scale the animation starts and ends at over a cropped thumbnail, focus,
  gallery navigation, every option, theming and reduced motion.
- `a11y.spec.ts`: no axe violations, in light and dark mode, with the zoom closed and open in every
  layout: the component must be accessible with no help from the site.
- `isolation.spec.ts`: the CSS of the page cannot change the overlay, and its focus style reaches
  the generated links untouched.
- `no-js.spec.ts`: without JavaScript, each image links to its full-size version.

A new option or behavior gets a case in the fixture site and a test.

Some things still need a person: the smoothness of the animations, real touch and touchpad
gestures, and a screen reader.

### Continuous integration

GitHub Actions type-checks and runs both suites on every push to `main` and every pull request
([`.github/workflows/test.yml`](./.github/workflows/test.yml)). When the end-to-end tests fail, the
Playwright report is attached to the run.

## License

[MIT](./LICENSE)
