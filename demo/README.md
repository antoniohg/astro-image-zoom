# astro-image-zoom demo

The demo site of [astro-image-zoom](../packages/astro-image-zoom), built with Astro. It uses the
package from the workspace (`workspace:*`), so changes to the package show up here at once.

## Pages

- `/`: overview, with live examples of every use case.
- `/docs/`: the documentation, with an example for each option and a CSS variable playground.
- `/defaults/`: the component with no site CSS, and a toggle (or `?hostile`) that loads aggressive
  CSS to check that the overlay stays isolated.

## Run it

From the root of the repository:

```sh
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # astro check && astro build
pnpm preview
```

## Photos

All photos come from the NASA Image and Video Library. Sources, credits and licenses are listed in
[PHOTOS.md](PHOTOS.md).
