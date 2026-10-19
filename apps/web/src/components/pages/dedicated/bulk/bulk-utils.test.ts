import { describe } from 'vitest';
import { expect, it } from 'vitest';
import {
  BulkEnqueueRequestSchema,
  BULK_MAX_ITEMS,
  type PostFormat,
} from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import type { ComposerMediaItem } from '../composer/composer-media-area';
import {
  computeBulkQueueTimes,
  describeQueueRange,
  partitionAssets,
  resolveRowCaption,
  suggestFormatForExcluded,
} from './bulk-utils';

function slot(
  id: string,
  slotTime: string,
  allowedFormats?: string[] | null
): PageSlotSummary {
  return { id, slotTime, timezone: 'UTC', isActive: true, allowedFormats: allowedFormats ?? null };
}

function asset(id: string, mediaType: 'image' | 'video'): ComposerMediaItem {
  return {
    id,
    name: `${id}.${mediaType === 'image' ? 'png' : 'mp4'}`,
    mediaType,
    url: `https://example.com/${id}`,
  };
}

describe('computeBulkQueueTimes', () => {
  it('assigns successive occurrences in order', () => {
    const slots = [slot('a', '09:00'), slot('b', '18:00')];
    const from = new Date('2026-10-19T08:00:00Z'); // Monday 08:00 UTC
    const times = computeBulkQueueTimes(slots, 'image', 3, from);
    expect(times).toHaveLength(3);
    expect(times[0].date.toISOString()).toBe('2026-10-19T09:00:00.000Z');
    expect(times[1].date.toISOString()).toBe('2026-10-19T18:00:00.000Z');
    expect(times[2].date.toISOString()).toBe('2026-10-20T09:00:00.000Z');
  });

  it('skips slots that do not cover the format', () => {
    const slots = [slot('photo-only', '09:00', ['image']), slot('reel-only', '10:00', ['reel'])];
    const from = new Date('2026-10-19T08:00:00Z');
    const times = computeBulkQueueTimes(slots, 'image', 2, from);
    expect(times).toHaveLength(2);
    expect(times[0].date.toISOString()).toBe('2026-10-19T09:00:00.000Z');
    expect(times[1].date.toISOString()).toBe('2026-10-20T09:00:00.000Z');
  });

  it('stops early when no slot covers the format', () => {
    const slots = [slot('photo-only', '09:00', ['image'])];
    const from = new Date('2026-10-19T08:00:00Z');
    expect(computeBulkQueueTimes(slots, 'reel', 2, from)).toHaveLength(0);
  });

  it('ignores inactive slots', () => {
    const slots = [{ ...slot('off', '09:00'), isActive: false }];
    const from = new Date('2026-10-19T08:00:00Z');
    expect(computeBulkQueueTimes(slots, 'image', 1, from)).toHaveLength(0);
  });
});

describe('describeQueueRange', () => {
  it('renders the first-to-last range line', () => {
    const times = computeBulkQueueTimes(
      [slot('a', '09:00'), slot('b', '18:00')],
      'image',
      3,
      new Date('2026-10-19T08:00:00Z')
    );
    expect(describeQueueRange(times)).toBe('3 posts → Mon 9:00 AM … Tue 9:00 AM');
  });

  it('handles a single post and an empty list', () => {
    const times = computeBulkQueueTimes([slot('a', '09:00')], 'image', 1, new Date('2026-10-19T08:00:00Z'));
    expect(describeQueueRange(times)).toBe('1 post → Mon 9:00 AM');
    expect(describeQueueRange([])).toBeNull();
  });
});

describe('partitionAssets', () => {
  it('excludes non-matching assets per format', () => {
    const assets = [asset('a', 'image'), asset('b', 'video'), asset('c', 'video')];
    const { eligible, excluded } = partitionAssets(assets, 'image');
    expect(eligible.map((a) => a.id)).toEqual(['a']);
    expect(excluded.map((a) => a.id)).toEqual(['b', 'c']);
  });

  it('suggests a format switch when excluded assets agree', () => {
    const excluded = [asset('b', 'video'), asset('c', 'video')];
    expect(suggestFormatForExcluded(excluded)).toBe('video');
  });

  it('suggests nothing when excluded assets disagree', () => {
    const excluded = [asset('b', 'video'), asset('d', 'image')];
    expect(suggestFormatForExcluded(excluded)).toBeNull();
    expect(suggestFormatForExcluded([])).toBeNull();
  });
});

describe('resolveRowCaption', () => {
  const base = asset('a', 'image');
  it('prefers a per-row override', () => {
    expect(resolveRowCaption({ ...base, captionText: 'Real caption' }, 'Shared', { a: 'Override' })).toBe('Override');
    expect(resolveRowCaption({ ...base, captionText: 'Real caption' }, 'Shared', { a: '' })).toBe('');
  });
  it('uses the real library caption over the shared caption', () => {
    expect(resolveRowCaption({ ...base, captionText: 'My holiday snap' }, 'Shared', {})).toBe('My holiday snap');
  });
  it('ignores filename-derived pseudo-captions', () => {
    // deriveDefaultCaptionFromFilename('holiday.png') === 'holiday'
    expect(resolveRowCaption({ ...base, name: 'holiday.png', captionText: 'holiday' }, 'Shared', {})).toBe('Shared');
    expect(resolveRowCaption({ ...base, name: 'holiday.png', captionText: 'holiday' }, '  ', {})).toBe('');
  });
  it('falls back to empty when there is no shared caption', () => {
    expect(resolveRowCaption(base, '', {})).toBe('');
  });
});

describe('bulk request 150-cap', () => {
  const item = (i: number) => ({
    mediaId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    format: 'image' as PostFormat,
    caption: '',
    scheduledTime: '2026-10-20T09:00:00.000Z',
  });
  const base = { pageId: '11111111-1111-4111-8111-111111111111' };

  it('accepts exactly 150 items and rejects 151', () => {
    expect(BULK_MAX_ITEMS).toBe(150);
    expect(
      BulkEnqueueRequestSchema.safeParse({
        ...base,
        items: Array.from({ length: 150 }, (_, i) => item(i)),
      }).success
    ).toBe(true);
    expect(
      BulkEnqueueRequestSchema.safeParse({
        ...base,
        items: Array.from({ length: 151 }, (_, i) => item(i)),
      }).success
    ).toBe(false);
  });
});
