import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const DOMAIN = process.env.DOMAIN;
if (!DOMAIN) {
  throw new Error("DOMAIN env var is required");
}

export default defineConfig({
  testDir: './e2e/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html'],
  ],
  use: {
    baseURL: `https://social.${DOMAIN}`,
    trace: process.env.CI ? 'on' : 'on-first-retry',
    video: process.env.CI ? 'on' : undefined,
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
