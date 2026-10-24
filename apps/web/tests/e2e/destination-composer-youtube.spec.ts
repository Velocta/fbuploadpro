/**
 * YouTube composer (spec 132 G-YT) — mobile gate evidence (spec 142)
 * + the composer→queue flow on the unified destination enqueue.
 *
 * Fixture-served per A3 discipline: the destination detail read, the
 * posting-slots read, the media list and the destination-queue POST
 * are all answered inside the fixture boundary — the POST is recorded
 * into the fixture queue state, nothing reaches YouTube or Post for
 * Me. The composer's own gates are exercised for real: submit stays
 * disabled until a video, a title, a privacy choice and the explicit
 * made-for-kids choice are all present (G-YT.3).
 */
import { test, expect } from '@playwright/test';

import { createFixtureState, installApiFixtures } from './fixtures/api';
import { mediaItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const SUB = TENANT.subdomain;
// UUID-shaped: the posting-slots response schema validates ids as
// uuids (the detail read's schema takes any string, this satisfies both).
const DESTINATION_ID = '22222222-2222-4222-8222-222222222222';
// The route id follows the frame spec's convention (a short slug).
// A UUID route id renders in the shell breadcrumb as one unbroken
// 270px string whose min-content tips the shell header 1px over at
// 320px on CI Chromium — a pre-existing shell quirk (every real
// destination page carries it; flagged with this set's report), not
// something the composer subtree controls. Payload ids stay UUIDs
// wherever the contracts schemas require them.
const ROUTE_ID = 'dest-yt-1';
const VIDEO_ID = '55555555-5555-4555-8555-555555555555';

const DESTINATION = {
  id: DESTINATION_ID,
  externalDestinationId: 'UC-fixture',
  name: 'Fixture Channel',
  handle: 'fixturechannel',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  platform: 'youtube',
  account: {
    id: 'acct-yt-1',
    displayName: 'Fixture Creator',
    platform: 'youtube',
    status: 'active',
  },
};

const SLOTS = {
  destinationId: DESTINATION_ID,
  timezone: 'UTC',
  slots: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      destinationId: DESTINATION_ID,
      kind: ['video'],
      timeOfDay: '09:00',
      isActive: true,
    },
  ],
};

async function expectNoHorizontalOverflow(
  page: import('@playwright/test').Page,
) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openComposer(
  page: import('@playwright/test').Page,
  width: number,
) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/tenant/${SUB}/destinations/${ROUTE_ID}`);
  const composer = page.getByTestId('youtube-composer');
  // The composer is a dynamically-imported chunk inside the frame —
  // give its first paint more than the default expect timeout.
  await expect(composer).toBeVisible({ timeout: 20_000 });
  return composer;
}

test.describe('youtube composer', () => {
  let state: ReturnType<typeof createFixtureState>;

  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    state = createFixtureState();
    state.media = [
      mediaItemFixture({
        id: VIDEO_ID,
        name: 'fixture-clip.mp4',
        mimeType: 'video/mp4',
        mediaType: 'video',
        captionText: null,
      }),
    ];
    await installApiFixtures(page, state);
    await page.route(
      `**/api/tenant/${SUB}/accounts/social/${ROUTE_ID}`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ destination: DESTINATION }),
        }),
    );
    await page.route(
      `**/api/tenant/${SUB}/destinations/${DESTINATION_ID}/posting-slots`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(SLOTS),
        }),
    );
  });

  for (const width of [320, 390, 768]) {
    test(`renders in the frame's composer slot with no overflow at ${width}px`, async ({
      page,
    }) => {
      const composer = await openComposer(page, width);
      await expect(page.getByTestId('destination-slot-composer')).toBeVisible();
      await expect(
        composer.getByTestId('youtube-composer-title-field'),
      ).toBeVisible();
      await expect(
        composer.getByTestId('youtube-composer-made-for-kids'),
      ).toBeVisible();
      // No thumbnail control and no draft state — the schema carries neither.
      await expect(composer.getByText(/thumbnail/i)).toHaveCount(0);
      await expect(composer.getByText(/draft/i)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('queues a video once every gate is satisfied', async ({ page }) => {
    const composer = await openComposer(page, 390);
    const submit = composer.getByTestId('destination-composer-submit-btn');
    await expect(submit).toBeDisabled();

    await composer.getByTestId('composer-choose-library-btn').click();
    await composer.getByTestId(`composer-library-pick-${VIDEO_ID}`).click();
    await composer
      .getByTestId('youtube-composer-title-field')
      .fill('Fixture launch video');
    // Privacy + made-for-kids still unchosen: the gates hold.
    await expect(submit).toBeDisabled();

    await composer.getByTestId('youtube-composer-privacy-field').click();
    await page.getByRole('option', { name: 'Public' }).click();
    await expect(submit).toBeDisabled();

    await composer.getByTestId('youtube-composer-mfk-no').click();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(
      composer.getByTestId('youtube-composer-success'),
    ).toBeVisible();
    expect(state.queue).toHaveLength(1);
    await expectNoHorizontalOverflow(page);
  });
});
