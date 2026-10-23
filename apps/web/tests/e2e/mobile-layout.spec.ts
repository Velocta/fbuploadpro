/**
 * Mobile layout evidence (spec 142, PR-M142-3; closes M142-INFRA-001).
 *
 * Runs ONLY on the mobile-320 / mobile-390 / mobile-768 projects (see
 * playwright.config.ts). Asserts the layout contract of spec 142 §3 on
 * the routes the hermetic fixtures support today: no document-level
 * horizontal overflow, and the critical controls geometrically inside
 * the viewport, at compact-phone, standard-phone, and tablet widths.
 * Touch-height assertions live in fixtures/mobile.ts for the geometry
 * slices (PR-M142-1/2) and surface suites to adopt.
 */

import { test, expect } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { expectNoDocumentOverflow, expectWithinViewport } from './fixtures/mobile';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

test.describe('mobile layout', () => {
  test('login fits the viewport; the error summary stays inside it', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid email or password' }),
      })
    );

    await page.goto('/login');
    const email = page.getByLabel('Email Address');
    const password = page.getByLabel('Password', { exact: true });
    const signIn = page.getByRole('button', { name: 'Sign In' });
    await expect(email).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectWithinViewport(email, page);
    await expectWithinViewport(password, page);
    await expectWithinViewport(signIn, page);

    await email.fill(TENANT.email);
    await password.fill(TENANT.wrongPassword);
    await signIn.click();

    const summary = page.locator('[data-slot="form-error-summary"]');
    await expect(summary).toBeVisible();
    await expectWithinViewport(summary, page);
    await expectNoDocumentOverflow(page);
  });

  test('workspace home fits the viewport', async ({ page, context }) => {
    await context.addCookies([
      SESSION_COOKIE,
      { ...SESSION_COOKIE, domain: `${TENANT.subdomain}.localhost` },
    ]);
    const state = createFixtureState();
    await installApiFixtures(page, state);

    await page.goto(`http://${TENANT.subdomain}.localhost:3100/tenant/${TENANT.subdomain}`);
    await expect(page.getByRole('heading', { name: /Workspace:/ })).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
});
