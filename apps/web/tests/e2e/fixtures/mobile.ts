/**
 * Reusable mobile viewport assertions (spec 142, PR-M142-3).
 *
 * The shared contract surface suites use to prove the spec 142 §3 layout
 * rules in a real browser: no document-level horizontal scrolling, key
 * controls geometrically inside the viewport, and primary touch targets
 * meeting their minimum height (the compact control heights since the
 * 2026-10-24 compact-density decision — see expectMinTouchHeight).
 * Assertions use bounding boxes and scroll metrics —
 * never screenshots — so they are stable in CI.
 */

import { expect, type Locator, type Page } from '@playwright/test';

/** Neither <html> nor <body> may scroll horizontally (1px tolerance). */
export async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      docScrollWidth: doc.scrollWidth,
      docClientWidth: doc.clientWidth,
      bodyScrollWidth: body?.scrollWidth ?? 0,
      bodyClientWidth: body?.clientWidth ?? 0,
    };
  });
  expect(
    metrics.docScrollWidth,
    'documentElement must not scroll horizontally'
  ).toBeLessThanOrEqual(metrics.docClientWidth + 1);
  expect(metrics.bodyScrollWidth, 'body must not scroll horizontally').toBeLessThanOrEqual(
    metrics.bodyClientWidth + 1
  );
}

/** The element's bounding box must exist and lie within the viewport's width. */
export async function expectWithinViewport(locator: Locator, page: Page): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('expectWithinViewport: element has no bounding box');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('expectWithinViewport: page has no viewport');
  expect(box.x, 'element left edge must be inside the viewport').toBeGreaterThanOrEqual(-1);
  expect(
    box.x + box.width,
    'element right edge must be inside the viewport'
  ).toBeLessThanOrEqual(viewport.width + 1);
}

/** The element's height must meet the given minimum. Primitive controls
 * use the compact control heights (36px default / 40px lg) since the
 * compact default density decision (Shahzeb, 2026-10-24 — spec 129
 * OD-4 as amended), which superseded the spec 142 44px primary touch
 * minimum; call sites pass the compact size for the control they
 * measure. The default stays 44 for surface elements that keep their
 * own geometry. */
export async function expectMinTouchHeight(locator: Locator, min = 44): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('expectMinTouchHeight: element has no bounding box');
  expect(box.height, `touch target must be at least ${min}px tall`).toBeGreaterThanOrEqual(min);
}
