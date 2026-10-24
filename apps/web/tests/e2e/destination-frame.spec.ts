/**
 * Destination frame (spec 131 PR-131-4) — mobile gate evidence (spec 142).
 *
 * Fixture-served per A3 discipline: the destination detail read is
 * answered from the fixture below (the route's server prefetch misses
 * against the fixture backend, so the frame shell's cache read is the
 * browser fetch this route intercepts — the same fall-through the
 * Accounts shell uses). No production data, no third-party traffic.
 *
 * Per viewport (320 / 390 / 768): the frame renders its identity header
 * (platform + name + status), the verbatim summary fields, and all four
 * spec 128 slots (queue / composer / posting-times / history), stacked
 * with zero horizontal overflow and ≥44px back-link target. The connect
 * picker notice state is checked at 320px the same way.
 */
import { test, expect } from '@playwright/test';

import { createFixtureState, installApiFixtures } from './fixtures/api';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

const SUB = TENANT.subdomain;
const DESTINATION_ID = 'dest-row-1';

const DESTINATION = {
  id: DESTINATION_ID,
  externalDestinationId: 'dest-1001',
  name: 'My Brand',
  handle: 'mybrand',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  accountType: null,
  platform: 'instagram',
  account: {
    id: 'acct-1',
    displayName: 'Fixture Creator',
    platform: 'instagram',
    status: 'active',
  },
};

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('destination frame', () => {
  for (const width of [320, 390, 768]) {
    test(`renders header, summary and all four slots at ${width}px`, async ({
      page,
      context,
    }) => {
      await context.addCookies([SESSION_COOKIE]);
      const state = createFixtureState();
      await installApiFixtures(page, state);
      await page.route(
        `**/api/tenant/${SUB}/accounts/social/${DESTINATION_ID}`,
        (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ destination: DESTINATION }),
          })
      );

      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/tenant/${SUB}/destinations/${DESTINATION_ID}`);

      await expect(page.getByTestId('destination-name')).toHaveText('My Brand');
      await expect(page.getByText('Connected', { exact: true })).toBeVisible();
      await expect(page.getByText('Platform: Instagram')).toBeVisible();
      await expect(page.getByText('Connected through: Fixture Creator')).toBeVisible();
      await expect(page.getByText('Handle: @mybrand')).toBeVisible();
      await expect(page.getByText('Posting timezone: UTC')).toBeVisible();

      for (const slot of ['queue', 'composer', 'posting-times', 'history']) {
        await expect(page.getByTestId(`destination-slot-${slot}`)).toBeVisible();
      }

      const backLink = page.getByRole('link', { name: 'Back to Accounts' });
      await expect(backLink).toBeVisible();
      const box = await backLink.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('connect picker notice state renders at 320px with a 44px accounts link', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/tenant/${SUB}/connect/instagram`);

    await expect(page.getByTestId('connect-picker-page')).toBeVisible();
    await expect(
      page.getByText('This connection link has expired. Please start again from Accounts.')
    ).toBeVisible();
    const link = page.getByTestId('connect-picker-accounts-link');
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });
});
