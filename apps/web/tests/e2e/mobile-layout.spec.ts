/**
 * Mobile layout evidence (spec 142, PR-M142-3; closes M142-INFRA-001).
 *
 * Runs ONLY on the six mobile projects (see playwright.config.ts):
 * mobile-320, mobile-360, mobile-390, mobile-430, mobile-768, and
 * mobile-1024 — the full spec 142 §2 viewport matrix (compact phone
 * 320/360, standard phone 390/430, tablet portrait 768, tablet
 * landscape 1024). The desktop `chromium` project ignores this spec and
 * the mobile projects match only this spec, so the desktop critical
 * flows are not re-run per width.
 *
 * Each project gives both hermetic routes below evidence at its own
 * width (12 tests across the matrix):
 * - `/login`, including the failed-sign-in error summary.
 * - The fixture workspace home (`/tenant/<subdomain>` on the tenant
 *   subdomain).
 *
 * Assertions are honest to what this PR owns: no document-level
 * horizontal overflow, and the key controls geometrically inside the
 * viewport, at every width. Touch-height assertions are deliberately
 * NOT made on the login controls here — that geometry lands in
 * PR-M142-1 on a separate branch. The `expectMinTouchHeight` helper
 * stays in fixtures/mobile.ts for that slice and surface suites to
 * adopt.
 */

import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { expectNoDocumentOverflow, expectWithinViewport } from './fixtures/mobile';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

/**
 * The project name carries its width (`mobile-320` … `mobile-1024`);
 * assert the live viewport really is that width so a misconfigured
 * project cannot silently produce evidence for the wrong size.
 */
function expectProjectViewport(page: Page, testInfo: TestInfo): void {
  const match = /^mobile-(\d+)$/.exec(testInfo.project.name);
  if (!match) {
    throw new Error(`mobile-layout spec ran on unexpected project "${testInfo.project.name}"`);
  }
  const expectedWidth = Number(match[1]);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('expectProjectViewport: page has no viewport');
  expect(viewport.width, 'project viewport width must match the project name').toBe(expectedWidth);
}

test.describe('mobile layout', () => {
  test('login fits the viewport; the error summary stays inside it', async (
    { page },
    testInfo
  ) => {
    expectProjectViewport(page, testInfo);
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
    await expect(summary).toContainText('Invalid email or password');
    await expectWithinViewport(summary, page);
    await expectNoDocumentOverflow(page);
  });

  test('workspace home fits the viewport', async ({ page, context }, testInfo) => {
    expectProjectViewport(page, testInfo);
    await context.addCookies([
      SESSION_COOKIE,
      { ...SESSION_COOKIE, domain: `${TENANT.subdomain}.localhost` },
    ]);
    const state = createFixtureState();
    await installApiFixtures(page, state);

    await page.goto(`http://${TENANT.subdomain}.localhost:3100/tenant/${TENANT.subdomain}`);
    const heading = page.getByRole('heading', { name: /Workspace:/ });
    await expect(heading).toBeVisible();
    await expect(page.getByText('Welcome to your FBUploadPro workspace.')).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectWithinViewport(heading, page);
    await expectWithinViewport(
      page.getByText('Welcome to your FBUploadPro workspace.'),
      page
    );
    const topbar = page.getByTestId('workspace-topbar');
    await expect(topbar).toBeVisible();
    await expectWithinViewport(topbar, page);
    const sidebarTrigger = page.getByRole('button', { name: 'Toggle Sidebar' });
    await expect(sidebarTrigger).toBeVisible();
    await expectWithinViewport(sidebarTrigger, page);
    await expectNoDocumentOverflow(page);
  });
});
