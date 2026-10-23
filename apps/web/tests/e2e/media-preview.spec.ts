/**
 * Media preview flow (spec 133 §6.6 / PR-133-5).
 *
 * Fixture-served like the other flows (intercepted API, no production
 * data). Covers the decomposed preview end to end: open from the grid,
 * the media pane rendering real pixels (never the spec-113 black
 * pane), the metadata column, a caption save through the typed
 * client, the video state (poster + scrubber + frame capture), and —
 * for a broken full-size source — the fallback chain landing on the
 * thumbnail in a real browser.
 *
 * The per-width tests are this surface's spec 142 gate for the
 * preview: at 320 / 390 / 768 CSS px the two-column layout collapses
 * to a single column on phones (media above metadata), the dialog
 * fits the viewport with no document overflow, the media is visibly
 * rendered, and the primary actions are at least 44px tall.
 */

import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import {
  expectMinTouchHeight,
  expectNoDocumentOverflow,
  expectWithinViewport,
} from './fixtures/mobile';
import { mediaItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const IMAGE_ID = '55555555-5555-4555-8555-555555555555';
const VIDEO_ID = '77777777-7777-4777-8777-777777777777';
const BROKEN_ID = '88888888-8888-4888-8888-888888888888';

/** A real 1×1 PNG as a data URL — loads without any network, so a
 *  rendered preview proves actual pixels, not a broken-image box. */
const DATA_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** A real 0.4s 64×64 MP4 (1.5 KB, generated with ffmpeg's black
 *  source) — the smallest playable clip for the video-state test. */
const TINY_MP4_BASE64 =
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMsbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAZAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAlZ0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAGQAAAAAAABAAAAAAHObWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAEABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABeW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAATlzdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAK/+EAF2dCwArZBCbARAAAAwAEAAADACg8SJkgAQAFaMuDyyAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAz9AAAAAAAAAAYc3R0cwAAAAAAAAABAAAAAgAACAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAgAAAo8AAAAKAAAAFHN0Y28AAAAAAAAAAQAAA1wAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYyLjEyLjEwMgAAAAhmcmVlAAACoW1kYXQAAAJwBgX//2zcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy56aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MiBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj01IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAF2WIhAQ8mKAALzMnJyddddddddddddeAAAAABkGaOB/hGA==';

function seedItems(state: ReturnType<typeof createFixtureState>): void {
  state.media = [
    mediaItemFixture({ url: DATA_PNG, captionText: 'e2e sunset' }),
    mediaItemFixture({
      id: VIDEO_ID,
      name: 'e2e-clip.mp4',
      storageKey: 'e2e/e2e-clip.mp4',
      url: 'https://storage.e2e.invalid/e2e/e2e-clip.mp4',
      mimeType: 'video/mp4',
      mediaType: 'video',
      thumbnailKey: 'e2e/e2e-clip-thumb.png',
      thumbnailUrl: DATA_PNG,
      durationSeconds: 45,
      aspectRatio: '9:16',
      captionText: '',
      createdAt: '2026-10-21T00:00:00.000Z',
    }),
    mediaItemFixture({
      id: BROKEN_ID,
      name: 'e2e-broken.png',
      storageKey: 'e2e/e2e-broken.png',
      url: 'https://storage.e2e.invalid/e2e-broken.png',
      thumbnailKey: 'e2e/e2e-broken-thumb.png',
      thumbnailUrl: DATA_PNG,
      captionText: '',
      createdAt: '2026-10-22T00:00:00.000Z',
    }),
  ];
}

async function gotoMedia(page: Page): Promise<void> {
  await page.goto(`/tenant/${TENANT.subdomain}/media`);
  await expect(page.getByTestId(`media-card-${IMAGE_ID}`)).toBeVisible({
    timeout: 30_000,
  });
}

async function openPreview(page: Page, id: string): Promise<void> {
  await page.getByTestId(`preview-media-${id}`).click();
  await expect(page.getByTestId('media-preview-modal')).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * The preview <img> has decoded real pixels (not a broken/black box).
 * `decode()` is the proof: it resolves only when the image data
 * actually decoded, and rejects for a broken source. (`naturalWidth`
 * is not used: after an error→src-swap — the fallback path — Chromium
 * keeps reporting 0 for the swapped image even once it has decoded,
 * verified against a control image in the PR-133-5 debug runs.)
 */
async function expectRealPixels(page: Page, testId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.getByTestId(testId).evaluate(async (el) => {
          const img = el as HTMLImageElement;
          if (!img.currentSrc) return false;
          try {
            await img.decode();
            return true;
          } catch {
            return false;
          }
        }),
      { timeout: 15_000 }
    )
    .toBe(true);
}

async function maybeScreenshot(page: Page, name: string): Promise<void> {
  const dir = process.env.MEDIA_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${name}.png` });
}

test.describe('media preview', () => {
  // The shared e2e machine is heavily loaded (a cold production boot
  // alone can take over a minute); give every flow real headroom.
  test.setTimeout(180_000);

  test('image preview: media renders, metadata shows, caption save lands', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedItems(state);
    await installApiFixtures(page, state);

    await gotoMedia(page);
    await openPreview(page, IMAGE_ID);

    // Media pane: the image is rendered (real pixels — spec 113's
    // black pane would be a broken image or the placeholder here).
    const img = page.getByTestId('modal-image-preview');
    await expect(img).toBeVisible();
    await expectRealPixels(page, 'modal-image-preview');
    await expect(page.getByTestId('modal-preview-placeholder')).toHaveCount(0);

    // Metadata column (PB-8): title, rows incl. upload date, editors.
    // (Scoped to the dialog — the grid card shows the same date.)
    const dialog = page.getByTestId('media-preview-modal');
    await expect(dialog.getByText('Asset Details')).toBeVisible();
    await expect(dialog.getByText('Upload date')).toBeVisible();
    await expect(dialog.getByText('Oct 20, 2026')).toBeVisible();
    await expect(page.getByTestId('modal-filename-input')).toHaveValue(
      'e2e-sunset.png'
    );
    await expect(page.getByTestId('modal-caption-input')).toHaveValue('e2e sunset');
    await maybeScreenshot(page, 'preview-image-desktop');

    // Save a new caption through the typed client; the dialog closes
    // with the "Changes saved" toast and the fixture state updated.
    await page.getByTestId('modal-caption-input').fill('Sunset over the harbour');
    await page.getByTestId('modal-save-caption-btn').click();
    await expect(page.getByText('Changes saved').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('media-preview-modal')).toHaveCount(0);
    expect(state.media.find((m) => m.id === IMAGE_ID)?.captionText).toBe(
      'Sunset over the harbour'
    );
  });

  test('video preview: poster + scrubber + frame capture present', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedItems(state);
    await installApiFixtures(page, state);
    // The storage fixture answers an empty 200 for media bytes, which
    // no <video> can play — serve a real (tiny, 0.4s) MP4 for the clip
    // so the player state is exercised for real. Registered after the
    // fixtures, so it wins for this exact URL.
    await page.route('https://storage.e2e.invalid/e2e/e2e-clip.mp4', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: Buffer.from(TINY_MP4_BASE64, 'base64'),
      })
    );

    await gotoMedia(page);
    await openPreview(page, VIDEO_ID);

    const video = page.getByTestId('modal-video-player');
    await expect(video).toBeVisible();
    // Spec 113: the thumbnail is the poster, so the pane is not black
    // before playback.
    await expect(video).toHaveAttribute('poster', DATA_PNG);
    await expect(
      page.getByTestId('media-preview-modal').getByText('0:45')
    ).toBeVisible();
    await expect(
      page.getByTestId('set-video-frame-thumbnail-btn')
    ).toBeVisible();
    await maybeScreenshot(page, 'preview-video-desktop');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('media-preview-modal')).toHaveCount(0);
  });

  test('broken full-size image falls back to the thumbnail (no black pane)', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    seedItems(state);
    await installApiFixtures(page, state);

    await gotoMedia(page);
    await openPreview(page, BROKEN_ID);

    // The full-size source cannot load; the chain must land on the
    // thumbnail (the data-URL still) with real pixels, and never on
    // the placeholder while a loadable source remains.
    await expectRealPixels(page, 'modal-image-preview');
    const src = await page.getByTestId('modal-image-preview').getAttribute('src');
    expect(src).toContain('data:image/png');
    await expect(page.getByTestId('modal-preview-placeholder')).toHaveCount(0);
    await maybeScreenshot(page, 'preview-fallback-desktop');
  });

  // One test per width (320 / 390 / 768) — the spec 142 mobile gate.
  for (const width of [320, 390, 768]) {
    test(`preview at ${width}px: fits viewport, media visible, 44px actions, no overflow`, async ({
      page,
      context,
    }) => {
      await context.addCookies([SESSION_COOKIE]);
      const state = createFixtureState();
      seedItems(state);
      await installApiFixtures(page, state);

      await page.setViewportSize({ width, height: 844 });
      await gotoMedia(page);
      await openPreview(page, IMAGE_ID);

      const dialog = page.getByTestId('media-preview-modal');
      await expectWithinViewport(dialog, page);
      await expectNoDocumentOverflow(page);

      // Media is visibly rendered at this width (real pixels).
      const img = page.getByTestId('modal-image-preview');
      await expect(img).toBeVisible();
      await expectWithinViewport(img, page);
      await expectRealPixels(page, 'modal-image-preview');
      await expect(page.getByTestId('modal-preview-placeholder')).toHaveCount(0);

      // Primary actions meet the 44px touch minimum.
      await expectMinTouchHeight(page.getByTestId('modal-save-caption-btn'));
      await expectMinTouchHeight(page.getByTestId('modal-delete-media-btn'));
      await expectMinTouchHeight(page.getByTestId('modal-filename-input'));

      if (width < 768) {
        // Single column on phones: the media sits above the metadata
        // editors (the two-column layout has collapsed).
        const imgBox = await img.boundingBox();
        const nameBox = await page
          .getByTestId('modal-filename-input')
          .boundingBox();
        if (!imgBox || !nameBox) throw new Error('missing bounding boxes');
        expect(imgBox.y + imgBox.height).toBeLessThanOrEqual(nameBox.y + 1);
      }
      await maybeScreenshot(page, `preview-image-${width}`);

      // Cancel closes and focus returns to the browse view.
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
    });
  }
});
