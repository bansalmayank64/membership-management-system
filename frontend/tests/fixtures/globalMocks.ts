import { Page } from '@playwright/test';
import studentsData from './students.json';

// Global mock setup for all API endpoints used by the app
export async function setupGlobalMocks(page: Page) {
  // CRITICAL: Set up auth mocks FIRST before any other routes
  // This ensures authentication happens before the app component mounts
  
  // Auth endpoints FIRST (most specific routes first)
  await page.route('**/api/auth/verify', async route => {
    console.log('Auth verify endpoint hit successfully');
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ valid: true, user: { id: 1, name: 'Test User', role: 'admin' } }) 
    });
  });

  await page.route('**/api/auth/login', async route => {
    console.log('Auth login endpoint hit');
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ success: true, token: 'mock-token', user: { id: 1, name: 'Test User' } }) 
    });
  });

  // Log all network requests to debug what's being called
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log('API Request:', request.method(), request.url());
    }
  });

  // Students API endpoints
  await page.route('**/api/students/with-unassigned-seats', async route => {
    console.log('Students with unassigned seats endpoint hit');
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify(studentsData) 
    });
  });

  await page.route('**/api/students', async route => {
    if (route.request().method() === 'GET') {
      console.log('Students GET endpoint hit');
      route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify({ students: studentsData.students }) 
      });
    } else {
      // POST/PUT/DELETE - just return success
      route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify({ success: true, id: 'new-student-id' }) 
      });
    }
  });

  await page.route('**/api/students/*/history', async route => {
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify([]) 
    });
  });

  await page.route('**/api/students/available-seats/**', async route => {
    const body = { availableSeats: [{ seat_number: '4' }, { seat_number: '5' }] };
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify(body) 
    });
  });

  await page.route('**/api/students/fee-config/**', async route => {
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ monthly_fees: 1000, admission_fee: 500 }) 
    });
  });

  // Seats API endpoints
  await page.route('**/api/seats', async route => {
    console.log('Seats endpoint hit');
    const seats = [
      { seatNumber: '3', studentName: 'Bob', studentId: '20250102', occupantSexRestriction: 'male', membershipExpiry: '2025-10-11' },
      { seatNumber: '4', occupantSexRestriction: 'male' },
      { seatNumber: '5', occupantSexRestriction: 'female' }
    ];
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify(seats) 
    });
  });

  await page.route('**/api/seats/assign', async route => {
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ success: true }) 
    });
  });
  
  // Add API route for fetching available seats for assignment
  await page.route('**/api/students/*/available-seats', async route => {
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ availableSeats: [{ seat_number: '4' }, { seat_number: '5' }] }) 
    });
  });

  await page.route('**/api/seats/*/history', async route => {
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify([]) 
    });
  });

  // Payments API endpoints
  await page.route('**/api/payments**', async route => {
    const body = JSON.stringify({ 
      payments: [
        { id: 1, amount: 100, student_id: '20250102', date: '2025-09-01', student_name: 'Bob' }
      ], 
      total: 1 
    });
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body 
    });
  });

  await page.route('**/api/payments/student/**', async route => {
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify([]) 
    });
  });

  // Expenses API endpoints
  await page.route('**/api/expenses**', async route => {
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ expenses: [], total: 0 }) 
    });
  });

  // Admin endpoints
  await page.route('**/api/admin/fees-config', async route => {
    console.log('Admin fees-config endpoint hit');
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ monthlyFees: 1000, admissionFee: 500, membershipTypes: ['Full Time', 'Part Time'] }) 
    });
  });
}

// Helper to dismiss any blocking dialogs
export async function dismissDialogs(page: Page) {
  // Handle session expired dialog specifically
  const sessionExpiredAlert = page.locator('text=Session Expired').or(page.locator('text=Your session has expired'));
  if (await sessionExpiredAlert.count() > 0) {
    // Click Login button to dismiss session expired dialog
    const loginButton = page.locator('button', { hasText: 'Login' });
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await page.waitForTimeout(1000); // Wait for dialog to close
    } else {
      // Try escape key
      await page.keyboard.press('Escape');
    }
  }

  // Handle aria-hidden root (loading overlay)
  const hiddenRoot = page.locator('#root[aria-hidden="true"]');
  if (await hiddenRoot.count() > 0) {
    // Wait for it to become visible
    await page.locator('#root:not([aria-hidden="true"])').waitFor({ timeout: 10000 }).catch(() => {});
  }

  // Dismiss any dialog modals
  const dialog = page.locator('[role="dialog"]');
  let attempts = 0;
  while (await dialog.count() > 0 && attempts < 3) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    attempts++;
  }
}

// Wait for app to be ready with data loaded
export async function waitForAppReady(page: Page, tabName?: string) {
  // Wait for app to become interactive (root not aria-hidden)
  await page.locator('#root:not([aria-hidden="true"])').waitFor({ timeout: 20000 });
  
  // Wait for initial render with shorter timeout
  await page.waitForTimeout(1000);
  
  // Dismiss any blocking dialogs first
  await dismissDialogs(page);
  
  // If specific tab requested, try to navigate to it
  if (tabName) {
    const tab = page.locator('button[role="tab"]', { hasText: tabName });
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(1000); // Reduced from 1500ms
    }
  }
  
  // Reduced extra wait time for API calls
  await page.waitForTimeout(500);
}
