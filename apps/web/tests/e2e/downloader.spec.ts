/**
 * Flow — Downloader → Media Library (spec 140 PR-140-4, T23).
 *
 * Paste a link on the Social Downloader, watch the batch complete, see
 * the saved row in Recent Downloads, then follow its "Open in Folder"
 * action into the Media Library at that folder, where the downloaded
 * item renders inside the folder.
 *
 * Hermetic, per the spec 137-A3 pattern: the shared fixture boundary
 * (`installApiFixtures`) serves the library, and the downloader routes
 * registered below — after the shared fixtures, so they take
 * precedence — serve the folder list and the ingest POST from fixture
 * state. The ingest returns a synchronous success body carrying a
 * fixture media item; no live network and no real external URL is
 * ever fetched (the pasted TikTok URL is only a string in the POST
 * body). The downloads also land in the shared fixture state, so the
 * library list that follows serves the same item.
 */

import { test, expect } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { mediaItemFixture, SESSION_COOKIE, TENANT } from './fixtures/tenant';

const DOWNLOADS_FOLDER_ID = '77777777-7777-4777-8777-777777777777';
const DOWNLOADED_ITEM_ID = '88888888-8888-4888-8888-888888888888';
const PASTED_LINK = 'https://www.tiktok.com/@creator/video/1234567890';

const DOWNLOADS_FOLDER = {
  id: DOWNLOADS_FOLDER_ID,
  userId: TENANT.userId,
  parentId: null,
  name: 'Downloads',
  itemCount: 1,
  subfolderCount: 0,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

test.describe('downloader to media library', () => {
  test('a pasted link saves, appears in Recent Downloads, and opens in its library folder', async ({
    page,
    context,
  }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);

    const downloadedItem = mediaItemFixture({
      id: DOWNLOADED_ITEM_ID,
      folderId: DOWNLOADS_FOLDER_ID,
      name: 'e2e-download.mp4',
      mediaType: 'video',
      mimeType: 'video/mp4',
      fileSize: 2048,
      storageKey: 'e2e/e2e-download.mp4',
      url: 'https://storage.e2e.invalid/e2e/e2e-download.mp4',
      durationSeconds: 12,
      aspectRatio: '9:16',
      captionText: 'e2e download caption',
    });

    // Downloader surface fixtures (registered after the shared ones,
    // so they win): the folder list holds the auto-provisioned
    // Downloads folder, the recent-jobs GET starts empty, and the
    // ingest POST answers synchronously with the fixture item, which
    // also joins the shared media state for the library list.
    await page.route(
      `**/api/tenant/${TENANT.subdomain}/media/folders`,
      (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(DOWNLOADS_FOLDER),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            folders: [DOWNLOADS_FOLDER],
            unorganizedCount: 0,
          }),
        });
      }
    );
    await page.route(
      `**/api/tenant/${TENANT.subdomain}/downloader**`,
      (route) => {
        if (route.request().method() === 'POST') {
          const body = (route.request().postDataJSON() ?? {}) as {
            url?: string;
          };
          state.media = [
            downloadedItem,
            ...state.media.filter((m) => m.id !== downloadedItem.id),
          ];
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              sourceUrl:
                typeof body.url === 'string' ? body.url : PASTED_LINK,
              platform: 'tiktok',
              items: [downloadedItem],
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, jobs: [] }),
        });
      }
    );

    await page.goto(`/tenant/${TENANT.subdomain}/downloader`);
    const urlInput = page.getByTestId('downloader-url-input');
    await expect(urlInput).toBeVisible();

    // Paste the link and save it to the Media Library.
    await urlInput.fill(PASTED_LINK);
    await page.getByTestId('downloader-submit-button').click();

    // Progress completes and the saved row lands in Recent Downloads.
    await expect(
      page.getByTestId('downloader-progress-percent')
    ).toHaveText('100%');
    const savedRow = page.getByTestId(
      `downloader-saved-item-${DOWNLOADED_ITEM_ID}`
    );
    await expect(savedRow).toBeVisible();
    await expect(savedRow).toContainText('e2e-download.mp4');

    // Open in Folder navigates into the Media Library at that folder.
    await page
      .getByTestId(`downloader-open-folder-${DOWNLOADED_ITEM_ID}`)
      .click();
    await expect(page).toHaveURL(
      `/tenant/${TENANT.subdomain}/media?folder=${DOWNLOADS_FOLDER_ID}`
    );
    await expect(
      page.getByRole('heading', { name: 'Media Library' })
    ).toBeVisible();

    // The Downloads folder is there; opening it shows the item.
    const folderRow = page.getByTestId(`folder-row-${DOWNLOADS_FOLDER_ID}`);
    await expect(folderRow).toBeVisible();
    await folderRow.click();
    await expect(
      page.getByTestId(`media-card-${DOWNLOADED_ITEM_ID}`)
    ).toBeVisible();
  });
});
