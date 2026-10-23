/**
 * Batch caption edit flow (spec 133 §8.4, PR-133-3).
 *
 * Fixture-served like the other flows (intercepted API, no production
 * data): two seeded assets are selected, the batch pill states the
 * count, "Set caption" opens the rebuilt Dialog on the form
 * standard, Replace mode applies a caption to both files (the data
 * layer PATCHes each item), the success toast states the count, and
 * both assets show "Caption added" in the grid.
 *
 * The mobile test is this surface's spec 142 gate for the dialogs:
 * at 320 / 390 / 768 CSS px the Set caption and New folder dialogs
 * fit the viewport with no document overflow, their primary actions
 * are at least 44px tall, and the dialog content stays inside the
 * viewport (internal scroll, no clipping).
 */

import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import {
  expectMinTouchHeight,
  expectNoDocumentOverflow,
  expectWithinViewport,
} from './fixtures/mobile';
import { mediaItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const ITEM_A_ID = '55555555-5555-4555-8555-555555555555';
const ITEM_B_ID = '66666666-6666-4666-8666-666666666666';

function seedTwoUncaptionedItems(
  state: ReturnType<typeof createFixtureState>
): void {
  state.media = [
    mediaItemFixture({ captionText: '' }),
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
  await expect(page.getByTestId(`media-card-${ITEM_A_ID}`)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId(`media-card-${ITEM_B_ID}`)).toBeVisible({
    timeout: 30_000,
  });
}

async function maybeScreenshot(page: Page, name: string): Promise<void> {
  const dir = process.env.MEDIA_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test.describe('media batch caption', () => {
  test('select 2 → Set caption → Replace → Apply → both assets captioned', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedTwoUncaptionedItems(state);
    await installApiFixtures(page, state);

    await gotoMedia(page);
    await expect(page.getByTestId(`media-caption-status-${ITEM_A_ID}`)).toHaveText(
      'Missing caption'
    );
    await expect(page.getByTestId(`media-caption-status-${ITEM_B_ID}`)).toHaveText(
      'Missing caption'
    );

    // Select both assets — the batch pill states the count.
    await page.getByTestId(`select-media-${ITEM_A_ID}`).click();
    await page.getByTestId(`select-media-${ITEM_B_ID}`).click();
    await expect(page.getByTestId('batch-selected-count')).toHaveText('2 selected');

    // Open Set caption; empty text gates Apply with the reason present.
    await page.getByTestId('batch-caption-btn').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByText('Applies to 2 files.')).toBeVisible();
    const apply = page.getByTestId('apply-batch-caption');
    await expect(apply).toBeDisabled();
    // The reason renders visibly beside the button (the Button also
    // carries it as an sr-only accessible description).
    await expect(
      page.getByRole('paragraph').filter({ hasText: 'Enter a caption first.' })
    ).toBeVisible();
    await maybeScreenshot(page, 'dialog-batch-caption-empty');

    // Replace mode is the default; type the caption and apply.
    await page.getByTestId('batch-caption-textarea').fill('Harbour at dusk');
    await expect(apply).toBeEnabled();
    await expect(page.getByText('14 / 2,200')).toBeVisible();
    await apply.click();

    // Success is stated with the count, and both assets flip status.
    await expect(page.getByText('Caption updated on 2 files')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(`media-caption-status-${ITEM_A_ID}`)).toHaveText(
      'Caption added'
    );
    await expect(page.getByTestId(`media-caption-status-${ITEM_B_ID}`)).toHaveText(
      'Caption added'
    );
    expect(state.media.every((m) => m.captionText === 'Harbour at dusk')).toBe(
      true
    );
    await maybeScreenshot(page, 'dialog-batch-caption-applied');
  });

  // One test per width (320 / 390 / 768) so each stays well inside
  // the per-test budget while walking all three dialogs.
  for (const width of [320, 390, 768]) {
    test(`dialogs at ${width}px: fit viewport, 44px actions, no overflow`, async ({
      page,
      context,
    }) => {
      await context.addCookies([SESSION_COOKIE]);
      const state = createFixtureState();
      seedTwoUncaptionedItems(state);
      await installApiFixtures(page, state);

      await page.setViewportSize({ width, height: 844 });
      await gotoMedia(page);

      // Batch caption dialog.
      await page.getByTestId(`select-media-${ITEM_A_ID}`).click();
      await page.getByTestId('batch-caption-btn').click();
      const captionDialog = page.getByTestId('batch-set-caption-dialog');
      await expect(captionDialog).toBeVisible();
      await expectWithinViewport(captionDialog, page);
      await expectNoDocumentOverflow(page);
      await expectMinTouchHeight(page.getByTestId('apply-batch-caption'));
      await maybeScreenshot(page, `dialog-batch-caption-${width}`);
      await page.keyboard.press('Escape');
      await expect(captionDialog).toBeHidden();

      // New folder dialog.
      await page.getByTestId('new-folder-link').click();
      const folderDialog = page.getByTestId('new-folder-dialog');
      await expect(folderDialog).toBeVisible();
      await expectWithinViewport(folderDialog, page);
      await expectNoDocumentOverflow(page);
      await expectMinTouchHeight(page.getByTestId('new-folder-name-input'));
      await expectMinTouchHeight(page.getByTestId('submit-create-folder'));
      await maybeScreenshot(page, `dialog-new-folder-${width}`);
      // The "Place inside" Select panel must render above the dialog
      // and stay inside the viewport (portal stacking proof).
      await page.getByTestId('place-inside-select').click();
      const libraryOption = page.getByRole('option', { name: 'Library' });
      await expect(libraryOption).toBeVisible();
      await expectWithinViewport(libraryOption, page);
      await maybeScreenshot(page, `dialog-new-folder-select-${width}`);
      await libraryOption.click();
      await page.keyboard.press('Escape');
      await expect(folderDialog).toBeHidden();

      // Move dialog (batch bar → Move): same Select stacking proof.
      await page.getByTestId('batch-move-btn').click();
      const moveDialog = page.getByTestId('move-target-dialog');
      await expect(moveDialog).toBeVisible();
      await expectWithinViewport(moveDialog, page);
      await expectMinTouchHeight(page.getByTestId('move-destination-select'));
      await page.getByTestId('move-destination-select').click();
      const moveLibraryOption = page.getByRole('option', { name: 'Library' });
      await expect(moveLibraryOption).toBeVisible();
      await expectWithinViewport(moveLibraryOption, page);
      await maybeScreenshot(page, `dialog-move-select-${width}`);
      await moveLibraryOption.click();
      await page.keyboard.press('Escape');
      await expect(moveDialog).toBeHidden();
      await page.getByTestId('batch-clear-btn').click();
    });
  }
});
