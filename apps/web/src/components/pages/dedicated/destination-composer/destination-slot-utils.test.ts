import { describe, it, expect } from 'vitest';
import type { DestinationPostingSlot } from '@fbuploadpro/contracts';
import {
  destinationSlotSummary,
  destinationQueueGoesOutLine,
  getNextSlotForKind,
  slotCoversKind,
} from './destination-slot-utils';

const SLOT: DestinationPostingSlot = {
  id: '11111111-1111-4111-8111-111111111111',
  destinationId: '22222222-2222-4222-8222-222222222222',
  kind: ['video'],
  timeOfDay: '09:00',
  isActive: true,
};

describe('destination slot utils (spec 132)', () => {
  it('maps a destination slot onto the shared summary shape', () => {
    expect(destinationSlotSummary(SLOT, 'America/New_York')).toEqual({
      id: SLOT.id,
      slotTime: '09:00',
      timezone: 'America/New_York',
      isActive: true,
      allowedFormats: ['video'],
    });
  });

  it('covers only the kinds in the slot list — and every kind when the list is empty', () => {
    expect(slotCoversKind(SLOT, 'video')).toBe(true);
    expect(slotCoversKind(SLOT, 'image')).toBe(false);
    expect(slotCoversKind({ ...SLOT, kind: [] }, 'image')).toBe(true);
    expect(slotCoversKind({ ...SLOT, isActive: false }, 'video')).toBe(false);
  });

  it('finds the earliest covering occurrence in the destination timezone', () => {
    const from = new Date('2026-10-24T08:00:00.000Z');
    const next = getNextSlotForKind([SLOT], 'video', 'UTC', from);
    expect(next?.slot.id).toBe(SLOT.id);
    expect(next?.occurrence.toISOString()).toBe('2026-10-24T09:00:00.000Z');
    // A slot that does not cover the kind yields nothing.
    expect(getNextSlotForKind([SLOT], 'image', 'UTC', from)).toBeNull();
  });

  it('labels the queue line with the kind and the timezone', () => {
    const line = destinationQueueGoesOutLine(
      'Videos',
      new Date('2026-10-27T09:00:00.000Z'),
      'UTC',
    );
    expect(line).toContain('Videos');
    expect(line).toContain('UTC');
  });
});
