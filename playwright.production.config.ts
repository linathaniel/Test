import { defineConfig } from '@playwright/test';
import development from './playwright.config';

export default defineConfig({
  ...development,
  testMatch: 'production.spec.ts',
  use: { ...development.use, baseURL: 'http://127.0.0.1:4173/annivgame/' },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/annivgame/',
    reuseExistingServer: !process.env.CI,
  },
});
