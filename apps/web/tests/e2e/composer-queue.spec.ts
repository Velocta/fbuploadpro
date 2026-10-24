/**
 * Flow 3 — Composer → queue (spec 137-A3, T34).
 *
 * On the seeded Facebook Page's dedicated section: open the composer from
 * the queue view, write a text post, submit it with the default "queue"
 * intent, and assert the post appears in the queue with the correct
 * (queued) state. The queue POST and every publish-side call stay inside
 * the intercepted fixture boundary — nothing reaches Facebook.
 */

import { test, expect } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { FACEBOOK_PAGE, SESSION_COOKIE, TENANT } from './fixtures/tenant';

test.describe('composer to queue', () => {
  test('a created post appears in the queue as queued', async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);

    await page.goto(
      `/tenant/${TENANT.subdomain}/pages/${FACEBOOK_PAGE.id}`
    );
    // The dedicated section shell renders (page header + tab bar) from the
    // fixture page payload.
    await expect(page.getByTestId('tab-queue-btn')).toBeVisible();

    // Queue tab → Create post opens the composer (the empty queue's own
    // call-to-action; the header button carries queue-create-post-btn once
    // the queue has items).
    await page.getByTestId('tab-queue-btn').click();
    await page.getByRole('button', { name: 'Create post' }).first().click();
    const composer = page.getByTestId('post-composer');
    await expect(composer).toBeVisible();

    // A text post: pick the Text format, write the caption, queue it.
    await composer.getByTestId('composer-format-text').click();
    await composer.getByPlaceholder('Write a caption for this post…').fill('E2E queued caption');
    const submit = composer.getByRole('button', { name: 'Add to queue' });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Composer closes; the queue now renders the created post as Queued.
    // (PR-131-3 named update: the locator is scoped to the queue panel —
    // the frame keeps visited tabs mounted per §9.3, so the dashboard's
    // upcoming-queue summary legitimately contains the same caption in a
    // hidden panel; the unscoped .first() matched that copy.)
    await expect(composer).toBeHidden();
    const row = page
      .getByTestId('content-tab')
      .locator('text=E2E queued caption')
      .first();
    await expect(row).toBeVisible();
    await expect(page.getByText('Queued', { exact: true }).first()).toBeVisible();

    // The fixture state recorded exactly one created queue item.
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0]).toMatchObject({ caption: 'E2E queued caption', status: 'queued' });
  });
});
