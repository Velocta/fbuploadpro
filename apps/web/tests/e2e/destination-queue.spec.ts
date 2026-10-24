/**
 * Spec 134 PR-134-3 (§3.4/§3.5): the unified destination queue and
 * posting-times surfaces inside the PR-131-4 destination frame.
 *
 * The frame renders against the fixture backend; the unified queue /
 * slots reads and item actions are stubbed per-spec below (the fixture
 * backend has no destination-queue state). Coverage: unified items
 * render with the platform-named failed reason, Move-down reorder
 * PATCHes both items through the unified item actions and shows the
 * spec-112 success toast, Retry POSTs the unified retry action and the
 * post leaves the failed state, posting times render from the unified
 * slots read, and the spec 142 mobile widths (320/390) show no
 * horizontal overflow with the panels mounted.
 */

import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

const DESTINATION_ID = '33333333-3333-4333-8333-333333333333';
const SLOT_A = '56565656-5656-4565-a656-565656565656';
const SLOT_B = '67676767-6767-4676-a767-676767676767';
const ID_A = '10101010-1010-4101-8101-101010101010';
const ID_B = '20202020-2020-4202-8202-202020202020';
const ID_C = '30303030-3030-4303-8303-303030303030';

const DESTINATION = {
  id: DESTINATION_ID,
  workspaceId: 'e2e-workspace',
  platform: 'instagram',
  externalDestinationId: 'ig-3003',
  name: 'My Brand',
  handle: '@mybrand',
  avatarUrl: null,
  status: 'active',
  connectionStatus: 'connected',
  timezone: 'UTC',
  rateUsagePct: 12,
  nextAllowedPublishAt: null,
  account: {
    id: 'acct-ig',
    platform: 'instagram',
    externalAccountId: 'ig-acct-1',
    displayName: 'Fixture Creator',
    authMode: 'platform',
    status: 'active',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-03T00:00:00.000Z',
};

interface QueueStateItem {
  id: string;
  status: string;
  scheduledTime: string;
  slotId: string | null;
  caption: string | null;
  errorDetail?: string | null;
}

function unifiedItem(item: QueueStateItem) {
  return {
    id: item.id,
    destinationId: DESTINATION_ID,
    platform: 'instagram',
    kind: 'image',
    platformFormat: null,
    caption: item.caption ?? '',
    title: null,
    firstComment: null,
    linkUrl: null,
    mediaItemId: null,
    mediaUrl: null,
    media: null,
    platformOptions: {},
    status: item.status,
    scheduledTime: item.scheduledTime,
    slotId: item.slotId,
    retryCount: 0,
    maxRetries: 3,
    errorDetail: item.errorDetail ?? null,
    externalPostId: null,
    publishedAt: null,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  };
}

function seedItems(): QueueStateItem[] {
  return [
    {
      id: ID_A,
      status: 'queued',
      scheduledTime: '2999-01-01T09:00:00.000Z',
      slotId: SLOT_A,
      caption: 'Destination first post',
    },
    {
      id: ID_B,
      status: 'queued',
      scheduledTime: '2999-01-01T10:00:00.000Z',
      slotId: SLOT_B,
      caption: 'Destination second post',
    },
    {
      id: ID_C,
      status: 'failed',
      scheduledTime: '2999-01-01T08:00:00.000Z',
      slotId: null,
      caption: 'Destination failed post',
      errorDetail: 'permission forbidden: the platform rejected the media',
    },
  ];
}

async function installDestinationQueueFixtures(
  page: Page,
  items: QueueStateItem[],
  calls: string[]
) {
  await page.route(`**/api/tenant/${TENANT.subdomain}/accounts/social/${DESTINATION_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ destination: DESTINATION }),
    })
  );
  await page.route(`**/api/tenant/${TENANT.subdomain}/destinations/${DESTINATION_ID}/queue`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        destinationId: DESTINATION_ID,
        platform: 'instagram',
        timezone: 'UTC',
        destinationStatus: 'active',
        limit: null,
        items: items.map(unifiedItem),
      }),
    });
  });
  await page.route(
    new RegExp(`/destinations/${DESTINATION_ID}/queue/[^/]+$`),
    (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const id = route.request().url().split('/').pop() ?? '';
      const body = route.request().postDataJSON() as { scheduledTime?: string; slotId?: string | null };
      const item = items.find((i) => i.id === id);
      if (item && body.scheduledTime) item.scheduledTime = body.scheduledTime;
      if (item && 'slotId' in body) item.slotId = body.slotId ?? null;
      calls.push(`PATCH ${id}`);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, itemId: id }),
      });
    }
  );
  await page.route(
    new RegExp(`/destinations/${DESTINATION_ID}/queue/[^/]+/retry$`),
    (route) => {
      const id = route.request().url().split('/').slice(-2)[0] ?? '';
      const item = items.find((i) => i.id === id);
      if (item) {
        item.status = 'queued';
        item.scheduledTime = '2999-01-02T09:00:00.000Z';
        item.slotId = SLOT_A;
      }
      calls.push(`RETRY ${id}`);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(unifiedItem(item ?? { id, status: 'queued', scheduledTime: '2999-01-02T09:00:00.000Z', slotId: SLOT_A, caption: null })),
      });
    }
  );
  await page.route(
    `**/api/tenant/${TENANT.subdomain}/destinations/${DESTINATION_ID}/posting-slots`,
    (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          destinationId: DESTINATION_ID,
          timezone: 'UTC',
          slots: [
            { id: SLOT_A, destinationId: DESTINATION_ID, timeOfDay: '09:00:00', kind: ['text', 'image', 'video', 'carousel', 'story'], isActive: true },
            { id: SLOT_B, destinationId: DESTINATION_ID, timeOfDay: '10:00:00', kind: ['text', 'image', 'video', 'carousel', 'story'], isActive: true },
          ],
        }),
      });
    }
  );
}

test.describe('destination queue surfaces (spec 134 PR-134-3)', () => {
  test('renders unified items, the platform-named failed reason, and unified posting times', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    await installApiFixtures(page, createFixtureState());
    await installDestinationQueueFixtures(page, seedItems(), []);

    await page.goto(`/tenant/${TENANT.subdomain}/destinations/${DESTINATION_ID}`);

    const queueSection = page.getByTestId('destination-slot-queue');
    await expect(page.getByTestId(`queue-row-${ID_A}`)).toBeVisible();
    await expect(page.getByTestId(`queue-row-${ID_A}`)).toContainText('Destination first post');
    await expect(page.getByTestId(`queue-row-${ID_C}`)).toContainText(
      "Instagram didn't accept this post."
    );
    await expect(queueSection).toBeVisible();

    const timesSection = page.getByTestId('destination-slot-posting-times');
    await expect(timesSection).toContainText('09:00');
    await expect(timesSection).toContainText('10:00');
  });

  test('move-down reorder PATCHes both items through the unified actions and confirms', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    await installApiFixtures(page, createFixtureState());
    const items = seedItems();
    const calls: string[] = [];
    await installDestinationQueueFixtures(page, items, calls);

    await page.goto(`/tenant/${TENANT.subdomain}/destinations/${DESTINATION_ID}`);
    const rowA = page.getByTestId(`queue-row-${ID_A}`);
    await expect(rowA).toBeVisible();
    await expect(rowA).toContainText('9:00 AM');

    await page.getByRole('button', { name: /Move down post/ }).first().click();

    await expect(page.getByText('Queue reordered — posting times updated.')).toBeVisible();
    expect(calls).toContain(`PATCH ${ID_A}`);
    expect(calls).toContain(`PATCH ${ID_B}`);
    const a = items.find((i) => i.id === ID_A);
    const b = items.find((i) => i.id === ID_B);
    expect(a?.scheduledTime).toBe('2999-01-01T10:00:00.000Z');
    expect(b?.scheduledTime).toBe('2999-01-01T09:00:00.000Z');
  });

  test('retry settles the failed post through the unified retry action', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    await installApiFixtures(page, createFixtureState());
    const items = seedItems();
    const calls: string[] = [];
    await installDestinationQueueFixtures(page, items, calls);

    await page.goto(`/tenant/${TENANT.subdomain}/destinations/${DESTINATION_ID}`);
    const failedRow = page.getByTestId(`queue-row-${ID_C}`);
    await expect(failedRow).toBeVisible();
    await failedRow.getByRole('button', { name: 'Retry' }).click();

    await expect(page.getByText(/Retrying/)).toBeVisible();
    expect(calls).toContain(`RETRY ${ID_C}`);
    // After the refetch the post is queued at the new time, not failed.
    await expect(failedRow).not.toContainText("Instagram didn't accept this post.");
  });

  for (const width of [320, 390]) {
    test(`no horizontal overflow with the destination panels at ${width}px (spec 142 H-134)`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await context.addCookies([SESSION_COOKIE]);
      await installApiFixtures(page, createFixtureState());
      await installDestinationQueueFixtures(page, seedItems(), []);

      await page.goto(`/tenant/${TENANT.subdomain}/destinations/${DESTINATION_ID}`);
      await expect(page.getByTestId(`queue-row-${ID_A}`)).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
