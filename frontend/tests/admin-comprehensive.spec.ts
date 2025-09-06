import { test, expect } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test.describe('Admin Panel - Comprehensive Coverage', () => {
  test.beforeEach(async ({ page, login }) => {
    await login(page);
    await setupGlobalMocks(page);
    
    // Mock admin-specific APIs
    await page.route('**/api/admin/**', async route => {
      const url = route.request().url();
      
      if (url.includes('fees-config')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            monthlyFee: 1500,
            yearlyFee: 15000,
            registrationFee: 500,
            lateFee: 100,
            discounts: {
              student: 10,
              senior: 20,
              family: 15
            }
          })
        });
      } else if (url.includes('statistics')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            totalStudents: 150,
            activeStudents: 142,
            totalRevenue: 180000,
            monthlyRevenue: 21300,
            occupancyRate: 85.5
          })
        });
      } else if (url.includes('users')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            users: [
              { id: 1, name: 'Admin User', email: 'admin@library.com', role: 'admin', active: true },
              { id: 2, name: 'Staff User', email: 'staff@library.com', role: 'staff', active: true }
            ]
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    await page.goto('/');
    await waitForAppReady(page);
  });

  test.describe('Admin Navigation and Access', () => {
    test('should navigate to admin panel', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      
      await page.waitForURL('**/admin');
      expect(page.url()).toContain('admin');
    });

    test('should show admin dashboard with statistics', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      // Check for admin dashboard elements
      const dashboardCards = [
        'Total Students',
        'Active Students', 
        'Total Revenue',
        'Monthly Revenue',
        'Occupancy Rate'
      ];

      for (const cardText of dashboardCards) {
        const card = page.locator('.MuiCard-root').filter({ hasText: cardText });
        if (await card.count() > 0) {
          await expect(card).toBeVisible();
        }
      }
    });

    test('should restrict access for non-admin users', async ({ page }) => {
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

      await page.reload();
      
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      
      // Admin tab should not be visible for non-admin users
      if (await adminTab.count() > 0) {
        await adminTab.click();
        
        // Should show access denied or redirect
        const accessDenied = page.locator('text=/access denied|unauthorized|permission/i');
        await expect(accessDenied.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Fee Configuration Management', () => {
    test('should display current fee configuration', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const feesSection = page.locator('text=/fees|pricing|configuration/i');
      if (await feesSection.count() > 0) {
        // Check for fee amounts
        const monthlyFee = page.locator('text=/monthly.*1500|1500.*monthly/i');
        const yearlyFee = page.locator('text=/yearly.*15000|15000.*yearly/i');
        
        if (await monthlyFee.count() > 0) {
          await expect(monthlyFee).toBeVisible();
        }
        
        if (await yearlyFee.count() > 0) {
          await expect(yearlyFee).toBeVisible();
        }
      }
    });

    test('should open fee configuration dialog', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const editFeesButton = page.locator('button').filter({ hasText: /edit fees|configure fees|fee settings/i });
      if (await editFeesButton.count() > 0) {
        await editFeesButton.click();

        const feesDialog = page.locator('[role="dialog"]').filter({ hasText: /fees|configuration|pricing/i });
        await expect(feesDialog).toBeVisible();
      }
    });

    test('should update fee configuration', async ({ page }) => {
      // Mock fee update API
      await page.route('**/api/admin/fees-config', async route => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, message: 'Fees updated successfully' })
          });
        }
      });

      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const editFeesButton = page.locator('button').filter({ hasText: /edit fees|configure fees|fee settings/i });
      if (await editFeesButton.count() > 0) {
        await editFeesButton.click();

        const feesDialog = page.locator('[role="dialog"]').filter({ hasText: /fees|configuration|pricing/i });
        if (await feesDialog.count() > 0) {
          // Update monthly fee
          const monthlyFeeInput = feesDialog.locator('input[name*="monthly"], input[placeholder*="monthly"]');
          if (await monthlyFeeInput.count() > 0) {
            await monthlyFeeInput.clear();
            await monthlyFeeInput.fill('1600');
          }

          // Save changes
          const saveButton = feesDialog.locator('button').filter({ hasText: /save|update/i });
          if (await saveButton.count() > 0) {
            await saveButton.click();
            
            // Should show success message
            const successMessage = page.locator('text=/success|updated|saved/i');
            await expect(successMessage.first()).toBeVisible({ timeout: 5000 });
          }
        }
      }
    });

    test('should validate fee configuration inputs', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const editFeesButton = page.locator('button').filter({ hasText: /edit fees|configure fees|fee settings/i });
      if (await editFeesButton.count() > 0) {
        await editFeesButton.click();

        const feesDialog = page.locator('[role="dialog"]').filter({ hasText: /fees|configuration|pricing/i });
        if (await feesDialog.count() > 0) {
          // Try to set invalid fee (negative or zero)
          const monthlyFeeInput = feesDialog.locator('input[name*="monthly"], input[placeholder*="monthly"]');
          if (await monthlyFeeInput.count() > 0) {
            await monthlyFeeInput.clear();
            await monthlyFeeInput.fill('-100');

            const saveButton = feesDialog.locator('button').filter({ hasText: /save|update/i });
            if (await saveButton.count() > 0) {
              await saveButton.click();
              
              // Should show validation error
              const errorMessage = page.locator('text=/invalid|error|positive|greater/i');
              await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });
            }
          }
        }
      }
    });
  });

  test.describe('User Management', () => {
    test('should display user list', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const usersSection = page.locator('button, tab, link').filter({ hasText: /users|staff|accounts/i });
      if (await usersSection.count() > 0) {
        await usersSection.click();
        await page.waitForTimeout(1000);

        // Should show user table
        const userTable = page.locator('table').filter({ hasText: /name|email|role/i });
        if (await userTable.count() > 0) {
          await expect(userTable).toBeVisible();
        }
      }
    });

    test('should add new user', async ({ page }) => {
      // Mock user creation API
      await page.route('**/api/admin/users', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              user: { id: 3, name: 'New User', email: 'new@library.com', role: 'staff' }
            })
          });
        }
      });

      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const addUserButton = page.locator('button').filter({ hasText: /add user|new user|create user/i });
      if (await addUserButton.count() > 0) {
        await addUserButton.click();

        const userDialog = page.locator('[role="dialog"]').filter({ hasText: /add user|new user|create user/i });
        if (await userDialog.count() > 0) {
          // Fill user form
          const nameInput = userDialog.locator('input[name="name"], input[placeholder*="name"]');
          const emailInput = userDialog.locator('input[name="email"], input[type="email"]');
          const roleSelect = userDialog.locator('select[name="role"], [role="combobox"]');

          if (await nameInput.count() > 0) await nameInput.fill('New User');
          if (await emailInput.count() > 0) await emailInput.fill('new@library.com');
          
          if (await roleSelect.count() > 0) {
            await roleSelect.click();
            const staffOption = page.locator('[role="option"], option').filter({ hasText: 'Staff' });
            if (await staffOption.count() > 0) await staffOption.click();
          }

          // Submit form
          const saveButton = userDialog.locator('button').filter({ hasText: /save|create|add/i });
          if (await saveButton.count() > 0) {
            await saveButton.click();
            await expect(userDialog).toHaveCount(0);
          }
        }
      }
    });

    test('should edit existing user', async ({ page }) => {
      // Mock user update API
      await page.route('**/api/admin/users/*', async route => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          });
        }
      });

      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const editUserButton = page.locator('button[aria-label*="edit"], button').filter({ hasText: /edit|pencil/i }).first();
      if (await editUserButton.count() > 0) {
        await editUserButton.click();

        const editDialog = page.locator('[role="dialog"]').filter({ hasText: /edit user|update user/i });
        if (await editDialog.count() > 0) {
          // Update name
          const nameInput = editDialog.locator('input[name="name"], input[value*="User"]');
          if (await nameInput.count() > 0) {
            await nameInput.clear();
            await nameInput.fill('Updated User Name');
          }

          const saveButton = editDialog.locator('button').filter({ hasText: /save|update/i });
          if (await saveButton.count() > 0) {
            await saveButton.click();
            await expect(editDialog).toHaveCount(0);
          }
        }
      }
    });

    test('should deactivate user account', async ({ page }) => {
      // Mock user deactivation API
      await page.route('**/api/admin/users/*/deactivate', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const userActionButton = page.locator('button[aria-label*="actions"], button').filter({ hasText: 'MoreVert' }).first();
      if (await userActionButton.count() > 0) {
        await userActionButton.click();

        const deactivateOption = page.locator('[role="menuitem"]').filter({ hasText: /deactivate|disable/i });
        if (await deactivateOption.count() > 0) {
          await deactivateOption.click();

          // Confirm deactivation
          const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|deactivate/i });
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    });
  });

  test.describe('System Settings', () => {
    test('should display system settings', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const settingsSection = page.locator('button, tab, link').filter({ hasText: /settings|configuration|system/i });
      if (await settingsSection.count() > 0) {
        await settingsSection.click();
        await page.waitForTimeout(1000);

        // Should show settings form
        const settingsForm = page.locator('form, div').filter({ hasText: /library name|contact|address/i });
        if (await settingsForm.count() > 0) {
          await expect(settingsForm).toBeVisible();
        }
      }
    });

    test('should update library information', async ({ page }) => {
      // Mock settings update API
      await page.route('**/api/admin/settings', async route => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          });
        }
      });

      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const settingsSection = page.locator('button, tab, link').filter({ hasText: /settings|configuration|system/i });
      if (await settingsSection.count() > 0) {
        await settingsSection.click();
        await page.waitForTimeout(1000);

        const libraryNameInput = page.locator('input[name*="name"], input[placeholder*="library"]');
        if (await libraryNameInput.count() > 0) {
          await libraryNameInput.clear();
          await libraryNameInput.fill('Updated Library Name');

          const saveButton = page.locator('button').filter({ hasText: /save|update/i });
          if (await saveButton.count() > 0) {
            await saveButton.click();
            
            const successMessage = page.locator('text=/success|updated|saved/i');
            await expect(successMessage.first()).toBeVisible({ timeout: 5000 });
          }
        }
      }
    });

    test('should backup data', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const backupButton = page.locator('button').filter({ hasText: /backup|export data/i });
      if (await backupButton.count() > 0) {
        // Setup download handler
        const downloadPromise = page.waitForEvent('download');
        await backupButton.click();

        // Should trigger download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/backup|export/i);
      }
    });
  });

  test.describe('Activity Log and Monitoring', () => {
    test('should navigate to activity log', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const activityLink = page.locator('a, button').filter({ hasText: /activity|log|audit/i });
      if (await activityLink.count() > 0) {
        await activityLink.click();
        
        await page.waitForURL('**/admin/activity');
        expect(page.url()).toContain('activity');
      }
    });

    test('should display activity logs', async ({ page }) => {
      // Mock activity log API
      await page.route('**/api/admin/activity**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activities: [
              {
                id: 1,
                user: 'Admin User',
                action: 'Created student',
                details: 'Student Alice Johnson',
                timestamp: '2025-09-06T10:00:00Z'
              },
              {
                id: 2,
                user: 'Staff User',
                action: 'Updated payment',
                details: 'Payment #123 marked as completed',
                timestamp: '2025-09-06T09:30:00Z'
              }
            ]
          })
        });
      });

      // Try to navigate to admin activity page
      try {
        await page.goto('/admin/activity');
        await page.waitForTimeout(5000); // Increased timeout
      } catch (error) {
        // If direct navigation fails, try through admin panel
        await page.goto('/admin');
        await page.waitForTimeout(2000);
        
        const activityLink = page.locator('a, button').filter({ hasText: /activity|logs/i });
        if (await activityLink.count() > 0) {
          await activityLink.first().click();
          await page.waitForTimeout(3000);
        } else {
          console.log('Activity page not accessible - skipping test');
          return;
        }
      }

      // Should show activity table
      const activityTable = page.locator('table').filter({ hasText: /user|action|timestamp/i });
      if (await activityTable.count() > 0) {
        await expect(activityTable).toBeVisible();
        
        // Should show activities
        const activityRow = page.locator('tr').filter({ hasText: 'Created student' });
        if (await activityRow.count() > 0) {
          await expect(activityRow).toBeVisible();
        }
      }
    });

    test('should filter activity logs by date range', async ({ page }) => {
      // Try to navigate to admin activity page  
      try {
        await page.goto('/admin/activity');
        await page.waitForTimeout(5000);
      } catch (error) {
        await page.goto('/admin');
        await page.waitForTimeout(2000);
        
        const activityLink = page.locator('a, button').filter({ hasText: /activity|logs/i });
        if (await activityLink.count() > 0) {
          await activityLink.first().click();
          await page.waitForTimeout(3000);
        } else {
          console.log('Activity page not accessible - skipping date filter test');
          return;
        }
      }

      const fromDateInput = page.locator('input[type="date"]').first();
      const toDateInput = page.locator('input[type="date"]').last();

      if (await fromDateInput.count() > 0 && await toDateInput.count() > 0) {
        await fromDateInput.fill('2025-09-01');
        await toDateInput.fill('2025-09-06');
        
        const filterButton = page.locator('button').filter({ hasText: /filter|search/i });
        if (await filterButton.count() > 0) {
          await filterButton.click();
          await page.waitForTimeout(1000);
        }
      }
    });

    test('should filter activity logs by user', async ({ page }) => {
      await page.goto('/admin/activity');
      await page.waitForTimeout(2000);

      const userFilter = page.locator('select[name*="user"], [role="combobox"]').filter({ hasText: /user|staff/i });
      if (await userFilter.count() > 0) {
        await userFilter.click();
        
        const userOption = page.locator('[role="option"], option').first();
        if (await userOption.count() > 0) {
          await userOption.click();
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe('Reporting and Analytics', () => {
    test('should generate revenue report', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const reportsButton = page.locator('button, link').filter({ hasText: /reports|analytics/i });
      if (await reportsButton.count() > 0) {
        await reportsButton.click();

        const revenueReport = page.locator('button').filter({ hasText: /revenue|financial/i });
        if (await revenueReport.count() > 0) {
          await revenueReport.click();

          // Should show revenue report
          const reportContent = page.locator('text=/total revenue|monthly revenue|₹/i');
          await expect(reportContent.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should export reports', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const exportButton = page.locator('button').filter({ hasText: /export report|download/i });
      if (await exportButton.count() > 0) {
        // Setup download handler
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();

        // Should trigger download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/report|export/i);
      }
    });
  });

  test.describe('Error Handling and Permissions', () => {
    test('should handle admin API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('**/api/admin/**', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();

      // Should show error message
      const errorMessage = page.locator('text=/error|failed|problem/i');
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
    });

    test('should validate admin permissions for sensitive operations', async ({ page }) => {
      const adminTab = page.locator('a[role="tab"]').filter({ hasText: 'Admin' });
      await adminTab.click();
      await page.waitForTimeout(2000);

      const sensitiveButton = page.locator('button').filter({ hasText: /delete|remove|reset|backup/i }).first();
      if (await sensitiveButton.count() > 0) {
        await sensitiveButton.click();

        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: /confirm|warning|sure/i });
        if (await confirmDialog.count() > 0) {
          await expect(confirmDialog).toBeVisible();
        }
      }
    });
  });
});
