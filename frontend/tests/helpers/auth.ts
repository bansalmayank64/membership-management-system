import { test as base, Page } from '@playwright/test';

// Create a mock JWT token that won't expire for a while
function createMockJWT() {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { 
    id: 1, 
    name: 'Test User', 
    role: 'admin', 
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Expires in 24 hours
  };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = 'mockSignature';
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Extend base test with a `login` helper that sets a proper mock JWT token
export const test = base.extend<{ login: (page: Page) => Promise<void> }>({
  login: async ({ }, use) => {
    await use(async (page: Page) => {
      // Set a proper mock JWT token that won't trigger client-side expiry checks
      const mockToken = createMockJWT();
      
      // Set up authentication BEFORE any page navigation
      // This prevents the AuthContext from triggering login dialogs
      await page.addInitScript((token: string) => {
        try { 
          localStorage.setItem('authToken', token);
          // Also set a flag to indicate we're in test mode
          (window as any).__PLAYWRIGHT_TEST__ = true;
        } catch (e) {
          console.error('Failed to set auth token:', e);
        }
      }, mockToken);
      
      // Additionally, block any confirm dialogs that might appear
      await page.addInitScript(() => {
        // Override window.confirm to always return true for session expired dialogs
        const originalConfirm = window.confirm;
        window.confirm = (message?: string) => {
          if (message && (message.includes('session has expired') || message.includes('Session expired'))) {
            return false; // Don't show the confirm dialog
          }
          return originalConfirm.call(window, message);
        };
      });
    });
  }
});

export { expect } from '@playwright/test';
