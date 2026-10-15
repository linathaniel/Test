import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['journey.spec.ts', 'milestone2.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5173/annivgame/', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_BROWSER_CHANNEL || undefined } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173/annivgame/',
    reuseExistingServer: !process.env.CI,
  },
});
