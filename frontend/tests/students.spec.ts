import { test, expect } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test.describe('Students page interactions', () => {
  test.beforeEach(async ({ page, login }) => {
    // Set up authentication first
    await login(page);
    
    // Set up API mocks before page navigation
    await setupGlobalMocks(page);
    
    // Now navigate to the page
    await page.goto('/');
    
    // Wait for the app to be ready
    await waitForAppReady(page, 'Students');
  });

  test('clicking unassigned chip opens Assign Seat dialog (mobile/list and desktop/table)', async ({ page }) => {
    // Look for Alice's unassigned chip specifically - it has aria-label="Assign seat"
    const unassignedChip = page.locator('[aria-label="Assign seat"]').or(page.locator('.MuiChip-clickable', { hasText: 'Unassigned' }));
    await unassignedChip.waitFor({ timeout: 5000 });
    await unassignedChip.click();

    // Assign dialog should open - be more specific to avoid multiple matches
    const assignDialog = page.locator('[role="dialog"]').filter({ hasText: 'Assign Seat' });
    await expect(assignDialog).toBeVisible({ timeout: 5000 });
  });

  test('clicking Assigned stat toggles filter highlight', async ({ page }) => {
    // Find the assigned stat card
    const assignedCard = page.locator('.MuiCard-root').filter({ hasText: 'Assigned Seats' }).first();
    await expect(assignedCard).toBeVisible();

    // Get initial background color
    const initialBg = await assignedCard.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    
    // Click the assigned card to activate filter
    await assignedCard.click();

    // Should switch to Seats tab
    const seatsTab = page.locator('button[role="tab"]').filter({ hasText: 'Seats' });
    await expect(seatsTab).toHaveAttribute('aria-selected', 'true');
    
    // Card should be highlighted (background color changes)
    await expect(assignedCard).not.toHaveCSS('background-color', initialBg);
    
    // Click again to clear filter
    await assignedCard.click();
    
    // Background should return to normal
    await expect(assignedCard).toHaveCSS('background-color', initialBg);
  });
});
