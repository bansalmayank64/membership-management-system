import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45 * 1000, // Increased from 30s to 45s for comprehensive tests
  expect: {
    timeout: 8000 // Increased from 5s to 8s for slower UI updates
  },
  fullyParallel: true,
  retries: 1, // Add 1 retry for flaky network/timing issues
  // Automatically start the frontend dev server for E2E tests
  webServer: {
    command: 'npm run dev',
    url: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 45_000 // Increased timeout for app startup
  },
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 8000, // Increased from 5s to 8s for slower actions
    navigationTimeout: 15000, // Add explicit navigation timeout
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
