/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Astro's Vite config, so the tests can render ImageZoom.astro with the Container API.
// The end-to-end tests live in tests/e2e and run with Playwright.
export default getViteConfig(
  {
    test: {
      include: ['test/**/*.test.ts'],
    },
  },
  { root: import.meta.dirname, logLevel: 'error' }
);
