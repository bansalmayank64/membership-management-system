import { test as base } from '@playwright/test';

// Extend base test with a `login` helper that sets a fake auth token in localStorage
export const test = base.extend<{ login: (page) => Promise<void> }>({
  login: [async ({ }, use) => {
    await use(async (page) => {
      // A helper to set token in localStorage - assumes app reads localStorage authToken
      await page.addInitScript(() => {
        try { localStorage.setItem('authToken', 'TEST_AUTH_TOKEN'); } catch (e) {}
      });
    });
  }, { scope: 'worker' }]
});

export { expect } from '@playwright/test';
