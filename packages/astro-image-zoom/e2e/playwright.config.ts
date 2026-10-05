import { defineConfig, devices } from "@playwright/test";

// The fixture site (e2e/fixture), built and served by astro preview
const port = 4323;
const fixture = "astro-image-zoom-e2e-fixture";
// The Starlight fixture (e2e/fixture-starlight), for starlight.spec.ts, which sets this port as its baseURL
const starlightPort = 4324;
const starlightFixture = "astro-image-zoom-e2e-fixture-starlight";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ]
    : "list",
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${port}`,
    // The first failure of each test, so a flaky one that passes on retry still leaves its trace
    trace: process.env.CI ? "retain-on-first-failure" : "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      // Builds the site on every run, so the tests always see the current package. --ignore-lock
      // keeps the server in the foreground, where Playwright manages it (Astro 7 would otherwise
      // send it to the background), and lets it run beside another preview server
      command: `pnpm --filter ${fixture} build && pnpm --filter ${fixture} exec astro preview --port ${port} --ignore-lock`,
      url: `http://localhost:${port}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter ${starlightFixture} build && pnpm --filter ${starlightFixture} exec astro preview --port ${starlightPort} --ignore-lock`,
      url: `http://localhost:${starlightPort}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
