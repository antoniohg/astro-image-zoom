import { defineConfig, devices } from '@playwright/test';

// The fixture site (e2e/fixture), built and served by astro preview
const port = 4323;
const fixture = 'astro-image-zoom-e2e-fixture';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // Builds the site on every run, so the tests always see the current package. --ignore-lock
    // keeps the server in the foreground, where Playwright manages it (Astro 7 would otherwise
    // send it to the background), and lets it run beside another preview server
    command: `pnpm --filter ${fixture} build && pnpm --filter ${fixture} exec astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
