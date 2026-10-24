import { describe, it, expect } from 'vitest';
import type { UnifiedQueueItem } from '@/lib/api/schemas/unified-queue';
import {
  hasRecentDuplicateXText,
  normalizeXTextForDuplicateCheck,
  X_DUPLICATE_RECENT_ITEM_COUNT,
} from './x-duplicate-warning';

const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';

let itemSeq = 0;

function queueItem(overrides: Partial<UnifiedQueueItem> = {}): UnifiedQueueItem {
  itemSeq += 1;
  const stamp = `2026-10-${String(Math.min(itemSeq, 28)).padStart(2, '0')}T09:00:00.000Z`;
  return {
    id: `99999999-9999-4999-8999-${String(itemSeq).padStart(12, '0')}`,
    destinationId: DESTINATION_ID,
    platform: 'x',
    kind: 'text',
    platformFormat: null,
    caption: `post ${itemSeq}`,
    title: null,
    firstComment: null,
    linkUrl: null,
    mediaItemId: null,
    mediaUrl: null,
    media: null,
    platformOptions: {},
    scheduledTime: stamp,
    slotId: null,
    status: 'published',
    retryCount: 0,
    maxRetries: 3,
    errorDetail: null,
    externalPostId: null,
    publishedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

describe('hasRecentDuplicateXText (spec 132 §4.5)', () => {
  it('matches identical text on a recent published item', () => {
    const items = [queueItem({ caption: 'Hello X' })];
    expect(hasRecentDuplicateXText('Hello X', items)).toBe(true);
  });

  it('matches identical text on queued and publishing items', () => {
    expect(
      hasRecentDuplicateXText('Same words', [queueItem({ caption: 'Same words', status: 'queued' })])
    ).toBe(true);
    expect(
      hasRecentDuplicateXText('Same words', [
        queueItem({ caption: 'Same words', status: 'publishing' }),
      ])
    ).toBe(true);
  });

  it('does not match different text', () => {
    const items = [queueItem({ caption: 'Hello X' })];
    expect(hasRecentDuplicateXText('Hello Y', items)).toBe(false);
    expect(hasRecentDuplicateXText('', items)).toBe(false);
    expect(hasRecentDuplicateXText('Hello X', [])).toBe(false);
  });

  it('ignores leading/trailing whitespace on both sides, nothing else', () => {
    const items = [queueItem({ caption: '  Hello X  ' })];
    expect(hasRecentDuplicateXText('Hello X', items)).toBe(true);
    expect(hasRecentDuplicateXText('  Hello X\n', items)).toBe(true);
    // Interior characters and case must match exactly.
    expect(hasRecentDuplicateXText('Hello  X', items)).toBe(false);
    expect(hasRecentDuplicateXText('hello x', items)).toBe(false);
  });

  it('never warns for an empty or whitespace-only current text', () => {
    const items = [queueItem({ caption: '' }), queueItem({ caption: '   ' })];
    expect(hasRecentDuplicateXText('', items)).toBe(false);
    expect(hasRecentDuplicateXText('   ', items)).toBe(false);
  });

  it('ignores cancelled and failed items — they never became posts', () => {
    expect(
      hasRecentDuplicateXText('Same words', [
        queueItem({ caption: 'Same words', status: 'cancelled' }),
      ])
    ).toBe(false);
    expect(
      hasRecentDuplicateXText('Same words', [queueItem({ caption: 'Same words', status: 'failed' })])
    ).toBe(false);
  });

  it('only compares against the most recent N comparable items', () => {
    // The match is older than the recent window: N newer published
    // items push it out, so no warning.
    const older = queueItem({
      caption: 'Ancient post',
      createdAt: '2025-01-01T09:00:00.000Z',
      scheduledTime: '2025-01-01T09:00:00.000Z',
    });
    const newer = Array.from({ length: X_DUPLICATE_RECENT_ITEM_COUNT }, (_, i) =>
      queueItem({
        caption: `fresh ${i}`,
        createdAt: `2026-10-24T${String(i).padStart(2, '0')}:00:00.000Z`,
        scheduledTime: `2026-10-24T${String(i).padStart(2, '0')}:00:00.000Z`,
      })
    );
    expect(hasRecentDuplicateXText('Ancient post', [older, ...newer])).toBe(false);
    // …but it warns when it is inside the window.
    expect(hasRecentDuplicateXText('Ancient post', [older, ...newer.slice(1)])).toBe(true);
  });

  it('recency is by createdAt, not by the endpoint claim order', () => {
    // The endpoint returns claim order (scheduled time first); the
    // most recently CREATED match still counts as recent.
    const match = queueItem({
      caption: 'Latest words',
      createdAt: '2026-10-24T09:00:00.000Z',
      scheduledTime: '2026-10-01T09:00:00.000Z',
    });
    const others = Array.from({ length: X_DUPLICATE_RECENT_ITEM_COUNT - 1 }, (_, i) =>
      queueItem({
        caption: `other ${i}`,
        createdAt: `2026-10-20T${String(i).padStart(2, '0')}:00:00.000Z`,
        scheduledTime: `2026-10-20T${String(i).padStart(2, '0')}:00:00.000Z`,
      })
    );
    expect(hasRecentDuplicateXText('Latest words', [...others, match])).toBe(true);
  });

  it('does not mutate the items array it is given', () => {
    const items = [queueItem({ caption: 'B' }), queueItem({ caption: 'A' })];
    const orderBefore = items.map((item) => item.caption);
    hasRecentDuplicateXText('A', items);
    expect(items.map((item) => item.caption)).toEqual(orderBefore);
  });
});

describe('normalizeXTextForDuplicateCheck', () => {
  it('trims only', () => {
    expect(normalizeXTextForDuplicateCheck('  a  b \n')).toBe('a  b');
    expect(normalizeXTextForDuplicateCheck('Ab C')).toBe('Ab C');
  });
});
