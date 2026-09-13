import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
    // The remote sandbox pre-installs one Chromium and pins its path; a laptop uses Playwright's own.
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
});
