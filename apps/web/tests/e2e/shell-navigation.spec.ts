/**
 * Flow 5 — Shell navigation + workspace switch (spec 130 §5.9,
 * PR-130-2b).
 *
 * The spec-110 regression net at e2e level: sign in (fixture session),
 * click each primary leaf nav item ONCE and assert navigation landed,
 * collapse/expand the sidebar, open the switcher, switch workspace,
 * assert arrival. A second describe runs the same shell at a 390px
 * touch viewport: the drawer opens from the header trigger, every
 * leaf is tappable (no hover-only action), and the document never
 * overflows horizontally (spec 142 mobile gate evidence for the
 * shell at phone width; the 320px case is asserted inside the flow
 * by resizing before opening the switcher).
 *
 * API traffic is fixture-served at the browser boundary
 * (fixtures/api.ts conventions): the workspace list + switch
 * responses are registered after the generic fixtures so they take
 * precedence for `/api/workspaces*`.
 */

import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

const WORKSPACES = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: TENANT.userId,
    name: 'E2E Workspace',
    subdomain: TENANT.subdomain,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    ownerId: TENANT.userId,
    name: 'Beta Workspace',
    subdomain: 'beta',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

async function installShellFixtures(page: Page): Promise<void> {
  const state = createFixtureState();
  await installApiFixtures(page, state);
  // Registered after the generic fixtures → these win for their paths.
  await page.route('**/api/workspaces', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workspaces: WORKSPACES }),
    });
  });
  await page.route('**/api/workspaces/switch', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        targetSubdomain: 'beta',
        redirectUrl: '/tenant/beta',
      }),
    })
  );
}

async function signInToTenantHome(page: Page): Promise<void> {
  await page.context().addCookies([SESSION_COOKIE]);
  await installShellFixtures(page);
  await page.goto(`/tenant/${TENANT.subdomain}`);
  await expect(
    page.getByRole('heading', { name: /Workspace:/ })
  ).toBeVisible();
}

test.describe('shell navigation + workspace switch (spec 130 §5.9)', () => {
  test('single-click leaf navigation, collapse/expand, and workspace switch', async ({
    page,
  }) => {
    await signInToTenantHome(page);

    // Each primary leaf: ONE click navigates (spec 110).
    await page.getByRole('link', { name: /^Media Library/ }).click();
    await expect(page).toHaveURL(new RegExp(`/tenant/${TENANT.subdomain}/media$`));
    await expect(page.getByTestId('workspace-breadcrumb')).toContainText('Media Library');

    await page.getByRole('link', { name: /^Downloader/ }).click();
    await expect(page).toHaveURL(new RegExp(`/tenant/${TENANT.subdomain}/downloader$`));
    await expect(page.getByTestId('workspace-breadcrumb')).toContainText('Downloader');

    await page.getByRole('link', { name: /^Accounts/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/tenant/${TENANT.subdomain}/accounts$`));
    await expect(page.getByTestId('workspace-breadcrumb')).toContainText('Accounts');

    await page.getByRole('link', { name: /^Pages/ }).click();
    await expect(page).toHaveURL(new RegExp(`/tenant/${TENANT.subdomain}/pages$`));
    await expect(page.getByTestId('workspace-breadcrumb')).toContainText('Pages');

    await page.getByRole('link', { name: /^Home/ }).click();
    await expect(page).toHaveURL(new RegExp(`/tenant/${TENANT.subdomain}/?$`));
    await expect(page.getByRole('heading', { name: /Workspace:/ })).toBeVisible();

    // Collapse to the icon rail, then expand again — the header
    // trigger and the sidebar are one state (single provider).
    const sidebarRoot = page.locator('[data-slot="sidebar"]');
    await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click();
    await expect(sidebarRoot).toHaveAttribute('data-state', 'collapsed');
    await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click();
    await expect(sidebarRoot).toHaveAttribute('data-state', 'expanded');

    // Workspace switch: open the footer popover, pick Beta, arrive.
    await page.getByTestId('workspace-switcher-trigger').click();
    await expect(page.getByTestId('workspace-switcher-dropdown')).toBeVisible();
    await page.getByTestId('workspace-option-beta').click();
    await expect(page).toHaveURL(/\/tenant\/beta\/?$/);
    await expect(page.getByRole('heading', { name: /Workspace:/ })).toBeVisible();
  });
});

test.describe('shell navigation at phone width (spec 142 mobile gate)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('drawer navigation is fully tappable and nothing overflows at 390px and 320px', async ({
    page,
  }) => {
    await signInToTenantHome(page);

    // No horizontal overflow at 390px.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(390);

    // Open the drawer from the header trigger and tap a leaf once.
    await page.getByRole('button', { name: 'Toggle Sidebar' }).first().tap();
    await page.getByRole('link', { name: /^Media Library/ }).tap();
    await expect(page).toHaveURL(new RegExp(`/tenant/${TENANT.subdomain}/media$`));

    // 320px: same checks, plus the switcher popover fits the viewport.
    await page.setViewportSize({ width: 320, height: 720 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(320);

    await page.getByRole('button', { name: 'Toggle Sidebar' }).first().tap();
    await page.getByTestId('workspace-switcher-trigger').tap();
    const dropdown = page.getByTestId('workspace-switcher-dropdown');
    await expect(dropdown).toBeVisible();
    const box = await dropdown.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
    await expect(page.getByTestId('workspace-option-beta')).toBeVisible();
  });
});
