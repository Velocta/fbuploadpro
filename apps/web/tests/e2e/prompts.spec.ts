/**
 * Prompt Library surface (spec 144).
 *
 * Fixture-served (intercepted API, no production data): curated + personal
 * prompts render; search, source tabs, and the category filter narrow the
 * list; Copy writes the exact body to the clipboard; the create flow
 * persists into the fixture state and appears under My prompts; the
 * delete flow removes a personal prompt after confirmation.
 *
 * Mobile widths 320 / 390 assert the spec 142 settled-layout invariant
 * (no document overflow) with the primary controls inside the viewport.
 * NOTE: no hard 44px touch-target assertion — the 2026-10-24 compact
 * decision superseded that mobile-gate line; controls must be reachable
 * and tappable instead.
 */

import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { expectNoDocumentOverflow, expectWithinViewport } from './fixtures/mobile';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

const PERSONAL_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-000000000001';

function seedPersonal(state: ReturnType<typeof createFixtureState>): void {
  state.prompts = [
    {
      id: PERSONAL_ID,
      userId: TENANT.userId,
      title: 'E2E private prompt',
      body: 'E2E private body about [topic].',
      category: 'engagement',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
    },
  ];
}

async function gotoPrompts(page: Page): Promise<void> {
  await page.goto(`/tenant/${TENANT.subdomain}/prompts`);
  // The client query serves the fixture prompts — wait for a fixture card.
  await expect(page.getByTestId('prompt-card-hooks-01')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(`prompt-card-${PERSONAL_ID}`)).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('prompt library', () => {
  test('browse, search, tabs, and category filter narrow the list', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedPersonal(state);
    await installApiFixtures(page, state);
    await gotoPrompts(page);

    // All three fixture prompts render.
    await expect(page.getByTestId('prompt-card-captions-01')).toBeVisible();

    // Search narrows on title.
    await page.getByTestId('prompt-search').fill('caption');
    await expect(page.getByTestId('prompt-card-captions-01')).toBeVisible();
    await expect(page.getByTestId('prompt-card-hooks-01')).toHaveCount(0);
    await expect(page.getByTestId(`prompt-card-${PERSONAL_ID}`)).toHaveCount(0);

    // Clear search; source tab partitions curated vs personal.
    await page.getByTestId('prompt-search').fill('');
    await expect(page.getByTestId('prompt-card-hooks-01')).toBeVisible();
    await page.getByRole('tab', { name: 'My prompts' }).click();
    await expect(page.getByTestId(`prompt-card-${PERSONAL_ID}`)).toBeVisible();
    await expect(page.getByTestId('prompt-card-hooks-01')).toHaveCount(0);
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page.getByTestId('prompt-card-hooks-01')).toBeVisible();

    // Category filter narrows to the chosen category.
    await page.getByTestId('prompt-category-filter').click();
    await page.getByRole('option', { name: 'Captions' }).click();
    await expect(page.getByTestId('prompt-card-captions-01')).toBeVisible();
    await expect(page.getByTestId('prompt-card-hooks-01')).toHaveCount(0);
    await expect(page.getByTestId(`prompt-card-${PERSONAL_ID}`)).toHaveCount(0);
  });

  test('copy writes the exact prompt body to the clipboard', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedPersonal(state);
    await installApiFixtures(page, state);
    await gotoPrompts(page);

    await page.getByTestId('prompt-copy-hooks-01').click();
    await expect(page.getByTestId('prompt-copy-hooks-01')).toHaveText('Copied');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('Write a hook about [topic].');
  });

  test('create flow persists and appears under My prompts', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedPersonal(state);
    await installApiFixtures(page, state);
    await gotoPrompts(page);

    await page.getByTestId('prompt-new-button').click();
    await expect(page.getByTestId('prompt-form-dialog')).toBeVisible();
    await page.getByTestId('prompt-form-title').fill('E2E created prompt');
    await page.getByTestId('prompt-form-body').fill('E2E created body.');
    await page.getByTestId('prompt-form-submit').click();
    await expect(page.getByTestId('prompt-form-dialog')).toHaveCount(0);

    // The created prompt joins the fixture state and renders.
    await page.getByRole('tab', { name: 'My prompts' }).click();
    await expect(page.getByText('E2E created prompt')).toBeVisible();
  });

  test('delete flow removes a personal prompt after confirmation', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedPersonal(state);
    await installApiFixtures(page, state);
    await gotoPrompts(page);

    await page.getByTestId(`prompt-delete-${PERSONAL_ID}`).click();
    await expect(page.getByTestId('prompt-delete-confirm')).toBeVisible();
    await page.getByTestId('prompt-delete-confirm-button').click();
    await expect(page.getByTestId(`prompt-card-${PERSONAL_ID}`)).toHaveCount(0);
    // Curated prompts are untouched by the delete.
    await expect(page.getByTestId('prompt-card-hooks-01')).toBeVisible();
  });

  for (const width of [320, 390]) {
    test(`mobile ${width}px: no overflow, primary controls in viewport`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await context.addCookies([SESSION_COOKIE]);
      const state = createFixtureState();
      seedPersonal(state);
      await installApiFixtures(page, state);
      await gotoPrompts(page);

      await expectNoDocumentOverflow(page);
      await expectWithinViewport(page.getByTestId('prompt-search'), page);
      await expectWithinViewport(page.getByTestId('prompt-new-button'), page);
      await expectWithinViewport(page.getByTestId('prompt-copy-hooks-01'), page);
    });
  }
});
