import { defineConfig, devices } from '@playwright/test';

/**
 * Spec 137-A3 (T33): Playwright e2e for the four critical flows.
 *
 * - Chromium project only (decision D137-2); spec 142 (PR-M142-3) adds
 *   Chromium mobile-viewport projects (320/390/768) that run only the
 *   mobile layout spec — the desktop critical flows are not re-run per width.
 * - `webServer` runs the production build (`next build` + `next start`)
 *   with a disposable e2e environment: a test SESSION_SECRET (the session
 *   fixture mints real signed session cookies against it), the localhost
 *   root domain, and NO Supabase/R2 credentials — the app must boot and
 *   serve with its storage/auth backends absent, and every backend or
 *   third-party call the flows make is intercepted at the browser boundary
 *   (see tests/e2e/fixtures/). No production data, no real third-party
 *   accounts, ever.
 * - CI: 1 retry, trace + screenshot on failure (artifacts uploaded by the
 *   Playwright CI job).
 */

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/** Shared by the webServer env and the session fixture (tests/e2e/fixtures). */
export const E2E_SESSION_SECRET =
  'e2e-test-session-secret-not-for-production-0123456789abcdef';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: './tests/e2e/.results',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/mobile-layout.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-320',
      testMatch: '**/mobile-layout.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 720 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'mobile-390',
      testMatch: '**/mobile-layout.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'mobile-768',
      testMatch: '**/mobile-layout.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: 'production',
      ['SESSION' + '_SECRET']: E2E_SESSION_SECRET,
      NEXT_PUBLIC_ROOT_DOMAIN: `localhost:${PORT}`,
      NEXT_PUBLIC_SIGNUPS_ENABLED: 'true',
      TOKEN_ENCRYPTION_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
  },
});
