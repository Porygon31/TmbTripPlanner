import { defineConfig, devices } from '@playwright/test';

/**
 * Tests « en conditions réelles » : vraies tuiles, vrai BRouter, vrai Open-Meteo.
 * À lancer avec un accès Internet (la CI GitHub Actions le fait à chaque push).
 * Seul le catalogue est remplacé par les données synthétiques de test.
 */
export default defineConfig({
  testDir: 'tests/e2e-live',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
    ...devices['Desktop Chrome'],
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
