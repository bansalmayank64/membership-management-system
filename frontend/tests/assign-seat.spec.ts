import { test, expect } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test.describe('Assign seat flow', () => {
  test('open assign dialog from unassigned chip and assign a seat', async ({ page, login }) => {
    // Set up authentication first
    await login(page);
    
    // Set up API mocks before page navigation
    await setupGlobalMocks(page);
    
    // Now navigate to the page
    await page.goto('/');
    await waitForAppReady(page, 'Students');

    // Find Alice's unassigned chip with aria-label="Assign seat"
    const unassignedChip = page.locator('[aria-label="Assign seat"]').or(page.locator('.MuiChip-clickable', { hasText: 'Unassigned' }));
    await unassignedChip.waitFor({ timeout: 5000 });
    await unassignedChip.click();

    // Assign dialog should appear - be more specific to avoid multiple matches
    const assignDialog = page.locator('[role="dialog"]').filter({ hasText: 'Assign Seat' });
    await expect(assignDialog).toBeVisible({ timeout: 3000 });

    // Choose a seat from select if present - handle both native select and MUI combobox within the dialog
    const nativeSelect = assignDialog.locator('select');
    const muiCombobox = assignDialog.locator('[role="combobox"]');
    
    if (await nativeSelect.count() > 0) {
      await nativeSelect.selectOption({ index: 1 }); // Select first non-empty option
    } else if (await muiCombobox.count() > 0) {
      // Handle MUI combobox - click to open dropdown
      await muiCombobox.click();
      await page.waitForTimeout(500);
      // Select first available option
      const option = page.locator('[role="option"]').first();
      if (await option.count() > 0) {
        await option.click();
      }
    }

    // Wait a moment for the selection to register and enable the button
    await page.waitForTimeout(500);

    // Click confirm button - wait for it to be enabled (within the dialog)
    const assignBtn = assignDialog.locator('button:has-text("Assign Seat"):not([disabled])');
    if (await assignBtn.count() > 0) {
      await assignBtn.click();
    }

    // After assignment, dialog should close
    await expect(assignDialog).toHaveCount(0);
  });
});