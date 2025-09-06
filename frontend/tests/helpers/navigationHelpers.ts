export async function navigateToPayments(page: any) {
  // Material-UI Tab components render as button[role="tab"], not a[role="tab"]
  let paymentsTab = page.locator('button[role="tab"]').filter({ hasText: 'Payments' });
  
  if (await paymentsTab.count() === 0) {
    // Try any link or button with Payments text
    paymentsTab = page.locator('a, button').filter({ hasText: 'Payments' });
  }
  
  if (await paymentsTab.count() === 0) {
    // Try legacy a[role="tab"] selector as fallback
    paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
  }
  
  if (await paymentsTab.count() > 0) {
    await paymentsTab.first().click();
    await page.waitForTimeout(2000);
    return true;
  }
  
  console.log('Payments tab not found - skipping payment test');
  return false;
}

export async function navigateToStudents(page: any) {
  // Try different selectors for students tab
  let studentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Students' });
  
  if (await studentsTab.count() === 0) {
    studentsTab = page.locator('button[role="tab"]').filter({ hasText: 'Students' });
  }
  
  if (await studentsTab.count() === 0) {
    studentsTab = page.locator('a, button').filter({ hasText: 'Students' });
  }
  
  if (await studentsTab.count() > 0) {
    await studentsTab.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  
  return false;
}

export async function waitForAssignButtonEnabled(dialog: any, page: any) {
  // Wait for assign button to be enabled
  const assignButton = dialog.locator('button').filter({ hasText: 'Assign' });
  
  // Wait up to 5 seconds for button to be enabled
  for (let i = 0; i < 10; i++) {
    const isDisabled = await assignButton.getAttribute('disabled');
    if (!isDisabled) {
      return assignButton;
    }
    await page.waitForTimeout(500);
  }
  
  return null;
}
