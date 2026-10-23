/**
 * Flow 1 — Login (spec 137-A3, T34).
 *
 * - Success: valid credentials → the app navigates to the workspace home,
 *   which renders for real (middleware + tenant layout verify the session
 *   cookie the login response sets).
 * - Wrong password: asserts the CURRENT error presentation — a form-level
 *   alert ("Invalid email or password", the API's own message) with the
 *   typed input preserved. PR-A6 converts this form to the form standard and
 *   updates these assertions to the summary + inline pattern (spec §3.8).
 * - Session-expired notice: the login page does NOT render a
 *   `reason=session-expired` notice today (verified below — the form
 *   simply loads). Rendering that notice is PR-A6's / spec 136's duty per
 *   spec §3.1/§4.5; A6's PR adds the assertion when it lands the notice.
 *   Flagged in PR-A3's body as an A6 follow-up.
 */

import { test, expect } from '@playwright/test';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

test.describe('login', () => {
  test('success signs in and lands on the workspace home', async ({ page, context }) => {
    await page.route('**/api/auth/login', async (route) => {
      // The real login response sets the session cookie scoped to the root
      // domain (production: .fbuploadpro.com), so it is valid on the tenant
      // subdomain the app redirects to. Chrome treats localhost cookies as
      // host-only, so the fixture plants the same session cookie for both
      // hosts involved — the localhost equivalent of that one cookie.
      await context.addCookies([
        SESSION_COOKIE,
        { ...SESSION_COOKIE, domain: `${TENANT.subdomain}.localhost` },
      ]);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          redirectUrl: `/tenant/${TENANT.subdomain}`,
          user: { id: TENANT.userId, email: TENANT.email, subdomain: TENANT.subdomain },
        }),
      });
    });

    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TENANT.email);
    await page.getByLabel('Password', { exact: true }).fill(TENANT.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Post-login the app navigates to the tenant subdomain home
    // (http://e2e.localhost:3100/tenant/e2e), which middleware rewrites to
    // the workspace home.
    await expect(page).toHaveURL(
      new RegExp(`${TENANT.subdomain}\\.localhost:3100/tenant/${TENANT.subdomain}$`)
    );
    await expect(
      page.getByRole('heading', { name: new RegExp(`Workspace:`) })
    ).toBeVisible();
    await expect(page.getByText('Welcome to your FBUploadPro workspace.')).toBeVisible();
  });

  test('wrong password shows the current form-level error and keeps the input', async ({
    page,
  }) => {
    // The real route's wrong-credentials response (lib/auth-errors.ts):
    // 401 { error: 'Invalid email or password' }.
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid email or password' }),
      })
    );

    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TENANT.email);
    await page.getByLabel('Password', { exact: true }).fill(TENANT.wrongPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    const alert = page.locator('.fbu-form-error-callout');
    await expect(alert).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
    // A failed submit never clears what the user typed.
    await expect(page.getByLabel('Email Address')).toHaveValue(TENANT.email);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue(TENANT.wrongPassword);
  });

  test('client-side validation marks a non-Gmail address inline without a request', async ({
    page,
  }) => {
    let loginRequests = 0;
    await page.route('**/api/auth/login', (route) => {
      loginRequests += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/login');
    await page.getByLabel('Email Address').fill('owner@example.com');
    await page.getByLabel('Password', { exact: true }).fill(TENANT.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(
      page.getByText('Only @gmail.com (or @googlemail.com) accounts are supported.')
    ).toBeVisible();
    expect(loginRequests).toBe(0);
  });

  test('session-expired return loads the form (notice itself is PR-A6 scope)', async ({
    page,
  }) => {
    // Today /login?reason=session-expired renders the plain sign-in form —
    // no notice exists yet. This pins the current behaviour so A6's
    // conversion visibly changes it and updates this test.
    await page.goto('/login?reason=session-expired');
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByText(/session expired/i)).toHaveCount(0);
  });
});
