/**
 * Mobile gate evidence — Facebook composer (spec 132 PR-C1, spec 142).
 *
 * The full-page composer is exercised at the spec's phone/tablet widths
 * (320 / 390 / 768 CSS px): it must render with no horizontal overflow,
 * its primary actions must be at least 44px tall, and the submit action
 * must be reachable without being hidden behind sticky chrome. Uses the
 * same intercepted fixture boundary as `composer-queue.spec.ts` — no
 * real backend, nothing reaches Facebook.
 */

import { test, expect } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { FACEBOOK_PAGE, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
] as const;

test.describe('composer — mobile gate (spec 142)', () => {
  for (const viewport of VIEWPORTS) {
    test(`full-page composer is usable at ${viewport.width}px`, async ({ page, context }) => {
      await context.addCookies([SESSION_COOKIE]);
      const state = createFixtureState();
      await installApiFixtures(page, state);
      await page.setViewportSize(viewport);

      await page.goto(`/tenant/${TENANT.subdomain}/pages/${FACEBOOK_PAGE.id}`);
      await page.getByTestId('tab-queue-btn').click();
      await page.getByRole('button', { name: 'Create post' }).first().click();

      const composer = page.getByTestId('post-composer');
      await expect(composer).toBeVisible();

      // Zero unintended horizontal overflow at this width.
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);

      // Primary actions are ≥44px tall (touch band, spec 142 F01).
      for (const testId of ['submit-post-composer-btn', 'cancel-post-composer-btn']) {
        const box = await composer.getByTestId(testId).boundingBox();
        expect(box, `${testId} has a bounding box`).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      // The format + intent controls are reachable by tap (no hover-only
      // actions): switching to a text post works at this width too.
      await composer.getByTestId('composer-format-text').click();
      await composer
        .getByPlaceholder('Write a caption for this post…')
        .fill('Mobile gate caption');
      await expect(
        composer.getByRole('button', { name: 'Add to queue' })
      ).toBeEnabled();
    });
  }
});
