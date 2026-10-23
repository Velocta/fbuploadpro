/**
 * Spec 134 PR-134-1 (§7.5 / 137 §4.6): queue reorder with
 * time-consequence display.
 *
 * Two queued posts sit on the fixture page's 09:00 and 10:00 slots.
 * Reordering the first post down by keyboard (Space lift, ArrowDown,
 * Space drop — the non-drag twin, UI Rule 21) must visibly reassign the
 * slot times: times stay with positions, posts move through them. The
 * affected rows' displayed times swap, the live region announces the
 * new position and time, and the spec-112 success feedback appears.
 * A second test exercises the panel at the spec 142 mobile widths
 * (320/390/768): no horizontal overflow, rows and reorder controls
 * reachable. All API traffic stays inside the fixture boundary.
 */

import { test, expect } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { FACEBOOK_PAGE, queueItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function seedQueue() {
  return createFixtureState({
    queue: [
      queueItemFixture({
        id: ID_A,
        caption: 'Reorder first post',
        scheduledTime: '2026-12-01T09:00:00.000Z',
      }),
      queueItemFixture({
        id: ID_B,
        caption: 'Reorder second post',
        scheduledTime: '2026-12-01T10:00:00.000Z',
      }),
    ],
  });
}

test.describe('queue reorder (spec 134)', () => {
  test('keyboard reorder reassigns slot times visibly and announces them', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = seedQueue();
    await installApiFixtures(page, state);

    await page.goto(`/tenant/${TENANT.subdomain}/pages/${FACEBOOK_PAGE.id}`);
    await page.getByTestId('tab-queue-btn').click();

    const rowA = page.getByTestId(`queue-row-${ID_A}`);
    const rowB = page.getByTestId(`queue-row-${ID_B}`);
    await expect(rowA).toBeVisible();
    await expect(rowA).toContainText('9:00 AM UTC');
    await expect(rowB).toContainText('10:00 AM UTC');

    // Keyboard reorder: lift the first post, move it down, drop it.
    const handle = page.getByTestId(`queue-drag-handle-${ID_A}`);
    await handle.focus();
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowDown');

    // Time-consequence display: the two posts exchange slot times.
    await expect(rowA).toContainText('10:00 AM UTC');
    await expect(rowB).toContainText('9:00 AM UTC');
    await page.keyboard.press(' ');

    // The live region announced the new position and time, and the
    // spec-112 success feedback appeared (shared Toast system).
    await expect(page.getByTestId('queue-reorder-announcer')).toContainText('position 2 of 2');
    await expect(page.getByText('Queue reordered — posting times updated.')).toBeVisible();

    // The fixture state recorded both items' new times.
    const a = state.queue.find((q) => q.id === ID_A);
    const b = state.queue.find((q) => q.id === ID_B);
    expect(a?.scheduledTime).toBe('2026-12-01T10:00:00.000Z');
    expect(b?.scheduledTime).toBe('2026-12-01T09:00:00.000Z');
  });

  test('panel is usable at mobile widths with no horizontal overflow (spec 142 gate)', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = seedQueue();
    await installApiFixtures(page, state);

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/tenant/${TENANT.subdomain}/pages/${FACEBOOK_PAGE.id}`);
      await page.getByTestId('tab-queue-btn').click();
      const rowA = page.getByTestId(`queue-row-${ID_A}`);
      await expect(rowA).toBeVisible();
      // Zero unintended horizontal overflow at this width.
      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement;
        return el ? el.scrollWidth - el.clientWidth : 0;
      });
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
      // Reorder controls are tap-reachable (not hover-only).
      await expect(page.getByTestId(`queue-drag-handle-${ID_A}`)).toBeVisible();
    }
  });
});
