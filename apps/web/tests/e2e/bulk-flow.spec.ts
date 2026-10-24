/**
 * Bulk creation flow — spec 132 PR-C2 (spec 137 §4.6 e2e growth).
 *
 * On the seeded Facebook Page's queue view: open Bulk add (rebuilt as a
 * full page, OD132-1 (a)), choose two library items, walk Details
 * (queue destination + successive-slot range) → Review (per-row caption
 * state) → submit, and assert the engineered end summary with per-row
 * state. A second case returns a per-row failure from that row's
 * unified destination enqueue and asserts it is reported on that row.
 * The enqueue POSTs and every other API call stay inside the
 * intercepted fixture boundary — nothing reaches Facebook.
 *
 * The mobile describe block is the spec 142 gate for this surface:
 * 320 / 390 / 768 CSS px — no horizontal overflow, compact 36px primary
 * targets, stepper + review usable one-handed.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  createFixtureState,
  installApiFixtures,
  type FixtureState,
} from './fixtures/api';
import { FACEBOOK_PAGE, mediaItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const SUB = TENANT.subdomain;
const IMG_1 = '11111111-1111-4111-8111-111111111111';
const IMG_2 = '33333333-3333-4333-8333-333333333333';

interface BulkHarness {
  state: FixtureState;
  bulkRequests: Array<Record<string, unknown>>;
}

async function installBulkFixtures(
  page: Page,
  failure?: { failItemIndex: number; failMessage: string }
): Promise<BulkHarness> {
  const state = createFixtureState({
    media: [
      mediaItemFixture({ id: IMG_1, name: 'bulk-one.png', captionText: 'Bulk caption one' }),
      mediaItemFixture({ id: IMG_2, name: 'bulk-two.png', captionText: null }),
    ],
  });
  await installApiFixtures(page, state);
  const bulkRequests: Array<Record<string, unknown>> = [];
  // Registered after installApiFixtures so it wins over the shared
  // destination-enqueue fixture (Playwright matches in reverse
  // registration order). Since the G4 retarget the bulk flow submits
  // one unified destination enqueue per row — this stub records each
  // request and answers with the contracts enqueue shape (or the
  // configured per-row failure).
  await page.route(`**/api/tenant/${SUB}/publishing/destination-queue`, async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    const itemIndex = bulkRequests.length;
    bulkRequests.push(body);
    if (failure && failure.failItemIndex === itemIndex) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: failure.failMessage }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '77777777-7777-4777-8777-777777777777',
        workspaceId: '99999999-9999-4999-8999-999999999999',
        destinationId: '77777777-7777-4777-8777-777777777777',
        platform: 'facebook',
        kind: body.kind ?? 'image',
        platformFormat: body.platformFormat ?? null,
        status: 'queued',
        scheduledTime: body.scheduledAt ?? '2026-12-01T09:00:00.000Z',
        slotId: null,
        createdAt: '2026-10-20T00:00:00.000Z',
      }),
    });
  });
  return { state, bulkRequests };
}

async function openBulk(page: Page) {
  await page.goto(`/tenant/${SUB}/pages/${FACEBOOK_PAGE.id}`);
  await page.getByTestId('tab-queue-btn').click();
  await page.getByRole('button', { name: 'Bulk add' }).first().click();
  const bulk = page.getByTestId('bulk-add-modal');
  await expect(bulk).toBeVisible();
  return bulk;
}

async function pickTwoAndReview(page: Page) {
  const bulk = page.getByTestId('bulk-add-modal');
  await bulk.getByTestId('bulk-choose-library-btn').click();
  await bulk.getByTestId(`bulk-library-pick-${IMG_1}`).click();
  await bulk.getByTestId(`bulk-library-pick-${IMG_2}`).click();
  await expect(bulk.getByTestId('bulk-selected-counter')).toContainText('2 selected');
  await bulk.getByTestId('bulk-continue-btn').click();
  await expect(bulk.getByTestId('bulk-step-details')).toBeVisible();
  await expect(bulk.getByTestId('bulk-queue-range')).toContainText('2 posts →');
  await bulk.getByTestId('bulk-continue-btn').click();
  await expect(bulk.getByTestId('bulk-step-review')).toBeVisible();
  return bulk;
}

test.describe('bulk creation flow (spec 132 PR-C2)', () => {
  test('choose media → details → review → summary, with per-row caption state', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const { bulkRequests } = await installBulkFixtures(page);
    const bulk = await openBulk(page);

    // Full-page presentation (OD132-1 (a)): a section, not an overlay.
    const tag = await bulk.evaluate((el) => el.tagName);
    expect(tag).toBe('SECTION');
    await expect(bulk.getByTestId('bulk-step-1')).toContainText('1. Choose media');

    await pickTwoAndReview(page);

    // Per-row caption state: row 1 pre-filled from its real library
    // caption; row 2 edited inline before submit.
    await expect(bulk.getByTestId(`bulk-row-caption-${IMG_1}`)).toHaveValue('Bulk caption one');
    await bulk.getByTestId(`bulk-row-caption-${IMG_2}`).fill('Second bulk caption');

    await bulk.getByTestId('bulk-submit-btn').click();
    const summary = bulk.getByTestId('bulk-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('2 added to queue, 0 failed');

    expect(bulkRequests).toHaveLength(2);
    expect(bulkRequests[0]).toMatchObject({
      platform: 'facebook',
      kind: 'image',
      mediaItemIds: [IMG_1],
      caption: 'Bulk caption one',
      intent: 'scheduled',
    });
    expect(bulkRequests[1]).toMatchObject({
      mediaItemIds: [IMG_2],
      caption: 'Second bulk caption',
    });

    // Done completes the flow and the host closes it.
    await bulk.getByTestId('bulk-summary-done-btn').click();
    await expect(bulk).toBeHidden();
  });

  test('a per-row failure is reported on its row in the end summary', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    await installBulkFixtures(page, {
      failItemIndex: 1,
      failMessage: 'That file could not be added.',
    });
    await openBulk(page);
    const bulk = await pickTwoAndReview(page);
    await bulk.getByTestId('bulk-submit-btn').click();
    const summary = bulk.getByTestId('bulk-summary');
    await expect(summary).toContainText('1 added to queue, 1 failed');
    await expect(bulk.getByTestId(`bulk-result-error-${IMG_2}`)).toContainText(
      'That file could not be added.'
    );
  });
});

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
] as const;

test.describe('bulk flow — mobile gate (spec 142)', () => {
  for (const viewport of VIEWPORTS) {
    test(`bulk flow is usable at ${viewport.width}px`, async ({ page, context }) => {
      await context.addCookies([SESSION_COOKIE]);
      await installBulkFixtures(page);
      await page.setViewportSize(viewport);
      const bulk = await openBulk(page);

      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);

      // Stepper + primary actions are compact 36px tall (compact default density — Shahzeb 2026-10-24, spec 129 OD-4 as amended; supersedes the spec 142 F01 44px touch band).
      for (const testId of ['bulk-step-1', 'bulk-continue-btn']) {
        const box = await bulk.getByTestId(testId).boundingBox();
        expect(box, `${testId} has a bounding box`).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(36);
      }

      // The whole flow works one-handed at this width: pick, continue
      // twice, and the review submit is a compact 36px reachable target.
      await pickTwoAndReview(page);
      const submitBox = await bulk.getByTestId('bulk-submit-btn').boundingBox();
      expect(submitBox).not.toBeNull();
      expect(submitBox!.height).toBeGreaterThanOrEqual(36);
      const overflowAtReview = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflowAtReview).toBeLessThanOrEqual(0);
      await bulk.getByTestId('bulk-submit-btn').click();
      await expect(bulk.getByTestId('bulk-summary')).toContainText('2 added to queue, 0 failed');
    });
  }
});
