import { test, expect } from '@playwright/test';

// These tests assume the frontend dev server is running at FRONTEND_BASE_URL (default http://localhost:5173)

test.describe('Students page interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to Students page via tab if needed
    const studentsTab = page.locator('button[role="tab"]', { hasText: 'Students' });
    if (await studentsTab.count() > 0) {
      await studentsTab.click();
    }
    // Wait for students list or seats to load
    await page.waitForSelector('text=Students', { timeout: 5000 }).catch(() => {});
  });

  test('clicking unassigned chip opens Assign Seat dialog (mobile/list and desktop/table)', async ({ page }) => {
    // Find a student chip that says 'Unassigned'
    const unassignedChip = page.locator('text=Unassigned').first();
    await expect(unassignedChip).toBeVisible();
    await unassignedChip.click();

    // Assign dialog should open - we look for assign dialog title or form
    const assignDialog = page.locator('text=Assign Seat');
    await expect(assignDialog).toBeVisible({ timeout: 5000 });
  });

  test('clicking Assigned stat toggles filter highlight', async ({ page }) => {
    const assignedCard = page.locator('text=Assigned Seats').first();
    await expect(assignedCard).toBeVisible();

    // Click once - should activate (filtered by chip appears)
    await assignedCard.click();
    const filteredChip = page.locator('text=Filtered by:');
    await expect(filteredChip).toBeVisible();

    // Click again to clear
    await assignedCard.click();
    await expect(filteredChip).toHaveCount(0);
  });
});
