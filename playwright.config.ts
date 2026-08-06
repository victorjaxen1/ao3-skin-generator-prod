import { defineConfig, devices } from '@playwright/test';

/**
 * UX friction instrumentation against the live site.
 * These are not correctness tests — they measure steps-to-goal, dead ends,
 * and missing affordances. See tests/README.md for what they can/can't tell you.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.UX_BASE_URL || 'https://ao3skingen.netlify.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // NOTE: `channel` drives the system-installed browser instead of Playwright's
  // own Chromium build. cdn.playwright.dev is blocked on this network, so
  // `npx playwright install` cannot fetch the bundled binary. Override with
  // UX_CHANNEL=chrome if Edge is unavailable.
  projects: [
    // Pure logic, no browser and no server. Fast enough to run on every save:
    //   npx playwright test --project=unit
    {
      name: 'unit',
      testMatch: '**/*.unit.spec.ts',
    },
    {
      name: 'desktop',
      testIgnore: '**/*.unit.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.UX_CHANNEL || 'msedge',
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'mobile',
      testIgnore: '**/*.unit.spec.ts',
      use: {
        ...devices['Pixel 7'],
        channel: process.env.UX_CHANNEL || 'msedge',
      },
    },
  ],
});
