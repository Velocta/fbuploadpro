/**
 * Destination composers (spec 132 gated sets) — fixture-served e2e +
 * mobile gate evidence (spec 142).
 *
 * The destination detail + posting-slots reads are answered from the
 * fixtures below; the destination enqueue is the shared fixture (it
 * records the created item into state.queue). No production data, no
 * third-party traffic.
 *
 * Instagram (PR-C3): the composer mounts in the 131-4 frame's composer
 * slot, a photo picked from the library pre-fills its real caption and
 * posts now through the unified enqueue; with a covering posting slot
 * the queue intent goes out at the slot. Threads (PR-C4): a text post
 * with a topic tag posts through the same enqueue. The six-viewport
 * loops are the mobile gate: no horizontal overflow, ≥44px primary
 * targets.
 */
import { test, expect, type Page } from '@playwright/test';

import {
  createFixtureState,
  installApiFixtures,
  type FixtureState,
} from './fixtures/api';
import { mediaItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const SUB = TENANT.subdomain;
const DESTINATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEDIA_ID = '55555555-5555-4555-8555-555555555555';

const DESTINATION = {
  id: DESTINATION_ID,
  externalDestinationId: 'ig-1001',
  name: 'My Brand',
  handle: 'mybrand',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  // No persisted account type: this destination stands in for one
  // connected before the type was recorded (unknown — never guessed).
  accountType: null,
  platform: 'instagram',
  account: {
    id: 'acct-1',
    displayName: 'Fixture Creator',
    platform: 'instagram',
    status: 'active',
  },
};

const IMAGE_SLOT = {
  id: '44444444-4444-4444-8444-444444444444',
  destinationId: DESTINATION_ID,
  kind: ['image'],
  timeOfDay: '09:00:00',
  isActive: true,
};

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openDestination(
  page: Page,
  state: FixtureState,
  slots: Array<Record<string, unknown>>,
  destination: Record<string, unknown> = DESTINATION
) {
  await installApiFixtures(page, state);
  await page.route(`**/api/tenant/${SUB}/accounts/social/${DESTINATION_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ destination }),
    })
  );
  await page.route(
    `**/api/tenant/${SUB}/destinations/${DESTINATION_ID}/posting-slots`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ destinationId: DESTINATION_ID, timezone: 'UTC', slots }),
      })
  );
  await page.goto(`/tenant/${SUB}/destinations/${DESTINATION_ID}`);
  await expect(page.getByTestId('destination-name')).toHaveText('My Brand');
}

async function pickPhoto(page: Page) {
  await page.getByTestId('instagram-composer-open-library-btn').click();
  await page.getByTestId(`instagram-composer-library-item-${MEDIA_ID}`).click();
  await expect(page.getByTestId('instagram-composer-selected-media')).toBeVisible();
}

test.describe('destination composer — Instagram (spec 132 PR-C3)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([SESSION_COOKIE]);
  });

  function seededState(): FixtureState {
    return createFixtureState({
      media: [
        mediaItemFixture({
          id: MEDIA_ID,
          name: 'e2e-photo.jpg',
          mimeType: 'image/jpeg',
          mediaType: 'image',
          width: 1080,
          height: 1080,
          captionText: 'e2e sunset',
        }),
      ],
    });
  }

  test('posts a library photo now through the destination enqueue', async ({ page }) => {
    const state = seededState();
    await openDestination(page, state, []);
    await page.setViewportSize({ width: 1024, height: 900 });

    // The composer slot carries the launch state, not the placeholder.
    await expect(page.getByTestId('instagram-composer-launch')).toBeVisible();
    await page.getByTestId('instagram-composer-open-btn').click();
    await expect(page.getByTestId('instagram-composer')).toBeVisible();

    // Stories are not offered: this destination's account type is
    // unknown (never persisted), and the §4.1 gate fails closed.
    await expect(
      page.getByTestId('instagram-composer-format-story')
    ).toHaveCount(0);

    await pickPhoto(page);
    // The item's real library caption pre-fills the caption field.
    await expect(page.getByTestId('instagram-composer-caption-field')).toHaveValue(
      'e2e sunset'
    );
    await expect(page.getByTestId('instagram-composer-limit-note')).toContainText(
      '100 posts'
    );

    await page.getByTestId('instagram-composer-submit-btn').click();
    await expect(page.getByText('Posted to My Brand.')).toBeVisible();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0]).toMatchObject({ caption: 'e2e sunset' });
  });

  test('offers Stories to a known-Business destination', async ({ page }) => {
    const state = seededState();
    await openDestination(page, state, [], {
      ...DESTINATION,
      accountType: 'BUSINESS',
    });
    await page.setViewportSize({ width: 1024, height: 900 });

    await page.getByTestId('instagram-composer-open-btn').click();
    await expect(page.getByTestId('instagram-composer')).toBeVisible();

    // The persisted account type flows frame → slot → composer, and
    // the §4.1 gate opens for Business.
    await expect(
      page.getByTestId('instagram-composer-format-story')
    ).toBeVisible();
  });

  test('queues a photo at the covering posting slot', async ({ page }) => {
    const state = seededState();
    await openDestination(page, state, [IMAGE_SLOT]);
    await page.setViewportSize({ width: 1024, height: 900 });

    await page.getByTestId('instagram-composer-open-btn').click();
    await expect(
      page.getByTestId('instagram-composer-queue-goes-out')
    ).toBeVisible();
    await pickPhoto(page);
    await page.getByTestId('instagram-composer-submit-btn').click();
    await expect(page.getByText(/Added to queue/)).toBeVisible();
    expect(state.queue).toHaveLength(1);
  });

  for (const width of [320, 360, 390, 430, 768, 1024]) {
    test(`composer fits ${width}px with ≥44px primary targets`, async ({ page }) => {
      const state = seededState();
      await openDestination(page, state, []);
      await page.setViewportSize({ width, height: 900 });

      const openBtn = page.getByTestId('instagram-composer-open-btn');
      await expect(openBtn).toBeVisible();
      expect((await openBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await openBtn.click();
      await expect(page.getByTestId('instagram-composer')).toBeVisible();

      for (const testId of [
        'instagram-composer-format-photo',
        'instagram-composer-open-library-btn',
        'instagram-composer-submit-btn',
        'instagram-composer-cancel-btn',
      ]) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expectNoHorizontalOverflow(page);
    });
  }
});

const THREADS_DESTINATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const THREADS_DESTINATION = {
  id: THREADS_DESTINATION_ID,
  externalDestinationId: 'th-1001',
  name: 'My Brand',
  handle: 'mybrand',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  accountType: null,
  platform: 'threads',
  account: {
    id: 'acct-2',
    displayName: 'Fixture Creator',
    platform: 'threads',
    status: 'active',
  },
};

test.describe('destination composer — Threads (spec 132 PR-C4)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([SESSION_COOKIE]);
  });

  async function openThreadsDestination(page: Page, state: FixtureState) {
    await installApiFixtures(page, state);
    await page.route(
      `**/api/tenant/${SUB}/accounts/social/${THREADS_DESTINATION_ID}`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ destination: THREADS_DESTINATION }),
        })
    );
    await page.route(
      `**/api/tenant/${SUB}/destinations/${THREADS_DESTINATION_ID}/posting-slots`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            destinationId: THREADS_DESTINATION_ID,
            timezone: 'UTC',
            slots: [],
          }),
        })
    );
    await page.goto(`/tenant/${SUB}/destinations/${THREADS_DESTINATION_ID}`);
    await expect(page.getByTestId('destination-name')).toHaveText('My Brand');
  }

  test('posts a text post through the destination enqueue', async ({ page }) => {
    const state = createFixtureState();
    await openThreadsDestination(page, state);
    await page.setViewportSize({ width: 1024, height: 900 });

    await expect(page.getByTestId('threads-composer-launch')).toBeVisible();
    await page.getByTestId('threads-composer-open-btn').click();
    await expect(page.getByTestId('threads-composer')).toBeVisible();

    // The long-text attachment field exists (spec 124 verified it live).
    await expect(
      page.getByTestId('threads-composer-text-attachment-field')
    ).toBeVisible();
    await expect(page.getByTestId('threads-composer-limit-note')).toContainText(
      '250 posts'
    );

    await page
      .getByTestId('threads-composer-text-field')
      .fill('Hello from the fixture');
    await page
      .getByTestId('threads-composer-topic-tag-field')
      .fill('Photography');
    await page.getByTestId('threads-composer-submit-btn').click();

    await expect(page.getByText('Posted to My Brand.')).toBeVisible();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0]).toMatchObject({ caption: 'Hello from the fixture' });
  });

  for (const width of [320, 360, 390, 430, 768, 1024]) {
    test(`composer fits ${width}px with ≥44px primary targets`, async ({ page }) => {
      const state = createFixtureState();
      await openThreadsDestination(page, state);
      await page.setViewportSize({ width, height: 900 });

      const openBtn = page.getByTestId('threads-composer-open-btn');
      await expect(openBtn).toBeVisible();
      expect((await openBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await openBtn.click();
      await expect(page.getByTestId('threads-composer')).toBeVisible();

      for (const testId of [
        'threads-composer-open-library-btn',
        'threads-composer-submit-btn',
        'threads-composer-cancel-btn',
      ]) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expectNoHorizontalOverflow(page);
    });
  }
});
