/**
 * Flow — Desktop Clipper gate + forced-desktop workspace shell (spec 148).
 *
 * The gate view renders in a plain browser (no Tauri globals): desktop-only
 * copy, no download URL, no fake button, no horizontal overflow at 320px
 * and 390px. The forced-desktop check injects the Tauri marker so
 * `isDesktopApp()` is true and asserts the workspace shell renders (the
 * bridge itself is unavailable in the browser harness, so the setup form
 * renders with Start disabled — the pipeline itself is covered by the
 * mocked component tests and the real-machine acceptance in the PR).
 *
 * Fixture video (for local probing / no-speech checks, NOT committed):
 *   ffmpeg -y -f lavfi -i testsrc=size=1280x720:rate=30:duration=30 \
 *     -f lavfi -i sine=frequency=440:duration=30 \
 *     -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest clipper-fixture.mp4
 * It has no speech, so it exercises probing and the no-speech path only.
 */
import { test, expect } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';
import { expectNoDocumentOverflow, expectWithinViewport } from './fixtures/mobile';

const CLIPPER_URL = `/tenant/${TENANT.subdomain}/clipper`;

test.describe('Clipper gate (plain browser)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createFixtureState();
    await installApiFixtures(page, state);
    await page.context().addCookies([SESSION_COOKIE]);
  });

  test('renders the desktop-only gate with no URL and no fake button', async ({ page }) => {
    await page.goto(CLIPPER_URL);
    await expect(page.getByTestId('clipper-gate')).toBeVisible();
    await expect(page.getByTestId('clipper-gate-message')).toHaveText('Clipper runs in the FBUploadPro desktop app.');
    await expect(page.getByText('The desktop app is coming soon.')).toBeVisible();
    await expect(page.getByTestId('clipper-gate').getByRole('link')).toHaveCount(0);
    await expect(page.getByTestId('clipper-gate').getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('clipper-workspace')).toHaveCount(0);
  });

  for (const width of [320, 390]) {
    test(`gate has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(CLIPPER_URL);
      await expect(page.getByTestId('clipper-gate')).toBeVisible();
      await expectNoDocumentOverflow(page);
      await expectWithinViewport(page.getByTestId('clipper-gate'), page);
    });
  }
});

test.describe('Clipper workspace shell (forced desktop)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createFixtureState();
    await installApiFixtures(page, state);
    await page.context().addCookies([SESSION_COOKIE]);
    // Tauri marker only: isDesktopApp() is true, but no real invoke exists,
    // so bridge calls fail honestly and the setup renders disabled.
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async () => {
          throw new Error('no shell in browser harness');
        },
      };
    });
  });

  test('renders the workspace setup with Start disabled', async ({ page }) => {
    await page.goto(CLIPPER_URL);
    await expect(page.getByTestId('clipper-workspace')).toBeVisible();
    await expect(page.getByTestId('clipper-job-setup')).toBeVisible();
    await expect(page.getByTestId('clipper-start-btn')).toBeDisabled();
    await expect(page.getByTestId('clipper-pick-source-btn')).toBeVisible();
    await expect(page.getByTestId('clipper-pick-output-btn')).toBeVisible();
  });
});
