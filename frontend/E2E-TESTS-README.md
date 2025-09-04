Playwright E2E tests

Setup (run in the `frontend` folder):

1. Install Playwright test runner and browsers:

   npm install -D @playwright/test
   npx playwright install

2. Run tests:

   npm run test:e2e

Notes:
- Tests expect the frontend dev server running at http://localhost:5173 by default. You can set FRONTEND_BASE_URL to change it.
- The repository does not add Playwright as a dependency automatically; run the install command above.
- If the app requires authentication, you may need to either run tests against a dev server with a seeded test user or extend tests to log in programmatically.
