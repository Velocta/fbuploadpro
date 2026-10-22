import { describe, it, expect } from 'vitest';
import {
  getNextSlotForFormat,
  getNextOccurrence,
  slotCoversFormat,
  formatSlotShort,
  formatSlotLong,
  queueGoesOutLine,
  toDateTimeLocalValue,
  parseDateTimeLocalValue,
  hasRealCaption,
} from './queue-slot-utils';
import type { PageSlotSummary } from '../tab-dashboard';

function makeSlot(overrides: Partial<PageSlotSummary> = {}): PageSlotSummary {
  return {
    id: 'slot-1',
    slotTime: '09:00',
    timezone: 'UTC',
    isActive: true,
    allowedFormats: null,
    ...overrides,
  };
}

describe('slotCoversFormat', () => {
  it('inactive slots never cover', () => {
    expect(slotCoversFormat(makeSlot({ isActive: false }), 'reel')).toBe(false);
  });

  it('null or empty allowedFormats covers every format', () => {
    expect(slotCoversFormat(makeSlot({ allowedFormats: null }), 'story')).toBe(true);
    expect(slotCoversFormat(makeSlot({ allowedFormats: [] }), 'text')).toBe(true);
  });

  it('respects the allowed format list', () => {
    const slot = makeSlot({ allowedFormats: ['reel', 'image'] });
    expect(slotCoversFormat(slot, 'reel')).toBe(true);
    expect(slotCoversFormat(slot, 'video')).toBe(false);
  });
});

describe('getNextOccurrence', () => {
  it('returns the slot time later today when still ahead', () => {
    const from = new Date('2026-10-20T07:00:00.000Z');
    const occurrence = getNextOccurrence(makeSlot({ slotTime: '09:00', timezone: 'UTC' }), from);
    expect(occurrence?.toISOString()).toBe('2026-10-20T09:00:00.000Z');
  });

  it('rolls to tomorrow when today\'s slot already passed', () => {
    const from = new Date('2026-10-20T10:00:00.000Z');
    const occurrence = getNextOccurrence(makeSlot({ slotTime: '09:00', timezone: 'UTC' }), from);
    expect(occurrence?.toISOString()).toBe('2026-10-21T09:00:00.000Z');
  });

  it('interprets slotTime in the slot timezone', () => {
    // 09:00 in Asia/Karachi (UTC+5) = 04:00 UTC
    const from = new Date('2026-10-20T07:00:00.000Z');
    const occurrence = getNextOccurrence(
      makeSlot({ slotTime: '09:00', timezone: 'Asia/Karachi' }),
      from
    );
    expect(occurrence?.toISOString()).toBe('2026-10-21T04:00:00.000Z');
  });

  it('falls back to UTC on an invalid timezone', () => {
    const from = new Date('2026-10-20T07:00:00.000Z');
    const occurrence = getNextOccurrence(
      makeSlot({ slotTime: '09:00', timezone: 'Not/AZone' }),
      from
    );
    expect(occurrence?.toISOString()).toBe('2026-10-20T09:00:00.000Z');
  });

  it('returns null for malformed slotTime', () => {
    expect(getNextOccurrence(makeSlot({ slotTime: 'bogus' }), new Date())).toBeNull();
    expect(getNextOccurrence(makeSlot({ slotTime: '25:00' }), new Date())).toBeNull();
  });
});

