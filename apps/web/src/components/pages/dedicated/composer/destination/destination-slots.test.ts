import { describe, it, expect } from 'vitest';
import { resolvePublishLimit } from '@fbuploadpro/contracts';
import {
  destinationQueueGoesOutLine,
  destinationSlotCoversFormat,
  getNextDestinationSlot,
  toDestinationSlotViews,
  type DestinationSlotView,
} from './destination-slots';
import { getDestinationLimitNote } from './destination-limit';

describe('toDestinationSlotViews — unified slots → slot summaries', () => {
  it('adapts timeOfDay + destination timezone + kind coverage', () => {
    const views = toDestinationSlotViews({
      destinationId: 'dest-1',
      timezone: 'America/New_York',
      slots: [
        {
          id: 'slot-1',
          destinationId: 'dest-1',
          kind: ['reel'],
          timeOfDay: '09:30:00',
          isActive: true,
        },
        {
          id: 'slot-2',
          destinationId: 'dest-1',
          kind: [],
          timeOfDay: '18:00:00',
          isActive: false,
        },
      ],
    });
    expect(views[0]).toMatchObject({
      id: 'slot-1',
      slotTime: '09:30',
      timezone: 'America/New_York',
      isActive: true,
      allowedFormats: ['reel'],
    });
    expect(views[1]?.isActive).toBe(false);
  });
});

describe('destination slot coverage + next occurrence', () => {
  const slot = (overrides: Partial<DestinationSlotView> = {}): DestinationSlotView => ({
    id: 'slot-1',
    slotTime: '09:00',
    timezone: 'UTC',
    isActive: true,
    allowedFormats: [],
    ...overrides,
  });

  it('an empty kind list covers every format; a listed one only its own', () => {
    expect(destinationSlotCoversFormat(slot(), 'image')).toBe(true);
    expect(destinationSlotCoversFormat(slot({ allowedFormats: ['reel'] }), 'reel')).toBe(
      true
    );
    expect(
      destinationSlotCoversFormat(slot({ allowedFormats: ['reel'] }), 'image')
    ).toBe(false);
    expect(
      destinationSlotCoversFormat(slot({ isActive: false }), 'image')
    ).toBe(false);
  });

  it('resolves the next occurrence strictly after now, in the slot timezone', () => {
    const from = new Date('2026-10-24T08:00:00.000Z');
    const next = getNextDestinationSlot([slot()], 'image', from);
    expect(next?.occurrence.toISOString()).toBe('2026-10-24T09:00:00.000Z');
    const later = getNextDestinationSlot(
      [slot()],
      'image',
      new Date('2026-10-24T09:30:00.000Z')
    );
    expect(later?.occurrence.toISOString()).toBe('2026-10-25T09:00:00.000Z');
  });

  it('returns null when no slot covers the format', () => {
    expect(
      getNextDestinationSlot([slot({ allowedFormats: ['story'] })], 'image')
    ).toBeNull();
  });
});

describe('destinationQueueGoesOutLine', () => {
  const occurrence = new Date('2026-10-24T09:00:00.000Z');

  it('names the format when a label is given (Instagram / Threads form)', () => {
    expect(destinationQueueGoesOutLine('Reels', occurrence, 'UTC')).toBe(
      'Goes out at the next posting time for Reels: Sat 9:00 AM UTC.'
    );
  });

  it('omits the format segment for a null label (the X form, spec 132 §4.5)', () => {
    expect(destinationQueueGoesOutLine(null, occurrence, 'UTC')).toBe(
      'Goes out at the next posting time: Sat 9:00 AM UTC.'
    );
  });
});

describe('D5 limit note — single-source from the contracts config', () => {
  it('states the Instagram caps exactly as resolvePublishLimit resolves them', () => {
    const limit = resolvePublishLimit('instagram');
    const note = getDestinationLimitNote('instagram');
    expect(limit?.publishedPosts).toBeDefined();
    expect(note).toContain(String(limit?.publishedPosts?.maxCount));
    expect(note).toContain(String(limit?.publishCalls?.maxCount));
    expect(note).toContain('Instagram');
  });

  it('states the Threads cap exactly as resolvePublishLimit resolves it', () => {
    const limit = resolvePublishLimit('threads');
    const note = getDestinationLimitNote('threads');
    expect(note).toContain(String(limit?.publishedPosts?.maxCount));
    expect(note).toContain('Threads');
  });
});
