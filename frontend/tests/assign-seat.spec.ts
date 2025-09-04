import { test, expect } from './helpers/auth';

test.describe('Assign seat flow', () => {
  test('open assign dialog from unassigned chip and assign a seat', async ({ page, login }) => {
    await login(page);
    // Intercept students API to provide fixture
    await page.route('**/api/students/with-unassigned-seats', async route => {
      const json = await (await import('./fixtures/students.json')).default;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
    });

    await page.goto('/');
    // Ensure Students tab
    const studentsTab = page.locator('button[role="tab"]', { hasText: 'Students' });
    if (await studentsTab.count() > 0) await studentsTab.click();

    // Find first unassigned student chip (Alice)
    const unassigned = page.locator('text=Unassigned').filter({ hasText: 'Unassigned' }).first();
    await expect(unassigned).toBeVisible();
    await unassigned.click();

    // Assign dialog should appear
    const assignDialog = page.locator('text=Assign Seat');
    await expect(assignDialog).toBeVisible({ timeout: 3000 });

    // Choose a seat from select if present (attempt to pick first option)
    const seatSelect = page.locator('label', { hasText: 'Seat' }).locator('..').locator('select').first();
    if (await seatSelect.count() > 0) {
      await seatSelect.selectOption({ index: 0 });
    }

    // Click confirm button (label may be "Assign" or similar)
    const assignBtn = page.locator('button', { hasText: 'Assign' }).first();
    if (await assignBtn.count() > 0) {
      await assignBtn.click();
    }

    // After assignment, dialog should close
    await expect(assignDialog).toHaveCount(0);
  });
});
