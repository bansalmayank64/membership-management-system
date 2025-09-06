import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  retries: 0,
  // Automatically start the frontend dev server for E2E tests
  webServer: {
    command: 'npm run dev',
    url: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 5000,
    baseURL: process.env.FRONTEND_BASE_URL || 'http://localhost:5173'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use the locally installed Chrome to bypass managed network TLS issues when downloading browsers
        channel: 'chrome'
      }
    }
  ],
  // Support TypeScript helpers
  testMatch: /.*\.spec\.ts/
});