describe('getNextSlotForFormat', () => {
  const from = new Date('2026-10-20T07:00:00.000Z');

  it('picks the earliest covering slot', () => {
    const early = makeSlot({ id: 'early', slotTime: '08:00', allowedFormats: ['reel'] });
    const late = makeSlot({ id: 'late', slotTime: '12:00', allowedFormats: ['reel'] });
    expect(getNextSlotForFormat([late, early], 'reel', from)?.id).toBe('early');
  });

  it('skips slots that do not cover the format', () => {
    const photoOnly = makeSlot({ id: 'photo', slotTime: '08:00', allowedFormats: ['image'] });
    const reelSlot = makeSlot({ id: 'reel', slotTime: '18:00', allowedFormats: ['reel'] });
    expect(getNextSlotForFormat([photoOnly, reelSlot], 'reel', from)?.id).toBe('reel');
  });

  it('skips inactive slots', () => {
    const inactive = makeSlot({ id: 'inactive', slotTime: '08:00', isActive: false });
    expect(getNextSlotForFormat([inactive], 'reel', from)).toBeNull();
  });

  it('returns null when no slot covers the format', () => {
    const photoOnly = makeSlot({ id: 'photo', slotTime: '08:00', allowedFormats: ['image'] });
    expect(getNextSlotForFormat([photoOnly], 'story', from)).toBeNull();
  });

  it('returns null for an empty slot list', () => {
    expect(getNextSlotForFormat([], 'reel', from)).toBeNull();
  });

  it('treats a null-format list as covering all formats', () => {
    const slot = makeSlot({ id: 'any', slotTime: '08:00', allowedFormats: null });
    expect(getNextSlotForFormat([slot], 'text', from)?.id).toBe('any');
  });
});

describe('display formatters', () => {
  const date = new Date('2026-10-20T09:00:00.000Z');

  it('formatSlotShort renders "Tue 9:00 AM"', () => {
    expect(formatSlotShort(date, 'UTC')).toBe('Tue 9:00 AM');
  });

  it('formatSlotLong renders "Tue, Oct 20 at 9:00 AM"', () => {
    expect(formatSlotLong(date, 'UTC')).toBe('Tue, Oct 20 at 9:00 AM');
  });

  it('round-trips through datetime-local helpers', () => {
    const value = toDateTimeLocalValue(date, 'UTC');
    expect(value).toBe('2026-10-20T09:00');
    const parsed = parseDateTimeLocalValue(value, 'UTC');
    expect(parsed?.toISOString()).toBe('2026-10-20T09:00:00.000Z');
  });

  it('parseDateTimeLocalValue rejects malformed input', () => {
    expect(parseDateTimeLocalValue('nope', 'UTC')).toBeNull();
    expect(parseDateTimeLocalValue('', 'UTC')).toBeNull();
  });

  it('renders in the requested timezone', () => {
    // 09:00 UTC = 2:00 PM in Asia/Karachi
    expect(formatSlotShort(date, 'Asia/Karachi')).toBe('Tue 2:00 PM');
  });
});

describe('queueGoesOutLine (QA #11 composer half, #14)', () => {
  const date = new Date('2026-10-20T09:00:00.000Z'); // a Tuesday

  it('labels the timezone and pluralizes Stories correctly', () => {
    expect(queueGoesOutLine('story', date, 'UTC')).toBe(
      'Goes out at the next posting time for Stories: Tue 9:00 AM UTC.'
    );
  });

  it('labels non-UTC slot timezones with the time in that timezone', () => {
    expect(queueGoesOutLine('reel', date, 'Asia/Karachi')).toBe(
      'Goes out at the next posting time for Reels: Tue 2:00 PM Asia/Karachi.'
    );
  });

  it('falls back to UTC on an invalid timezone', () => {
    expect(queueGoesOutLine('image', date, 'Not/AZone')).toBe(
      'Goes out at the next posting time for Photos: Tue 9:00 AM UTC.'
    );
  });
});

describe('hasRealCaption', () => {
  it('treats a filename-derived caption as not real', () => {
    expect(hasRealCaption({ name: 'sunset.jpg', captionText: 'sunset' })).toBe(false);
  });

  it('treats a user-written caption as real', () => {
    expect(
      hasRealCaption({ name: 'sunset.jpg', captionText: 'Golden hour over the lake.' })
    ).toBe(true);
  });

  it('treats missing or blank captions as not real', () => {
    expect(hasRealCaption({ name: 'sunset.jpg', captionText: null })).toBe(false);
    expect(hasRealCaption({ name: 'sunset.jpg', captionText: '   ' })).toBe(false);
  });
});
