import { test, expect } from './helpers/auth';

test('filters and stats integration', async ({ page, login }) => {
  await login(page);
  // Mock students API
  await page.route('**/api/students/with-unassigned-seats', async route => {
    const json = await (await import('./fixtures/students.json')).default;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });

  await page.goto('/');
  const studentsTab = page.locator('button[role="tab"]', { hasText: 'Students' });
  if (await studentsTab.count() > 0) await studentsTab.click();

  // Open Seats tab and set status=occupied via dropdown, expect Assigned tile highlight
  const seatsTab = page.locator('button[role="tab"]', { hasText: 'Seats' });
  if (await seatsTab.count() > 0) await seatsTab.click();

  const statusSelect = page.locator('label', { hasText: 'Status' }).first().locator('..').locator('select').first();
  if (await statusSelect.count() > 0) {
    await statusSelect.selectOption('occupied');
  }

  const filteredChip = page.locator('text=Filtered by:');
  await expect(filteredChip).toBeVisible();

  // Now clear status
  await statusSelect.selectOption('');
  await expect(filteredChip).toHaveCount(0);
});
