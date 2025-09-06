import { test, expect } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady, dismissDialogs } from './fixtures/globalMocks';

test('payments pagination smoke', async ({ page, login }) => {
  await login(page);
  await setupGlobalMocks(page);
  await page.goto('/');
  await waitForAppReady(page);
  
  // Navigate to Payments tab - these are links not buttons
  const paymentsTab = page.locator('a[role="tab"]', { hasText: 'Payments' }).or(page.locator('a[href="/payments"]'));
  await paymentsTab.waitFor({ timeout: 5000 });
  
  // Dismiss any blocking dialogs before clicking
  await dismissDialogs(page);
  
  await paymentsTab.click({ force: true });
  await page.waitForTimeout(1000); // Allow navigation
  
  // Wait for payment data to appear (currency symbol or payment amount)
  const paymentItem = page.locator('text=₹').or(page.locator('text=100')).or(page.locator('[data-testid="payment-item"]')).first();
  await expect(paymentItem).toBeVisible({ timeout: 10000 });
});
