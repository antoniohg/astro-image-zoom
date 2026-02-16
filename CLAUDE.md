# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**astro-zoom** — A Medium-style image zoom component for Astro. Zero dependencies, accessible, performant.

## Monorepo Structure

This is an npm workspaces monorepo:

- `packages/astro-zoom/` — The published component package (peer dep: astro ^4.0.0 || ^5.0.0)
- `demo/` — Astro demo site showcasing the component

## Commands

All root commands delegate to the demo workspace:

```bash
npm run dev       # Start demo dev server at http://localhost:4321
npm run build     # astro check && astro build (in demo/)
npm run preview   # Preview built demo
```

No test runner or linter is currently configured.

## Architecture

### Component Package (`packages/astro-zoom/`)

Three core files work together:

- **`Zoom.astro`** — Server-side Astro component. Accepts config props, processes slot HTML to wrap `<img>` tags in accessible `<a>` links, renders a shared global overlay `<dialog>`, and registers the custom element.
- **`zoom.ts`** — Client-side logic. Defines the `Zoom` class (image collection, open/close animations, keyboard/touch/scroll handlers, focus trap, gallery navigation) and `AstroZoomElement` custom element (`<astro-zoom>`).
- **`zoom.css`** — All styling. Uses CSS custom properties (`--zoom-bg`, `--zoom-close-color`, `--zoom-nav-color`, `--zoom-animation-duration`, `--zoom-z-index`) for theming. Includes light/dark mode and reduced-motion support.

**Key export paths** (defined in `package.json`):
- `astro-zoom` → `index.js` (re-exports zoom.ts)
- `astro-zoom/Zoom.astro` → component
- `astro-zoom/zoom.css` → styles

### Key Design Decisions

- **Global overlay**: A single `<dialog>` overlay is shared across all `<astro-zoom>` instances on a page. `Zoom.astro` deduplicates it server-side.
- **Custom element lifecycle**: `AstroZoomElement` extends `HTMLElement`, creates/destroys a `Zoom` instance in `connectedCallback`/`disconnectedCallback`.
- **HTML processing in Astro**: Slot content is split by `<img>` regex, images not already inside `<a>` tags are wrapped in accessible links with `data-zoom-*` attributes.

### Demo (`demo/`)

Standard Astro site. Uses path aliases (`@components/*`, `@layouts/*`, `@styles/*`) defined in `demo/tsconfig.json`. Local package linked via `file:../packages/astro-zoom`.

Vite config excludes `astro-zoom` from `optimizeDeps` to ensure the local package is used directly during dev.

## Code Conventions

- TypeScript with strict mode (inherited from Astro base tsconfig)
- CSS classes use `astro-zoom-` prefix with kebab-case
- Data attributes use `data-zoom-` prefix
- Commit messages use emoji prefixes (e.g., `✨ feat:`, `💄 style:`, `🎉 chore:`)
