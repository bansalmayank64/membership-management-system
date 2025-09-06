import { test } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test('inspect UI structure', async ({ page, login }) => {
  // Set up authentication first
  await login(page);
  
  // Set up API mocks before page navigation
  await setupGlobalMocks(page);
  
  // Now navigate to the page
  await page.goto('/');
  await waitForAppReady(page, 'Students');
  
  // Take screenshot
  await page.screenshot({ path: 'ui-structure.png', fullPage: true });
  
  // Log tab structure
  const tabs = await page.locator('button[role="tab"]').allTextContents();
  console.log('Available tabs:', tabs);
  
  // Find all clickable elements that might be the unassigned status
  const allButtons = await page.locator('button, .MuiChip-root, .MuiChip-clickable').allTextContents();
  console.log('All clickable elements:', allButtons);
  
  // Check for Alice's row structure
  const aliceText = await page.locator('*:has-text("Alice")').first().innerHTML();
  console.log('Alice row HTML:', aliceText);
  
  // Look for unassigned elements specifically
  const unassignedElements = await page.locator('*:has-text("Unassigned")').count();
  console.log('Unassigned elements count:', unassignedElements);
  
  // Get unassigned element details
  for (let i = 0; i < Math.min(unassignedElements, 3); i++) {
    const element = page.locator('*:has-text("Unassigned")').nth(i);
    const tagName = await element.evaluate(el => el.tagName);
    const classes = await element.getAttribute('class');
    const text = await element.textContent();
    console.log(`Unassigned ${i}: ${tagName} with classes "${classes}" text "${text}"`);
  }
});
