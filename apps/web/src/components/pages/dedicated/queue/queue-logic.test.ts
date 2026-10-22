import { describe, it, expect } from 'vitest';
import type { PageSlotSummary } from '../tab-dashboard';
import type { DedicatedQueueItem, QueueFilter } from './queue-types';
import {
  resolveFormat,
  formatPlural,
  formatQueueRowTime,
  describeSlotCoverage,
  matchSlotForTime,
  isSlotBased,
  filterItems,
  countByFilter,
  planReorder,
  findCollision,
  canSwapTimes,
  getFailedReason,
  computeRetryTime,
} from './queue-logic';

const TZ = 'UTC';

function makeSlot(overrides: Partial<PageSlotSummary> = {}): PageSlotSummary {
  return {
    id: 'slot-1',
    slotTime: '09:00',
    timezone: TZ,
    isActive: true,
    allowedFormats: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<DedicatedQueueItem> = {}): DedicatedQueueItem {
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    scheduledTime: '2026-10-20T09:00:00.000Z',
    status: 'queued',
    createdAt: '2026-10-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveFormat', () => {
  it('prefers the stored post format', () => {
    expect(resolveFormat(makeItem({ postFormat: 'reel' }))).toBe('reel');
  });

  it('derives video/image from media when no format is stored', () => {
    expect(
      resolveFormat(makeItem({ media: { name: 'a', mediaType: 'video', url: 'u' } }))
    ).toBe('video');
    expect(
      resolveFormat(makeItem({ media: { name: 'a', mediaType: 'image', url: 'u' } }))
    ).toBe('image');
  });

  it('falls back to text when there is no media', () => {
    expect(resolveFormat(makeItem({ media: null }))).toBe('text');
  });
});

describe('formatPlural / describeSlotCoverage', () => {
  it('pluralizes format labels', () => {
    expect(formatPlural('image')).toBe('Photos');
    expect(formatPlural('reel')).toBe('Reels');
    expect(formatPlural('story')).toBe('Stories');
  });

  it('describes slot coverage', () => {
    expect(describeSlotCoverage(makeSlot({ allowedFormats: null }))).toBe('all formats');
    expect(describeSlotCoverage(makeSlot({ allowedFormats: [] }))).toBe('all formats');
    expect(describeSlotCoverage(makeSlot({ allowedFormats: ['image'] }))).toBe('Photos');
    expect(
      describeSlotCoverage(makeSlot({ allowedFormats: ['image', 'reel'] }))
    ).toBe('Photos, Reels');
  });
});

describe('matchSlotForTime', () => {
  it('matches an active slot by wall-clock time of day', () => {
    const slots = [makeSlot({ id: 'morning', slotTime: '09:00' })];
    expect(matchSlotForTime('2026-10-20T09:00:00.000Z', slots, TZ)?.id).toBe('morning');
  });

  it('returns null for a custom time', () => {
    const slots = [makeSlot({ slotTime: '09:00' })];
    expect(matchSlotForTime('2026-10-20T14:37:00.000Z', slots, TZ)).toBeNull();
  });

  it('ignores inactive slots', () => {
    const slots = [makeSlot({ slotTime: '09:00', isActive: false })];
    expect(matchSlotForTime('2026-10-20T09:00:00.000Z', slots, TZ)).toBeNull();
  });

  it('returns null on invalid input', () => {
    expect(matchSlotForTime('not-a-date', [makeSlot()], TZ)).toBeNull();
  });
});

describe('filterItems / countByFilter', () => {
  const slots = [makeSlot({ slotTime: '09:00' })];
  const items: DedicatedQueueItem[] = [
    makeItem({ id: 'q1', scheduledTime: '2026-10-20T09:00:00.000Z', status: 'queued' }),
    makeItem({ id: 's1', scheduledTime: '2026-10-20T14:30:00.000Z', status: 'queued' }),
    makeItem({ id: 'p1', status: 'published' }),
    makeItem({ id: 'f1', status: 'failed' }),
    makeItem({ id: 'c1', status: 'cancelled' }),
  ];

  it('splits slot-based queued from custom scheduled', () => {
    expect(filterItems(items, 'queued', slots, TZ, true).map((i) => i.id)).toEqual(['q1']);
    expect(filterItems(items, 'scheduled', slots, TZ, true).map((i) => i.id)).toEqual(['s1']);
    expect(filterItems(items, 'published', slots, TZ, true).map((i) => i.id)).toEqual(['p1']);
    expect(filterItems(items, 'failed', slots, TZ, true).map((i) => i.id)).toEqual(['f1']);
    expect(filterItems(items, 'all', slots, TZ, true)).toHaveLength(5);
  });

  it('counts every filter', () => {
    expect(countByFilter(items, slots, TZ, true)).toEqual({
      all: 5,
      queued: 1,
      scheduled: 1,
      published: 1,
      failed: 1,
    });
  });

  it('treats every pending post as queued while slots are still loading', () => {
    expect(
      filterItems(items, 'queued', slots, TZ, false).map((i) => i.id).sort()
    ).toEqual(['q1', 's1']);
    expect(filterItems(items, 'scheduled', slots, TZ, false)).toHaveLength(0);
    expect(countByFilter(items, slots, TZ, false)).toEqual({
      all: 5,
      queued: 2,
      scheduled: 0,
      published: 1,
      failed: 1,
    });
  });

  it('isSlotBased is false for non-pending statuses', () => {
    expect(isSlotBased(makeItem({ status: 'failed' }), slots, TZ)).toBe(false);
  });
});

describe('planReorder', () => {
  const openSlots = [
    makeSlot({ id: 'morning', slotTime: '09:00', allowedFormats: null }),
    makeSlot({ id: 'evening', slotTime: '18:00', allowedFormats: null }),
  ];
  const restrictedSlots = [
    makeSlot({ id: 'morning', slotTime: '09:00', allowedFormats: null }),
    makeSlot({ id: 'evening', slotTime: '18:00', allowedFormats: ['image'] }),
  ];
  const ordered: DedicatedQueueItem[] = [
    makeItem({ id: 'a', postFormat: 'image', scheduledTime: '2026-10-20T09:00:00.000Z' }),
    makeItem({ id: 'b', postFormat: 'image', scheduledTime: '2026-10-20T18:00:00.000Z' }),
    makeItem({ id: 'c', postFormat: 'reel', scheduledTime: '2026-10-21T09:00:00.000Z' }),
  ];

  it('reassigns times to positions when the move is compatible', () => {
    const result = planReorder({
      ordered,
      fromIndex: 0,
      toIndex: 2,
      slots: openSlots,
      timeZone: TZ,
    });
    expect('blocked' in result).toBe(false);
    if ('assignments' in result) {
      // Times stay with positions; content moves: b takes 09:00, c takes 18:00, a takes next 09:00
      expect(result.assignments).toEqual([
        { id: 'b', scheduledTime: '2026-10-20T09:00:00.000Z' },
        { id: 'c', scheduledTime: '2026-10-20T18:00:00.000Z' },
        { id: 'a', scheduledTime: '2026-10-21T09:00:00.000Z' },
      ]);
    }
  });

  it('blocks a move onto a position whose slot excludes the format', () => {
    // Move the reel (index 2) onto the 18:00 Photos-only position (index 1)
    const result = planReorder({
      ordered,
      fromIndex: 2,
      toIndex: 1,
      slots: restrictedSlots,
      timeZone: TZ,
    });
    expect('blocked' in result).toBe(true);
    if ('blocked' in result) {
      expect(result.blocked).toContain('This posting time is for Photos');
      expect(result.blocked).toContain('this is a reel');
    }
  });

  it('allows moves onto positions with no governing slot', () => {
    const noSlots: PageSlotSummary[] = [];
    const result = planReorder({ ordered, fromIndex: 2, toIndex: 0, slots: noSlots, timeZone: TZ });
    expect('blocked' in result).toBe(false);
  });

  it('is a no-op for a same-position move', () => {
    const result = planReorder({
      ordered,
      fromIndex: 1,
      toIndex: 1,
      slots: openSlots,
      timeZone: TZ,
    });
    expect('assignments' in result && (result as { assignments: unknown[] }).assignments).toEqual(
      []
    );
  });
});

describe('findCollision', () => {
  const items = [
    makeItem({ id: 'a', scheduledTime: '2026-10-20T09:00:00.000Z', status: 'queued' }),
    makeItem({ id: 'b', scheduledTime: '2026-10-20T18:00:00.000Z', status: 'published' }),
  ];

  it('finds a pending post holding the target minute', () => {
    expect(findCollision(items, 'x', '2026-10-20T09:00:30.000Z')?.id).toBe('a');
  });

  it('ignores the item being rescheduled', () => {
    expect(findCollision(items, 'a', '2026-10-20T09:00:00.000Z')).toBeNull();
  });

  it('ignores published posts', () => {
    expect(findCollision(items, 'x', '2026-10-20T18:00:00.000Z')).toBeNull();
  });

  it('returns null when the minute is free', () => {
    expect(findCollision(items, 'x', '2026-10-20T12:00:00.000Z')).toBeNull();
  });
});

describe('canSwapTimes', () => {
  const slots = [
    makeSlot({ id: 'morning', slotTime: '09:00', allowedFormats: ['image'] }),
    makeSlot({ id: 'evening', slotTime: '18:00', allowedFormats: null }),
  ];
  const photoAtMorning = makeItem({
    id: 'a',
    postFormat: 'image',
    scheduledTime: '2026-10-20T09:00:00.000Z',
  });
  const reelAtEvening = makeItem({
    id: 'b',
    postFormat: 'reel',
    scheduledTime: '2026-10-20T18:00:00.000Z',
  });

  it('refuses the swap when a format would land on an incompatible slot', () => {
    // After the swap the reel would sit on the Photos-only morning slot.
    expect(canSwapTimes(photoAtMorning, reelAtEvening, slots, TZ)).toBe(false);
  });

  it('allows the swap when both formats fit both slots', () => {
    const photoAtEvening = makeItem({
      id: 'c',
      postFormat: 'image',
      scheduledTime: '2026-10-20T18:00:00.000Z',
    });
    expect(canSwapTimes(photoAtMorning, photoAtEvening, slots, TZ)).toBe(true);
  });

  it('allows the swap when a position has no governing slot', () => {
    // The custom-time post has no governing slot, and its format (image)
    // fits the morning Photos-only slot it would move onto.
    const custom = makeItem({
      id: 'd',
      postFormat: 'image',
      scheduledTime: '2026-10-20T14:37:00.000Z',
    });
    expect(canSwapTimes(photoAtMorning, custom, slots, TZ)).toBe(true);
  });
});

describe('getFailedReason', () => {
  const failed = makeItem({ status: 'failed', retryCount: 1, maxRetries: 3 });

  it('reports an expired connection first', () => {
    expect(getFailedReason(failed, true)).toBe(
      'Your Facebook connection expired before this posted.'
    );
  });

  it('maps upload problems when detail is available', () => {
    expect(getFailedReason(failed, false, 'media upload timed out')).toBe(
      'The media upload failed.'
    );
  });

  it('maps Facebook rejections when detail is available', () => {
    expect(getFailedReason(failed, false, 'rejected by policy check')).toBe(
      "Facebook didn't accept this post."
    );
  });

  it('notes exhausted retries', () => {
    expect(getFailedReason(makeItem({ status: 'failed', retryCount: 3, maxRetries: 3 }), false)).toBe(
      "Tried 3 times and still couldn't publish."
    );
  });

  it('falls back to the unknown message without leaking raw errors', () => {
    const reason = getFailedReason(failed, false);
    expect(reason).toBe('Something went wrong while publishing.');
    expect(reason).not.toContain('Error');
  });
});

describe('computeRetryTime', () => {
  const slots = [makeSlot({ slotTime: '09:00', allowedFormats: null })];
  const now = new Date('2026-10-20T08:00:00.000Z');

  it('uses the next covering slot for queue-mode posts', () => {
    const retry = computeRetryTime(
      makeItem({ postFormat: 'image', status: 'failed', scheduledTime: '2026-10-19T09:00:00.000Z' }),
      slots,
      TZ,
      now
    );
    expect(retry?.toISOString()).toBe('2026-10-20T09:00:00.000Z');
  });

  it('keeps a custom scheduled time that is still in the future', () => {
    const retry = computeRetryTime(
      makeItem({ postFormat: 'text', status: 'failed', scheduledTime: '2026-10-20T14:30:00.000Z' }),
      slots,
      TZ,
      now
    );
    expect(retry?.toISOString()).toBe('2026-10-20T14:30:00.000Z');
  });

  it('falls back to the next slot when the custom time already passed', () => {
    const retry = computeRetryTime(
      makeItem({ postFormat: 'text', status: 'failed', scheduledTime: '2026-10-19T14:30:00.000Z' }),
      slots,
      TZ,
      now
    );
    expect(retry?.toISOString()).toBe('2026-10-20T09:00:00.000Z');
  });

  it('returns null when no posting time covers the format', () => {
    const retry = computeRetryTime(
      makeItem({ postFormat: 'reel', status: 'failed' }),
      [makeSlot({ slotTime: '09:00', allowedFormats: ['image'] })],
      TZ,
      now
    );
    expect(retry).toBeNull();
  });
});

describe('formatQueueRowTime', () => {
  it('labels scheduled rows with the page timezone', () => {
    const item = makeItem({ scheduledTime: '2026-10-27T15:00:00.000Z' });
    expect(formatQueueRowTime(item, 'scheduled', TZ)).toBe(
      'Scheduled for Tue, Oct 27 at 3:00 PM UTC'
    );
  });

  it('labels queued and failed rows with the page timezone', () => {
    const item = makeItem({ scheduledTime: '2026-10-27T15:00:00.000Z' });
    expect(formatQueueRowTime(item, 'queued', TZ)).toBe('Tue 3:00 PM UTC');
    expect(formatQueueRowTime(item, 'failed', TZ)).toBe('Tue 3:00 PM UTC');
  });

  it('labels published rows with the page timezone', () => {
    const item = makeItem({
      status: 'published',
      scheduledTime: '2026-10-27T15:00:00.000Z',
      publishedAt: '2026-10-27T15:00:05.000Z',
    });
    expect(formatQueueRowTime(item, 'published', TZ)).toBe('Published Tue, Oct 27 at 3:00 PM UTC');
  });

  it('converts into a non-UTC timezone and labels it with that timezone', () => {
    const item = makeItem({ scheduledTime: '2026-10-27T15:00:00.000Z' });
    expect(formatQueueRowTime(item, 'scheduled', 'Asia/Karachi')).toBe(
      'Scheduled for Tue, Oct 27 at 8:00 PM Asia/Karachi'
    );
  });

  it('returns an empty string for an invalid scheduled time', () => {
    expect(formatQueueRowTime(makeItem({ scheduledTime: 'not-a-date' }), 'queued', TZ)).toBe('');
  });
});

describe('queue filter labels', () => {
  it('exposes all five filters', async () => {
    const { QUEUE_FILTERS } = await import('./queue-types');
    expect([...QUEUE_FILTERS] as QueueFilter[]).toEqual([
      'all',
      'queued',
      'scheduled',
      'published',
      'failed',
    ]);
  });
});
