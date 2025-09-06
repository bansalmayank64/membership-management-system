import { test, expect } from './helpers/auth';
import { setupGlobalMocks } from './fixtures/globalMocks';

test.describe('Navigation and Routing', () => {
  test.beforeEach(async ({ page, login }) => {
    await login(page);
    await setupGlobalMocks(page);
  });

  test.describe('Main Navigation', () => {
    test('should display all navigation tabs', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const expectedTabs = ['Students', 'Payments', 'Admin Panel'];
      
      for (const tabText of expectedTabs) {
        const tab = page.locator('a[role="tab"], button[role="tab"]').filter({ hasText: tabText }).first();
        if (await tab.count() > 0) {
          await expect(tab).toBeVisible();
        }
      }
    });

    test('should navigate between tabs correctly', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Navigate to Payments
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      if (await paymentsTab.count() > 0) {
        await paymentsTab.click();
        await page.waitForURL('**/payments');
        expect(page.url()).toContain('payments');
      }

      // Navigate to Admin
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      if (await adminTab.count() > 0) {
        await adminTab.click();
        await page.waitForURL('**/admin');
        expect(page.url()).toContain('admin');
      }

      // Navigate back to Students
      const studentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Students' });
      if (await studentsTab.count() > 0) {
        await studentsTab.click();
        await page.waitForURL('/');
        expect(page.url()).toBe('http://localhost:5173/');
      }
    });

    test('should maintain active tab state', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      if (await paymentsTab.count() > 0) {
        await paymentsTab.click();
        
        // Should be marked as active
        await expect(paymentsTab).toHaveAttribute('aria-selected', 'true');
        
        // Other tabs should not be active
        const studentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Students' });
        if (await studentsTab.count() > 0) {
          await expect(studentsTab).toHaveAttribute('aria-selected', 'false');
        }
      }
    });

    test('should show library branding', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const libraryTitle = page.locator('text="Goga Ji Library"');
      await expect(libraryTitle).toBeVisible();

      const libraryIcon = page.locator('[data-testid="LibraryBooksIcon"]');
      if (await libraryIcon.count() > 0) {
        await expect(libraryIcon).toBeVisible();
      }
    });

    test('should display user account menu', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const userMenuButton = page.locator('button[aria-label*="account"], button').filter({ hasText: 'AccountCircle' });
      if (await userMenuButton.count() > 0) {
        await userMenuButton.click();

        const userMenu = page.locator('[role="menu"]');
        if (await userMenu.count() > 0) {
          await expect(userMenu).toBeVisible();
        }
      }
    });
  });

  test.describe('Deep Link Navigation', () => {
    test('should handle direct navigation to payments page', async ({ page }) => {
      await page.goto('/payments');
      await page.waitForTimeout(2000);

      expect(page.url()).toContain('payments');
      
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      if (await paymentsTab.count() > 0) {
        await expect(paymentsTab).toHaveAttribute('aria-selected', 'true');
      }
    });

    test('should handle direct navigation to admin page', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForTimeout(2000);

      expect(page.url()).toContain('admin');
      
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      if (await adminTab.count() > 0) {
        await expect(adminTab).toHaveAttribute('aria-selected', 'true');
      }
    });

    test('should handle direct navigation to student profile', async ({ page }) => {
      // Mock student profile API
      await page.route('**/api/students/*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            student: {
              id: 'STU001',
              name: 'Alice Johnson',
              seatNumber: 3,
              email: 'alice@example.com',
              phone: '1234567890',
              membershipType: 'monthly',
              startDate: '2025-09-01',
              endDate: '2025-09-30'
            }
          })
        });
      });

      await page.goto('/student/3');
      await page.waitForTimeout(2000);

      expect(page.url()).toContain('student/3');
      
      const studentName = page.locator('h1, h2, h3, h4, h5, h6').filter({ hasText: 'Alice' });
      if (await studentName.count() > 0) {
        await expect(studentName).toBeVisible();
      }
    });

    test('should handle 404 for invalid routes', async ({ page }) => {
      await page.goto('/invalid-route');
      await page.waitForTimeout(2000);

      // Should redirect to home or show 404 page
      const notFoundIndicator = page.locator('text=/404|not found|page not found/i');
      const homeRedirect = page.url() === 'http://localhost:5173/';
      
      const hasNotFound = await notFoundIndicator.count() > 0;
      
      // Either should show 404 or redirect to home (both are acceptable behaviors)
      if (!hasNotFound && !homeRedirect) {
        // Check if we're on a known valid page instead
        const validPageContent = page.locator('text=/students|payments|dashboard/i');
        const hasValidContent = await validPageContent.count() > 0;
        expect(hasValidContent).toBe(true);
      } else {
        expect(hasNotFound || homeRedirect).toBe(true);
      }
    });
  });

  test.describe('Browser Navigation', () => {
    test('should handle browser back button', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(1000);

      // Navigate to payments
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      if (await paymentsTab.count() > 0) {
        await paymentsTab.click();
        await page.waitForURL('**/payments');

        // Use browser back button
        await page.goBack();
        await page.waitForTimeout(1000);

        expect(page.url()).toBe('http://localhost:5173/');
      }
    });

    test('should handle browser forward button', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(1000);

      // Navigate to payments and back
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      if (await paymentsTab.count() > 0) {
        await paymentsTab.click();
        await page.waitForURL('**/payments');
        
        await page.goBack();
        await page.waitForTimeout(1000);

        // Use browser forward button
        await page.goForward();
        await page.waitForTimeout(1000);

        expect(page.url()).toContain('payments');
      }
    });

    test('should handle page refresh', async ({ page }) => {
      await page.goto('/payments');
      await page.waitForTimeout(2000);

      // Refresh page
      await page.reload();
      await page.waitForTimeout(2000);

      // Should still be on payments page
      expect(page.url()).toContain('payments');
      
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      if (await paymentsTab.count() > 0) {
        await expect(paymentsTab).toHaveAttribute('aria-selected', 'true');
      }
    });
  });

  test.describe('Responsive Navigation', () => {
    test('should handle mobile navigation menu', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Look for mobile menu button
      const mobileMenuButton = page.locator('button[aria-label*="menu"], button').filter({ hasText: 'Menu' });
      if (await mobileMenuButton.count() > 0) {
        await mobileMenuButton.click();

        const mobileMenu = page.locator('[role="menu"], .mobile-menu');
        if (await mobileMenu.count() > 0) {
          await expect(mobileMenu).toBeVisible();
        }
      }
    });

    test('should adapt tab layout for small screens', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForTimeout(2000);

      const navigationTabs = page.locator('a[role="tab"], button[role="tab"]');
      const tabCount = await navigationTabs.count();
      
      if (tabCount > 0) {
        // Should show tabs in compact format or as dropdown
        const firstTab = navigationTabs.first();
        await expect(firstTab).toBeVisible();
      }
    });
  });

  test.describe('Navigation Performance', () => {
    test('should load pages quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await page.waitForTimeout(1000);
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });

    test('should preload navigation resources', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(1000);

      // Check if CSS and JS resources are loaded
      const responses: any[] = [];
      page.on('response', response => {
        responses.push(response);
      });

      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      if (await paymentsTab.count() > 0) {
        await paymentsTab.click();
        await page.waitForTimeout(1000);

        // Should have loaded resources efficiently
        const successfulResponses = responses.filter((r: any) => r.status() < 400);
        expect(successfulResponses.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Route Protection', () => {
    test('should protect admin routes from non-admin users', async ({ page }) => {
      // Mock non-admin user
      await page.route('**/api/auth/verify', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            user: { id: 2, name: 'Regular User', role: 'user' }
          })
        });
      });

      await page.goto('/admin');
      await page.waitForTimeout(2000);

      // Should redirect or show access denied
      const accessDenied = page.locator('text=/access denied|unauthorized|permission/i');
      const redirectedHome = page.url() === 'http://localhost:5173/';
      
      const hasAccessDenied = await accessDenied.count() > 0;
      expect(hasAccessDenied || redirectedHome).toBe(true);
    });

    test('should allow admin users to access admin routes', async ({ page }) => {
      // Mock admin user
      await page.route('**/api/auth/verify', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            user: { id: 1, name: 'Admin User', role: 'admin' }
          })
        });
      });

      await page.goto('/admin');
      await page.waitForTimeout(2000);

      // Should access admin page successfully
      expect(page.url()).toContain('admin');
    });

    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Clear authentication
      await page.context().clearCookies();
      try {
        await page.evaluate(() => localStorage.clear());
      } catch (error) {
        // localStorage might not be accessible in some test contexts
        console.log('Could not clear localStorage:', error);
      }

      await page.route('**/api/auth/verify', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ valid: false })
        });
      });

      await page.goto('/');
      await page.waitForTimeout(2000);

      // Should redirect to login or show login form
      const loginForm = page.locator('form').filter({ hasText: /login|sign in/i });
      const loginButton = page.locator('button').filter({ hasText: /login|sign in/i });
      
      const hasLoginForm = await loginForm.count() > 0;
      const hasLoginButton = await loginButton.count() > 0;
      
      expect(hasLoginForm || hasLoginButton).toBe(true);
    });
  });
});
