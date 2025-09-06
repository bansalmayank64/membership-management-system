import { test, expect } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test('debug assigned filter with tab switching', async ({ page, login }) => {
  await login(page);
  await setupGlobalMocks(page);
  await page.goto('/');
  await waitForAppReady(page, 'Students');

  // Find and click the assigned stat card - according to the handleStatClick code, 
  // clicking 'assigned' should switch to tab 0 (Seats view) and apply the filter there
  const assignedCard = page.locator('.MuiCard-root').filter({ hasText: 'Assigned Seats' }).first();
  await expect(assignedCard).toBeVisible();
  
  console.log('Clicking assigned card...');
  await assignedCard.click();
  
  // Wait for potential tab switch
  await page.waitForTimeout(2000);
  
  // Check which tab is currently active
  const activeTab = page.locator('button[role="tab"][aria-selected="true"]');
  const activeTabText = await activeTab.textContent().catch(() => 'No active tab found');
  console.log(`Active tab: ${activeTabText}`);
  
  // Check if we're on the Seats tab now (the code says assigned filter switches to tab 0 = Seats)
  const seatsTab = page.locator('button[role="tab"]').filter({ hasText: 'Seats' });
  const isSeatsActive = await seatsTab.getAttribute('aria-selected') === 'true';
  console.log(`Seats tab is active: ${isSeatsActive}`);
  
  // Now check for chips again
  const allChips = page.locator('.MuiChip-root');
  const chipCount = await allChips.count();
  console.log(`Found ${chipCount} chip elements after clicking assigned card`);
  
  for (let i = 0; i < chipCount; i++) {
    const chipText = await allChips.nth(i).textContent();
    console.log(`Chip ${i}: "${chipText}"`);
  }
  
  // Also check the card's background color to see if it's highlighted
  const cardStyle = await assignedCard.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return computed.backgroundColor;
  });
  console.log(`Assigned card background color: ${cardStyle}`);
});
