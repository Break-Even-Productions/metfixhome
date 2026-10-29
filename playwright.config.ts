import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Visual + a11y harness (PR F §4a / LR-F16 / LR-F23).
 * retries: 0 (T-F-47). Chromium only. Exact Playwright pin in package.json.
 */
export default defineConfig({
  testDir: "tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // T-F-68: CI never regenerates; local may fill missing only.
  updateSnapshots: process.env.CI ? "none" : "missing",
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      threshold: 0.1,
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: BASE,
    ...devices["Desktop Chrome"],
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Chicago",
    colorScheme: "light",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "visual",
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "a11y",
      testMatch: /.*\.a11y\.spec\.ts/,
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
