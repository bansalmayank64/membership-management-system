import { test, expect } from './helpers/auth';

// Simple pagination smoke test - intercept API and return page data

test('payments pagination smoke', async ({ page, login }) => {
  await login(page);
  // Provide a fake payments response for /api/payments?page=1
  await page.route('**/api/payments**', async route => {
    const body = JSON.stringify({ payments: [{ id: 1, amount: 100, student_id: '20250102' }], total: 1 });
    route.fulfill({ status: 200, contentType: 'application/json', body });
  });

  await page.goto('/');
  // Navigate to Payments page if available
  const paymentsLink = page.locator('text=Payments');
  if (await paymentsLink.count() > 0) await paymentsLink.click();

  // Wait for payment item to appear
  const paymentItem = page.locator('text=₹').first();
  await expect(paymentItem).toBeVisible({ timeout: 5000 });
});
