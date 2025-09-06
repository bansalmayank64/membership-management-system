import { test } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test('debug app rendering', async ({ page, login }) => {
  // Set up authentication first
  await login(page);
  
  // Set up API mocks before page navigation
  await setupGlobalMocks(page);
  
  // Now navigate to the page
  await page.goto('/');
  await waitForAppReady(page, 'Students');
  
  // Take screenshot to see what's rendered
  await page.screenshot({ path: 'debug-app-loaded.png' });
  
  // Log specific elements we're looking for
  const tabs = await page.locator('button[role="tab"]').count();
  const aliceText = await page.getByText('Alice').count();
  const assignedSeats = await page.locator('text=Assigned Seats').count();
  const unassignedText = await page.locator('text=Unassigned').count();
  
  console.log(`Tabs found: ${tabs}`);
  console.log(`Alice text: ${aliceText}`);
  console.log(`Assigned Seats: ${assignedSeats}`);
  console.log(`Unassigned text: ${unassignedText}`);
  
  // Check if there are any error messages or loading indicators
  const errorText = await page.locator('text=Error, text=Failed, text=Loading').count();
  const loadingIndicators = await page.locator('.MuiCircularProgress-root, [role="progressbar"]').count();
  
  console.log(`Error messages: ${errorText}`);
  console.log(`Loading indicators: ${loadingIndicators}`);
  
  // Log visible text on page
  const visibleText = await page.locator('body').textContent();
  console.log('Visible text preview:', visibleText?.substring(0, 200));
  
  // Try to find any table or list content
  const tableRows = await page.locator('tr').count();
  const listItems = await page.locator('.MuiListItem-root').count();
  const cards = await page.locator('.MuiCard-root').count();
  
  console.log(`Table rows: ${tableRows}, List items: ${listItems}, Cards: ${cards}`);
});
