/**
 * X composer (spec 132 §4.5) — mobile gate evidence (spec 142) + the
 * composer-slot mount in the destination frame (spec 131 PR-131-4).
 *
 * Fixture-served per A3 discipline: the destination detail read and
 * the destination posting-slots read are answered from the fixtures
 * below; the enqueue POST is the shared fixture handler
 * (`installApiFixtures`). No production data, no third-party traffic.
 *
 * Per viewport (320 / 360 / 390 / 430 / 768 / 1024): the X composer
 * renders inside the frame's composer slot with its identity header,
 * the contracts-derived limit note and the weighted counter, stacked
 * with zero horizontal overflow and a compact 36px submit target (compact default density — Shahzeb 2026-10-24, spec 129 OD-4 as amended). Flow tests
 * at 390px: a Post-now submit lands the success banner, and the poll
 * builder opens with its option fields.
 */
import { test, expect } from '@playwright/test';

import { createFixtureState, installApiFixtures } from './fixtures/api';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

const SUB = TENANT.subdomain;
const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';

const DESTINATION = {
  id: DESTINATION_ID,
  externalDestinationId: 'x-user-1',
  name: 'Fixture X',
  handle: 'fixturex',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  accountType: null,
  platform: 'x',
  account: {
    id: '22222222-2222-4222-8222-222222222222',
    displayName: 'Fixture Creator',
    platform: 'x',
    status: 'active',
  },
};

const SLOTS = {
  destinationId: DESTINATION_ID,
  timezone: 'UTC',
  slots: [
    { id: SLOT_ID, destinationId: DESTINATION_ID, kind: [], timeOfDay: '09:00', isActive: true },
  ],
};

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openXDestination(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  await context.addCookies([SESSION_COOKIE]);
  const state = createFixtureState();
  await installApiFixtures(page, state);
  await page.route(`**/api/tenant/${SUB}/accounts/social/${DESTINATION_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ destination: DESTINATION }),
    })
  );
  await page.route(`**/api/tenant/${SUB}/destinations/${DESTINATION_ID}/posting-slots`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SLOTS),
    })
  );
  await page.goto(`/tenant/${SUB}/destinations/${DESTINATION_ID}`);
  await expect(page.getByTestId('x-composer')).toBeVisible();
}

test.describe('x composer in the destination frame', () => {
  for (const width of [320, 360, 390, 430, 768, 1024]) {
    test(`renders in the composer slot at ${width}px with no overflow`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 900 });
      await openXDestination(page, context);

      const slot = page.getByTestId('destination-slot-composer');
      await expect(slot).toHaveAttribute('data-platform', 'x');
      await expect(slot.getByTestId('x-composer')).toBeVisible();
      await expect(page.getByTestId('x-composer-limit-note')).toContainText(
        "This account's limit on X is 100 posts per 15 minutes."
      );
      await expect(page.getByTestId('x-composer-text-field')).toBeVisible();
      await expect(page.getByTestId('x-composer-text-count')).toHaveText('0 / 280');
      await expect(page.getByTestId('x-composer-queue-line')).toContainText(
        'Goes out at the next posting time:'
      );

      const submit = page.getByTestId('x-composer-submit-btn');
      const box = await submit.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('posts now at 390px and shows the success banner', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openXDestination(page, context);

    await page.getByTestId('composer-intent-now').click();
    await page.getByTestId('x-composer-text-field').fill('Hello from the fixture');
    await expect(page.getByTestId('x-composer-text-count')).toHaveText('22 / 280');
    const submit = page.getByTestId('x-composer-submit-btn');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByTestId('x-composer-success')).toContainText('Posted to Fixture X.');
    await expectNoHorizontalOverflow(page);
  });

  test('opens the poll builder at 390px with option fields and no overflow', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openXDestination(page, context);

    await page.getByTestId('x-composer-add-poll-btn').click();
    await expect(page.getByTestId('x-composer-poll-option-0')).toBeVisible();
    await page.getByTestId('x-composer-poll-option-0').fill('Yes');
    await page.getByTestId('x-composer-poll-option-1').fill('No');
    await page.getByTestId('x-composer-text-field').fill('Best option?');
    await expect(page.getByTestId('x-composer-submit-btn')).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });
});
