import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the real app in a browser: frontend + backend + PostgreSQL.
 * Seed the database first (cd backend && npm run seed). Both servers are started
 * automatically if they are not already running.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1366, height: 900 },
    // A fixed location near HITEC City so distance sorting is exercised.
    permissions: ['geolocation'],
    geolocation: { latitude: 17.4435, longitude: 78.3772 },
    // Optional: point at an already-installed Chromium instead of running `npx playwright install`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: [
    { command: 'npm run dev', cwd: '../backend', url: 'http://localhost:5000/api/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
  ],
});
