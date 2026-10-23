/**
 * Flow 4 — Media upload (spec 137-A3, T34).
 *
 * A fixture PNG goes through the real import flow: file staging (with the
 * duplicate check), "Start import", the presigned-URL request, the PUT to
 * the signed storage URL (intercepted — no real storage), and the confirm
 * call. The imported item then appears in the library grid.
 */

import { test, expect } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { pngFixtureFile, SESSION_COOKIE, TENANT } from './fixtures/tenant';

test.describe('media upload', () => {
  test('a fixture file imports and appears in the library', async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);

    await page.goto(`/tenant/${TENANT.subdomain}/media`);
    await expect(page.getByRole('button', { name: 'Upload Files' })).toBeVisible();

    // Stage the fixture file through the library's own file input.
    await page.locator('input[type="file"]').first().setInputFiles(pngFixtureFile());

    // Staging: the file is listed and offered for import.
    await expect(page.getByText('e2e-sunset.png').first()).toBeVisible();
    const startImport = page.getByRole('button', { name: 'Start import (1)' });
    await expect(startImport).toBeEnabled();
    await startImport.click();

    // Progress completes; Done closes the import dialog.
    const done = page.getByRole('button', { name: 'Done' });
    await expect(done).toBeVisible({ timeout: 30_000 });
    await done.click();

    // The confirmed item is in the fixture state and rendered in the grid.
    expect(state.media).toHaveLength(1);
    expect(state.media[0]).toMatchObject({ name: 'e2e-sunset.png' });
    await expect(page.getByTestId('media-card-55555555-5555-4555-8555-555555555555')).toBeVisible();
  });
});
