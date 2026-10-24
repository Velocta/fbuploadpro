/**
 * Video Suite gate (spec 146 §9, §10.7) — Playwright, real browser.
 *
 * - Plain browser: ONLY the placeholder, no workspace controls, NO
 *   download-desktop link of any kind (Q1 unanswered → text-only note).
 * - Desktop UA (FBUploadProDesktop): the full workspace, rights note,
 *   and no page-level horizontal overflow at phone width.
 *
 * The route's server prefetch is fixture-backed like the other tenant
 * specs; no production data, no third-party traffic. Real yt-dlp/ffmpeg
 * execution is NOT proven here — that is the §10 manual shell
 * acceptance, stated as such.
 */
import { test, expect } from '@playwright/test';

import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

const SUB = TENANT.subdomain;
const ROUTE = `/tenant/${SUB}/video-suite`;

test('plain browser shows only the placeholder with a text-only note', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([SESSION_COOKIE]);
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(page.getByTestId('video-suite-gate')).toBeVisible();
  await expect(page.getByTestId('video-suite-gate-note')).toContainText('coming soon');
  // No workspace controls leak into the browser state (scoped to headings
  // and labels, not bare text: the tenant sidebar itself has a
  // "Downloader" link for the separate server downloader route).
  await expect(page.getByLabel('Video link')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Downloader' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Converter' })).toHaveCount(0);
  // …and no link of any kind inside the gate (a dead download link is a spec violation).
  await expect(page.getByTestId('video-suite-gate').locator('a')).toHaveCount(0);
  await context.close();
});

test('desktop UA shows the workspace with the rights note', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) FBUploadProDesktop/1.0',
  });
  await context.addCookies([SESSION_COOKIE]);
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(page.getByTestId('video-suite-workspace')).toBeVisible();
  await expect(page.getByText('Only download videos you have the right to use')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Downloader' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Converter' })).toBeVisible();
  await expect(page.getByTestId('video-suite-gate')).toHaveCount(0);
  await context.close();
});

test('no page-level horizontal overflow at phone width in the desktop state', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) FBUploadProDesktop/1.0',
  });
  await context.addCookies([SESSION_COOKIE]);
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(page.getByTestId('video-suite-workspace')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await context.close();
});
