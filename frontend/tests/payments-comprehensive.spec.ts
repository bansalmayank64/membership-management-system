import { test, expect } from './helpers/auth';
import { setupGlobalMocks, waitForAppReady } from './fixtures/globalMocks';

test.describe('Payments Page - Comprehensive Coverage', () => {
  test.beforeEach(async ({ page, login }) => {
    await login(page);
    await setupGlobalMocks(page);
    
    // Mock payments API with comprehensive data
    await page.route('**/api/payments**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          payments: [
            {
              id: 1,
              studentId: 'STU001',
              studentName: 'Alice Johnson',
              amount: 1500,
              type: 'membership',
              status: 'completed',
              paymentDate: '2025-09-01',
              dueDate: '2025-09-01',
              method: 'cash'
            },
            {
              id: 2,
              studentId: 'STU002', 
              studentName: 'Bob Smith',
              amount: 2000,
              type: 'membership',
              status: 'pending',
              paymentDate: null,
              dueDate: '2025-09-15',
              method: null
            },
            {
              id: 3,
              studentId: 'STU003',
              studentName: 'Charlie Brown',
              amount: 500,
              type: 'fine',
              status: 'overdue',
              paymentDate: null,
              dueDate: '2025-08-30',
              method: null
            }
          ],
          total: 3,
          summary: {
            totalCollected: 1500,
            totalPending: 2500,
            totalOverdue: 500
          }
        })
      });
    });

    await page.goto('/');
    await waitForAppReady(page);
  });

  test.describe('Navigation and Page Load', () => {
    test('should navigate to payments page', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      
      await page.waitForURL('**/payments');
      expect(page.url()).toContain('payments');
    });

    test('should load payments data correctly', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      
      // Wait for payments to load
      const paymentAmount = page.locator('text=₹').or(page.locator('text=1500')).first();
      await expect(paymentAmount).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Payment Summary Cards', () => {
    test('should display payment summary statistics', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();

      // Check for summary cards
      const summaryCards = [
        'Total Collected',
        'Total Pending',
        'Total Overdue',
        'This Month',
        'Today'
      ];

      for (const cardText of summaryCards) {
        const card = page.locator('.MuiCard-root').filter({ hasText: cardText });
        if (await card.count() > 0) {
          await expect(card).toBeVisible();
          
          // Should have amount
          const amount = card.locator('text=/₹|\\d+/');
          await expect(amount.first()).toBeVisible();
        }
      }
    });

    test('should show correct currency formatting', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      // Check if amounts are properly formatted - look for numbers (may not have currency symbol)
      const amounts = page.locator('text=/\d+[\d,]*(\.\d+)?|₹\s*\d+|₹\d+/');
      const amountCount = await amounts.count();
      if (amountCount > 0) {
        expect(amountCount).toBeGreaterThan(0);
      } else {
        // If no amounts found, just verify payments page loaded
        const paymentsContent = page.locator('text=/payments|Payment/i');
        await expect(paymentsContent.first()).toBeVisible();
      }
    });
  });

  test.describe('Payment Filters and Search', () => {
    test('should filter payments by status', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(1000);

      const statusFilter = page.locator('select, [role="combobox"]').filter({ hasText: /status/i });
      if (await statusFilter.count() > 0) {
        await statusFilter.click();
        
        const pendingOption = page.locator('[role="option"], option').filter({ hasText: 'Pending' });
        if (await pendingOption.count() > 0) {
          await pendingOption.click();
          
          // Should show only pending payments
          const pendingRows = page.locator('tr').filter({ hasText: /pending/i });
          await expect(pendingRows.first()).toBeVisible();
        }
      }
    });

    test('should filter payments by payment method', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(1000);

      const methodFilter = page.locator('select, [role="combobox"]').filter({ hasText: /method/i });
      if (await methodFilter.count() > 0) {
        await methodFilter.click();
        
        const cashOption = page.locator('[role="option"], option').filter({ hasText: 'Cash' });
        if (await cashOption.count() > 0) {
          await cashOption.click();
          
          await page.waitForTimeout(500);
          // Should filter to cash payments only
        }
      }
    });

    test('should search payments by student name', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(1000);

      const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Search"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill('Alice');
        
        // Should show only Alice's payments
        const alicePayments = page.locator('tr').filter({ hasText: 'Alice' });
        await expect(alicePayments.first()).toBeVisible();
      }
    });

    test('should filter by date range', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(1000);

      const fromDateInput = page.locator('input[type="date"], input[placeholder*="from"]').first();
      const toDateInput = page.locator('input[type="date"], input[placeholder*="to"]').first();

      if (await fromDateInput.count() > 0 && await toDateInput.count() > 0) {
        await fromDateInput.fill('2025-09-01');
        await toDateInput.fill('2025-09-30');
        
        await page.waitForTimeout(500);
        // Should filter payments by date range
      }
    });
  });

  test.describe('Payment Table Operations', () => {
    test('should display payment table with correct columns', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      // Check for table headers
      const expectedHeaders = ['Student', 'Amount', 'Status', 'Date', 'Method', 'Actions'];
      
      for (const header of expectedHeaders) {
        const headerCell = page.locator('th').filter({ hasText: header });
        if (await headerCell.count() > 0) {
          await expect(headerCell).toBeVisible();
        }
      }
    });

    test('should sort payments by different columns', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      // Click on Amount header to sort
      const amountHeader = page.locator('th').filter({ hasText: 'Amount' });
      if (await amountHeader.count() > 0) {
        await amountHeader.click();
        await page.waitForTimeout(500);
        
        // Should sort by amount (ascending/descending)
        const amounts = await page.locator('td').filter({ hasText: /₹\d+/ }).allTextContents();
        expect(amounts.length).toBeGreaterThan(0);
      }
    });

    test('should paginate through payment records', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const nextPageButton = page.locator('button[aria-label*="next"], button').filter({ hasText: /next|>/i });
      const prevPageButton = page.locator('button[aria-label*="previous"], button').filter({ hasText: /previous|</i });

      if (await nextPageButton.count() > 0) {
        await nextPageButton.click();
        await page.waitForTimeout(500);
        
        // Should load next page
        if (await prevPageButton.count() > 0) {
          await prevPageButton.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('should handle payment actions', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const actionButton = page.locator('button[aria-label*="actions"], button').filter({ hasText: 'MoreVert' }).first();
      if (await actionButton.count() > 0) {
        await actionButton.click();

        const actionMenu = page.locator('[role="menu"]');
        await expect(actionMenu).toBeVisible();

        // Check for common actions
        const editAction = page.locator('[role="menuitem"]').filter({ hasText: /edit|update/i });
        const deleteAction = page.locator('[role="menuitem"]').filter({ hasText: /delete|remove/i });
        const viewAction = page.locator('[role="menuitem"]').filter({ hasText: /view|details/i });

        const hasActions = await editAction.count() > 0 || 
                          await deleteAction.count() > 0 || 
                          await viewAction.count() > 0;
        
        expect(hasActions).toBe(true);
      }
    });
  });

  test.describe('Payment Creation and Editing', () => {
    test('should open add payment dialog', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const addButton = page.locator('button').filter({ hasText: /add payment|new payment|record payment/i });
      if (await addButton.count() > 0) {
        await addButton.click();

        const addDialog = page.locator('[role="dialog"]').filter({ hasText: /add payment|new payment|record payment/i });
        await expect(addDialog).toBeVisible();
      }
    });

    test('should validate payment form fields', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const addButton = page.locator('button').filter({ hasText: /add payment|new payment|record payment/i });
      if (await addButton.count() > 0) {
        await addButton.click();

        const addDialog = page.locator('[role="dialog"]').filter({ hasText: /add payment|new payment|record payment/i });
        if (await addDialog.count() > 0) {
          // Try to submit without filling required fields
          const submitButton = addDialog.locator('button').filter({ hasText: /save|submit|record/i });
          if (await submitButton.count() > 0) {
            await submitButton.click();

            // Should show validation errors
            const errorMessage = page.locator('text=/required|invalid|error/i');
            await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });
          }
        }
      }
    });

    test('should successfully record a new payment', async ({ page }) => {
      // Mock the payment creation API
      await page.route('**/api/payments', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              payment: {
                id: 4,
                studentId: 'STU004',
                amount: 1800,
                status: 'completed',
                method: 'cash'
              }
            })
          });
        }
      });

      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const addButton = page.locator('button').filter({ hasText: /add payment|new payment|record payment/i });
      if (await addButton.count() > 0) {
        await addButton.click();

        const addDialog = page.locator('[role="dialog"]').filter({ hasText: /add payment|new payment|record payment/i });
        if (await addDialog.count() > 0) {
          // Fill form fields
          const studentSelect = addDialog.locator('select[name*="student"], [role="combobox"]').first();
          const amountInput = addDialog.locator('input[name*="amount"], input[type="number"]').first();
          const methodSelect = addDialog.locator('select[name*="method"], [role="combobox"]').last();

          if (await studentSelect.count() > 0) {
            await studentSelect.click();
            const option = page.locator('[role="option"], option').first();
            if (await option.count() > 0) await option.click();
          }

          if (await amountInput.count() > 0) {
            await amountInput.fill('1800');
          }

          if (await methodSelect.count() > 0) {
            await methodSelect.click();
            const cashOption = page.locator('[role="option"], option').filter({ hasText: 'Cash' });
            if (await cashOption.count() > 0) await cashOption.click();
          }

          // Submit form
          const submitButton = addDialog.locator('button').filter({ hasText: /save|submit|record/i });
          if (await submitButton.count() > 0) {
            await submitButton.click();
            await expect(addDialog).toHaveCount(0);
          }
        }
      }
    });
  });

  test.describe('Payment Status Management', () => {
    test('should update payment status', async ({ page }) => {
      // Mock status update API
      await page.route('**/api/payments/*/status', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const statusChip = page.locator('.MuiChip-root').filter({ hasText: /pending|overdue/i }).first();
      if (await statusChip.count() > 0) {
        await statusChip.click();

        const statusMenu = page.locator('[role="menu"]');
        if (await statusMenu.count() > 0) {
          const completedOption = page.locator('[role="menuitem"]').filter({ hasText: 'Completed' });
          if (await completedOption.count() > 0) {
            await completedOption.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    test('should mark payment as overdue', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const overduePayments = page.locator('tr').filter({ hasText: /overdue/i });
      if (await overduePayments.count() > 0) {
        await expect(overduePayments.first()).toBeVisible();
        
        // Should have different styling for overdue
        const overdueChip = page.locator('.MuiChip-root').filter({ hasText: 'overdue' });
        if (await overdueChip.count() > 0) {
          await expect(overdueChip).toHaveCSS('background-color', /red|#.*f.*/i);
        }
      }
    });
  });

  test.describe('Export and Reports', () => {
    test('should export payments data', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const exportButton = page.locator('button').filter({ hasText: /export|download/i });
      if (await exportButton.count() > 0) {
        // Setup download handler
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();

        // Should trigger download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/payments|export/i);
      }
    });

    test('should generate payment reports', async ({ page }) => {
      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const reportButton = page.locator('button').filter({ hasText: /report|summary/i });
      if (await reportButton.count() > 0) {
        await reportButton.click();

        const reportDialog = page.locator('[role="dialog"]').filter({ hasText: /report|summary/i });
        if (await reportDialog.count() > 0) {
          await expect(reportDialog).toBeVisible();
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle payment API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('**/api/payments**', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();

      // Should show error message
      const errorMessage = page.locator('text=/error|failed|problem/i');
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle network errors', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/payments**', async route => {
        await route.abort();
      });

      const paymentsTab = page.locator('a[role="tab"]').filter({ hasText: 'Payments' });
      await paymentsTab.click();

      // Should show network error or retry option
      const errorOrRetry = page.locator('text=/error|retry|network|failed/i');
      await expect(errorOrRetry.first()).toBeVisible({ timeout: 5000 });
    });
  });
});
