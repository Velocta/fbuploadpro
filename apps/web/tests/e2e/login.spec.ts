/**
 * Flow 1 — Login (spec 137-A3, T34; updated by PR-A6, T54).
 *
 * - Success: valid credentials → the app navigates to the workspace home,
 *   which renders for real (middleware + tenant layout verify the session
 *   cookie the login response sets).
 * - Wrong password: PR-A6 converted the form to the §3.8 form standard —
 *   the server error now lands in the FormErrorSummary (`role="alert"`,
 *   focused on submit failure) and the typed input is preserved.
 * - Client validation: a non-Gmail address errors inline AND in the
 *   summary (identical wording, summary entry links to the field),
 *   without any login request.
 * - Session-expired notice (§3.1 contract, landed by PR-A6): arriving
 *   with `?reason=session-expired` renders the plain-language notice —
 *   this replaces PR-A3's pinned count-0 assertion.
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
          success: true,
          redirectUrl: `/tenant/${TENANT.subdomain}`,
          user: {
            id: TENANT.userId,
            email: TENANT.email,
            name: TENANT.name,
            subdomain: TENANT.subdomain,
            role: 'admin',
            status: 'active',
          },
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

  test('wrong password shows the error in the focused summary and keeps the input', async ({
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

    const summary = page.locator('[data-slot="form-error-summary"]');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Invalid email or password');
    await expect(summary).toBeFocused();
    await expect(page).toHaveURL(/\/login$/);
    // A failed submit never clears what the user typed.
    await expect(page.getByLabel('Email Address')).toHaveValue(TENANT.email);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue(TENANT.wrongPassword);
  });

  test('client-side validation marks a non-Gmail address inline and in the summary without a request', async ({
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

    // Inline message under the field…
    const inline = page.locator('#login-email-message');
    await expect(inline).toHaveText(
      'Only @gmail.com (or @googlemail.com) accounts are supported.'
    );
    // …and the identical wording as a summary entry linking to the field.
    const summary = page.locator('[data-slot="form-error-summary"]');
    const link = summary.getByRole('link', {
      name: 'Only @gmail.com (or @googlemail.com) accounts are supported.',
    });
    await expect(link).toHaveAttribute('href', '#login-email');
    await expect(summary).toBeFocused();
    await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-invalid', 'true');
    expect(loginRequests).toBe(0);
  });

  test('session-expired return renders the session-expired notice (§3.1, PR-A6)', async ({
    page,
  }) => {
    await page.goto('/login?next=%2Ftenant%2Fe2e&reason=session-expired');
    await expect(
      page.getByText('Your session expired — sign in again to pick up where you left off')
    ).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});
