/**
 * The X composer's identical-text warning (spec 132 §4.5; tasks.md
 * G-X.3 remainder, built once PR-134-3's destination queue read landed
 * in PR 762).
 *
 * The rule, verbatim intent: where the user queues text identical to a
 * recent post for X, the composer shows a VISIBLE warning — duplicate
 * posts are real rejections on X — and NEVER alters the copy. The
 * warning is advisory only: it never blocks submit and never feeds the
 * form's validation state.
 *
 * Data source (OD132-3(a) — existing data only, nothing invented):
 * `GET …/destinations/[destinationId]/queue`, the unified queue read.
 * That endpoint returns EVERY unified item for the destination,
 * unbounded, in claim order (scheduled time, then creation), each item
 * carrying `caption` (where the composer's text lands at enqueue),
 * `status` and `createdAt`. "Recent" is therefore defined over the
 * returned set, relative to the account's own activity rather than the
 * wall clock: the {@link X_DUPLICATE_RECENT_ITEM_COUNT} most recent
 * comparable items by `createdAt`.
 *
 * Comparable statuses are `queued`, `publishing` and `published` —
 * posts that exist on X or are on their way there. `cancelled` items
 * will never publish and `failed` items never became posts, so neither
 * can make X reject the new text as a duplicate.
 *
 * Normalisation is TRIM ONLY: leading/trailing whitespace is ignored,
 * interior characters and case must match exactly — the same exact-text
 * comparison whose failure X reports as a duplicate. An empty or
 * whitespace-only current text never warns.
 */
import type { UnifiedQueueItem } from '@/lib/api/schemas/unified-queue';

/** The plain-language warning line the composer renders verbatim. */
export const X_DUPLICATE_TEXT_WARNING =
  'This text matches a recent post for this account — X may reject it as a duplicate.';

/** How many of the destination's most recent posts the warning compares against. */
export const X_DUPLICATE_RECENT_ITEM_COUNT = 10;

const COMPARABLE_STATUSES: ReadonlySet<UnifiedQueueItem['status']> = new Set([
  'queued',
  'publishing',
  'published',
]);

/** Trim-only normalisation for the duplicate comparison (see header). */
export function normalizeXTextForDuplicateCheck(text: string): string {
  return text.trim();
}

/**
 * True when `currentText` exactly matches (after trim) the caption of
 * one of the destination's most recent comparable queue items.
 */
export function hasRecentDuplicateXText(
  currentText: string,
  items: readonly UnifiedQueueItem[]
): boolean {
  const target = normalizeXTextForDuplicateCheck(currentText);
  if (target === '') return false;
  return items
    .filter((item) => COMPARABLE_STATUSES.has(item.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, X_DUPLICATE_RECENT_ITEM_COUNT)
    .some((item) => normalizeXTextForDuplicateCheck(item.caption) === target);
}
