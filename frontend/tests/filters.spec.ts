import { test, expect } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test('filters and stats integration', async ({ page, login }) => {
  await login(page);
  await setupGlobalMocks(page);
  await page.goto('/');
  await waitForAppReady(page);

  // Test stat card clicking (Available Seats) - this should work based on our debugging
  const availableCard = page.locator('.MuiCard-root').filter({ hasText: 'Available Seats' }).first();
  await expect(availableCard).toBeVisible();
  
  // Get initial background color
  const initialBg = await availableCard.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  
  // Click to activate filter
  await availableCard.click();
  
  // Should switch to Seats tab 
  const seatsTab = page.locator('button[role="tab"]').filter({ hasText: 'Seats' });
  await expect(seatsTab).toHaveAttribute('aria-selected', 'true');
  
  // Card should be highlighted (background color changes)
  await expect(availableCard).not.toHaveCSS('background-color', initialBg);
  
  // Test Gender dropdown if it exists
  const genderSelect = page.locator('[role="combobox"]').filter({ hasText: /Gender/i }).first();
  if (await genderSelect.count() > 0) {
    await genderSelect.click();
    await page.waitForTimeout(500); // Give dropdown time to open
    
    // Close dropdown by clicking elsewhere if no options found  
    await page.click('body');
  }

  console.log('Filters test completed successfully');
});
