import { defineConfig, devices } from '@playwright/test';

/**
 * Spec 137-A3 (T33): Playwright e2e for the four critical flows.
 *
 * - Chromium project only (decision D137-2).
 * - `webServer` runs the production build (`next build` + `next start`)
 *   with a disposable e2e environment: a test SESSION_SECRET (the session
 *   fixture mints real signed session cookies against it), the localhost
 *   root domain, and dummy values for the full required env set — spec
 *   139's boot-time validation fails a production boot that is missing
 *   any of them. The values are non-functional (no real Supabase/R2/
 *   Upstash/PostHog backends behind them), and every backend or
 *   third-party call the flows make is intercepted at the browser
 *   boundary (see tests/e2e/fixtures/). No production data, no real
 *   third-party accounts, ever.
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
      use: { ...devices['Desktop Chrome'] },
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
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NEXT_PUBLIC_SIGNUPS_ENABLED: 'true',
      TOKEN_ENCRYPTION_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      // Dummy values for the rest of spec 139's required env set — the
      // production boot validator demands the full set; none of these
      // point at a real backend (see the header comment). The Supabase
      // values use the codebase's `placeholder` convention: the client
      // factories (lib/auth/clients.ts) treat it as "not configured" and
      // refuse instantly — a live-looking dummy URL instead makes
      // supabase-js retry a dead backend for ~7s per query, which stalls
      // SSR past the specs' timeouts.
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
      UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
      UPSTASH_REDIS_REST_TOKEN: 'e2e-test-upstash-token',
      R2_ACCOUNT_ID: 'e2e-test-r2-account',
      R2_ACCESS_KEY_ID: 'e2e-test-r2-access-key',
      R2_SECRET_ACCESS_KEY: 'e2e-test-r2-secret-key',
      R2_BUCKET_NAME: 'e2e-test-bucket',
      POSTHOG_KEY: 'e2e-test-posthog-key',
    },
  },
});
