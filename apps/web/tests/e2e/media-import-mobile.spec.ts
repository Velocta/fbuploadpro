/**
 * Media import flow — mobile gate (spec 133 PR-133-4, spec 142).
 *
 * The rebuilt import dialog (staging → progress → completion summary)
 * is walked at the spec 142 widths 320 / 390 / 768 CSS px against the
 * fixture API: staging rows usable (row + remove target inside the
 * viewport, Start import a compact 36px target), no document-level overflow
 * with the dialog open at any step, and the completion summary
 * reachable. Screenshots are captured only when MEDIA_SCREENSHOT_DIR
 * is set (PR evidence runs); CI runs assertions only.
 */

import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { expectMinTouchHeight, expectWithinViewport } from './fixtures/mobile';
import { pngFixtureFile, SESSION_COOKIE, TENANT } from './fixtures/tenant';

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

async function maybeScreenshot(page: Page, name: string): Promise<void> {
  const dir = process.env.MEDIA_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

test.describe('media import — mobile widths', () => {
  test('staging, progress and summary fit 320/390/768 with compact 36px targets', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/tenant/${TENANT.subdomain}/media`);
      await expect(page.getByRole('button', { name: 'Upload Files' })).toBeVisible({
        timeout: 30_000,
      });

      // Stage the fixture file through the library's own file input.
      await page.locator('input[type="file"]').first().setInputFiles(pngFixtureFile());

      // Staging: dialog, row and primary action all fit the viewport.
      const dialog = page.getByTestId('media-import-modal');
      await expect(dialog).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('e2e-sunset.png').first()).toBeVisible();
      await expectWithinViewport(dialog, page);
      await expectNoOverflowSettled(page);

      const startImport = page.getByRole('button', { name: 'Start import (1)' });
      await expect(startImport).toBeEnabled();
      await expectMinTouchHeight(startImport, 36);
      await expectWithinViewport(startImport, page);

      const removeButtons = page.getByTestId(/^remove-staged-/);
      // Staging-row remove is an icon Button: the compact control height (36px).
      await expectMinTouchHeight(removeButtons.first(), 36);
      await expectWithinViewport(removeButtons.first(), page);
      await maybeScreenshot(page, `import-staging-${width}`);

      // Progress runs to the completion summary inside the dialog.
      await startImport.click();
      const done = page.getByRole('button', { name: 'Done' });
      await expect(done).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Import complete — 1 of 1 uploaded')).toBeVisible();
      await expectMinTouchHeight(done, 36);
      await expectWithinViewport(done, page);
      await expectNoOverflowSettled(page);
      await maybeScreenshot(page, `import-complete-${width}`);

      await done.click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
      expect(state.media).toHaveLength(1);
      state.media = [];
    }
  });
});
