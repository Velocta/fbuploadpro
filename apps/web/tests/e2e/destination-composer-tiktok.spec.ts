/**
 * TikTok composer (spec 132 G-TT) — mobile gate evidence (spec 142)
 * + the composer→queue flow on the unified destination enqueue.
 *
 * Fixture-served per A3 discipline: the destination detail read, the
 * posting-slots read, the media list and the destination-queue POST
 * are all answered inside the fixture boundary — the POST is recorded
 * into the fixture queue state, nothing reaches TikTok or Post for
 * Me. The composer's own gates are exercised for real: submit stays
 * disabled until one video is attached, and the wire options hold
 * only what the user picked (Default toggles stay omitted, and there
 * is no draft state anywhere — spec 126).
 */
import { test, expect } from '@playwright/test';

import { createFixtureState, installApiFixtures } from './fixtures/api';
import { mediaItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const SUB = TENANT.subdomain;
// UUID-shaped: the posting-slots response schema validates ids as
// uuids (the detail read's schema takes any string, this satisfies both).
const DESTINATION_ID = '22222222-2222-4222-8222-222222222222';
const VIDEO_ID = '55555555-5555-4555-8555-555555555555';

const DESTINATION = {
  id: DESTINATION_ID,
  externalDestinationId: 'tt-fixture',
  name: 'Fixture TikTok',
  handle: 'fixturetiktok',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  accountType: null,
  platform: 'tiktok',
  account: {
    id: 'acct-tt-1',
    displayName: 'Fixture Creator',
    platform: 'tiktok',
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
      kind: ['video', 'image'],
      timeOfDay: '09:00',
      isActive: true,
    },
  ],
};

async function expectNoHorizontalOverflow(
  page: import('@playwright/test').Page,
) {
  const report = await page.evaluate(() => {
    const el = document.scrollingElement;
    const overflow = el ? el.scrollWidth - el.clientWidth : 0;
    if (overflow <= 0) return { overflow, offenders: [] as string[] };
    // Failure diagnostics: which elements cross the right edge, so a
    // 1px overflow names its culprit instead of guessing.
    const vw = document.documentElement.clientWidth;
    const offenders: string[] = [];
    document.querySelectorAll('*').forEach((node) => {
      const r = node.getBoundingClientRect();
      if (r.right > vw + 0.5 && r.width > 0) {
        offenders.push(
          `${node.tagName}[${node.getAttribute('data-testid') ?? ''}] ` +
            `${(node.getAttribute('class') ?? '').slice(0, 60)} ` +
            `right=${Math.round(r.right * 10) / 10} text=${(node.textContent ?? '').slice(0, 30)}`,
        );
      }
    });
    return { overflow, offenders: offenders.slice(0, 8) };
  });
  expect(report.overflow, JSON.stringify(report.offenders)).toBeLessThanOrEqual(0);
}

async function openComposer(
  page: import('@playwright/test').Page,
  width: number,
) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/tenant/${SUB}/destinations/${DESTINATION_ID}`);
  const composer = page.getByTestId('tiktok-composer');
  // The composer is a dynamically-imported chunk inside the frame —
  // give its first paint more than the default expect timeout.
  await expect(composer).toBeVisible({ timeout: 20_000 });
  return composer;
}

test.describe('tiktok composer', () => {
  let state: ReturnType<typeof createFixtureState>;

  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    state = createFixtureState();
    state.media = [
      mediaItemFixture({
        id: VIDEO_ID,
        name: 'fixture-dance.mp4',
        mimeType: 'video/mp4',
        mediaType: 'video',
        captionText: null,
      }),
    ];
    await installApiFixtures(page, state);
    await page.route(
      `**/api/tenant/${SUB}/accounts/social/${DESTINATION_ID}`,
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
      await expect(composer.getByTestId('tiktok-composer-kind')).toBeVisible();
      await expect(
        composer.getByTestId('tiktok-composer-privacy-field'),
      ).toBeVisible();
      // Auto-music is photo-only, and there is no draft state — the
      // schema carries neither for a video post.
      await expect(
        composer.getByTestId('tiktok-composer-auto-music'),
      ).toHaveCount(0);
      await expect(composer.getByText(/draft/i)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('queues a video once the media gate is satisfied', async ({ page }) => {
    const composer = await openComposer(page, 390);
    const submit = composer.getByTestId('destination-composer-submit-btn');
    await expect(submit).toBeDisabled();

    await composer.getByTestId('composer-choose-library-btn').click();
    await composer.getByTestId(`composer-library-pick-${VIDEO_ID}`).click();
    await composer
      .getByTestId('tiktok-composer-caption-field')
      .fill('Fixture dance break');
    // One toggle picked (Duets off); the rest stay Default/omitted.
    await composer.getByTestId('tiktok-composer-allow-duet-off').click();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(
      composer.getByTestId('tiktok-composer-success'),
    ).toBeVisible();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0]?.caption).toBe('Fixture dance break');
    await expectNoHorizontalOverflow(page);
  });
});
