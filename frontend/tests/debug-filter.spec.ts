import { test, expect } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test('debug assigned filter', async ({ page, login }) => {
  await login(page);
  await setupGlobalMocks(page);
  await page.goto('/');
  await waitForAppReady(page, 'Students');

  // Find and click the assigned stat card
  const assignedCard = page.locator('.MuiCard-root').filter({ hasText: 'Assigned Seats' }).first();
  await expect(assignedCard).toBeVisible();
  await assignedCard.click();
  
  // Wait a bit and then check what chips are visible
  await page.waitForTimeout(2000);
  const allChips = page.locator('.MuiChip-root');
  const chipCount = await allChips.count();
  console.log(`Found ${chipCount} chip elements after clicking assigned card`);
  
  for (let i = 0; i < chipCount; i++) {
    const chipText = await allChips.nth(i).textContent();
    console.log(`Chip ${i}: "${chipText}"`);
  }
  
  // Also check if any text mentions "Filtered by"
  const filteredText = await page.locator('text=Filtered by:').first().textContent().catch(() => 'Not found');
  console.log(`Filtered by text: ${filteredText}`);
});
