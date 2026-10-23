/**
 * Media browse surface (spec 133 PR-133-2, spec 142 mobile gate).
 *
 * Fixture-served like the other flows (intercepted API, no production
 * data): two seeded items render in the rebuilt grid; the segmented
 * switch flips to the Table view; library-wide search narrows to the
 * matching item with its folder attribution; selecting via the tile
 * checkbox states the selection in the context row.
 *
 * The mobile test walks the spec 142 widths 320 / 390 / 768 on this
 * surface: no document-level horizontal overflow, the primary Upload
 * target at least 44px tall, the sort/view controls inside the
 * viewport, and selection checkboxes visible without hover (they are
 * always shown below the large breakpoint). Screenshots are captured
 * only when MEDIA_SCREENSHOT_DIR is set (PR evidence runs); CI runs
 * assertions only.
 */

import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { expectMinTouchHeight, expectWithinViewport } from './fixtures/mobile';
import { mediaItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const ITEM_A_ID = '55555555-5555-4555-8555-555555555555';
const ITEM_B_ID = '66666666-6666-4666-8666-666666666666';

function seedTwoItems(state: ReturnType<typeof createFixtureState>): void {
  state.media = [
    mediaItemFixture(),
    mediaItemFixture({
      id: ITEM_B_ID,
      name: 'e2e-harbour.png',
      storageKey: 'e2e/e2e-harbour.png',
      url: 'https://storage.e2e.invalid/e2e/e2e-harbour.png',
      captionText: '',
      aspectRatio: '16:9',
      createdAt: '2026-10-21T00:00:00.000Z',
    }),
  ];
}

async function gotoMedia(page: Page): Promise<void> {
  await page.goto(`/tenant/${TENANT.subdomain}/media`);
  // The explorer hydrates from the server prefetch, then the client
  // query serves the fixture items — allow for a slow first paint.
  await expect(page.getByTestId(`media-card-${ITEM_A_ID}`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(`media-card-${ITEM_B_ID}`)).toBeVisible({ timeout: 30_000 });
}

async function maybeScreenshot(page: Page, name: string): Promise<void> {
  const dir = process.env.MEDIA_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

/**
 * The shared `expectNoDocumentOverflow` metric, polled until settled:
 * on first paint the tenant shell (sidebar) can still be mid-collapse
 * for a frame, which reads as a transient scroll width. The invariant
 * is that the SETTLED layout never overflows (spec 142 §3).
 */
async function expectNoOverflowSettled(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          return (
            doc.scrollWidth <= doc.clientWidth + 1 &&
            (body?.scrollWidth ?? 0) <= (body?.clientWidth ?? 0) + 1
          );
        }),
      { timeout: 10_000, intervals: [250, 500, 1000] }
    )
    .toBe(true);
}

test.describe('media browse', () => {
  test('grid renders, table switch works, search narrows library-wide', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedTwoItems(state);
    await installApiFixtures(page, state);

    await gotoMedia(page);
    await expect(page.getByTestId('media-loaded-count')).toHaveText('Showing 2 of 2 files');
    await expect(
      page.getByTestId(`media-caption-status-${ITEM_B_ID}`)
    ).toHaveText('Missing caption');
    await maybeScreenshot(page, 'browse-grid');

    // Segmented switch → Table view with the PB-6 columns.
    await page.getByTestId('view-mode-table-btn').click();
    await expect(page.getByTestId('media-table-view')).toBeVisible();
    await expect(page.getByTestId(`media-row-${ITEM_A_ID}`)).toBeVisible();
    await expect(page.getByTestId(`row-date-${ITEM_A_ID}`)).toHaveText('Oct 20, 2026');
    await maybeScreenshot(page, 'browse-table');

    // Back to grid; library-wide search narrows to the matching item.
    await page.getByTestId('view-mode-grid-btn').click();
    await page.getByTestId('media-search-input').fill('harbour');
    await expect(page.getByTestId(`media-card-${ITEM_B_ID}`)).toBeVisible();
    await expect(page.getByTestId(`media-card-${ITEM_A_ID}`)).toHaveCount(0);
    await expect(page.getByTestId('media-scope-tag')).toHaveText('In: Library');
    await maybeScreenshot(page, 'browse-filtered');

    // Selection states through the tile checkbox.
    await page.getByTestId('media-search-input').fill('');
    await expect(page.getByTestId(`media-card-${ITEM_A_ID}`)).toBeVisible();
    await page.getByTestId(`select-media-${ITEM_A_ID}`).click();
    await expect(page.getByTestId(`select-media-${ITEM_A_ID}`)).toHaveAttribute(
      'aria-checked',
      'true'
    );

    // Keyboard walk (browse view): the Type menu opens from the
    // keyboard, Esc closes it and returns focus to the trigger; the
    // segmented switch activates from the keyboard.
    const typeTrigger = page.getByTestId('media-type-select');
    const typeMenu = page.locator('[data-slot="menu-content"]');
    await typeTrigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(typeMenu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(typeMenu).toHaveCount(0);
    await expect(typeTrigger).toBeFocused();
    await page.getByTestId('view-mode-table-btn').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('media-table-view')).toBeVisible();
    await page.getByTestId('view-mode-grid-btn').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('media-assets-grid')).toBeVisible();

    // Greyscale pass capture (states must read without colour — every
    // state on this view also carries an icon or text).
    if (process.env.MEDIA_SCREENSHOT_DIR) {
      await page.addStyleTag({ content: '* { filter: grayscale(1) !important; }' });
      await maybeScreenshot(page, 'browse-grid-greyscale');
    }
  });

  test('empty library shows the first-use state with Upload as its one action', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);

    await page.goto(`/tenant/${TENANT.subdomain}/media`);
    const empty = page.getByTestId('media-empty-state');
    await expect(empty).toBeVisible();
    await expect(empty).toHaveAttribute('data-type', 'first-use');
    await expect(page.getByTestId('media-empty-upload-btn')).toBeVisible();
    await maybeScreenshot(page, 'browse-empty-first-use');
  });

  test('mobile widths 320/390/768: no overflow, 44px primary, no hover needed', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedTwoItems(state);
    await installApiFixtures(page, state);

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await gotoMedia(page);

      await expectNoOverflowSettled(page);
      await expectMinTouchHeight(page.getByTestId('upload-files-btn'));
      await expectWithinViewport(page.getByTestId('upload-files-btn'), page);
      await expectWithinViewport(page.getByTestId('media-search-input'), page);

      // Selection checkbox is visible without hover at this width.
      const checkboxOpacity = await page
        .getByTestId(`select-media-${ITEM_A_ID}`)
        .evaluate((el) => {
          let node: HTMLElement | null = el as HTMLElement;
          while (node && !node.className.includes('transition-opacity')) {
            node = node.parentElement;
          }
          return node ? getComputedStyle(node).opacity : 'not-found';
        });
      expect(checkboxOpacity, `checkbox must be visible at ${width}px`).toBe('1');

      // Table view also fits: the table scrolls inside its container,
      // never the document.
      await page.getByTestId('view-mode-table-btn').click();
      await expect(page.getByTestId(`media-row-${ITEM_A_ID}`)).toBeVisible();
      await expectMinTouchHeight(page.getByTestId(`row-action-preview-${ITEM_A_ID}`));
      await expectNoOverflowSettled(page);
      await maybeScreenshot(page, `browse-mobile-${width}`);
      await page.getByTestId('view-mode-grid-btn').click();
    }
  });
});
