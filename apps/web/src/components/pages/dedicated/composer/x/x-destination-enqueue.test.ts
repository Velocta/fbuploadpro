import { describe, it, expect } from 'vitest';
import { buildXEnqueueRequest, xPostKind, type XEnqueueShape } from './x-destination-enqueue';
import type { XMediaItem } from './x-media-area';

const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';
const MEDIA_ID = '22222222-2222-4222-8222-222222222222';

const IMAGE_ITEM: XMediaItem = {
  id: MEDIA_ID,
  name: 'chart.png',
  mediaType: 'image',
  url: 'https://cdn.example/chart.png',
  thumbnailUrl: null,
  captionText: null,
  durationSeconds: null,
  fileSizeBytes: 1024,
};

const VIDEO_ITEM: XMediaItem = { ...IMAGE_ITEM, name: 'clip.mp4', mediaType: 'video', durationSeconds: 12 };

function shape(overrides: Partial<XEnqueueShape> = {}): XEnqueueShape {
  return {
    text: 'Hello X',
    item: null,
    intent: 'now',
    scheduleDate: null,
    replySettings: 'everyone',
    quoteTweetId: '',
    altText: '',
    poll: null,
    ...overrides,
  };
}

describe('xPostKind', () => {
  it('maps no media to text, image media to image, video media to video', () => {
    expect(xPostKind(null)).toBe('text');
    expect(xPostKind(IMAGE_ITEM)).toBe('image');
    expect(xPostKind(VIDEO_ITEM)).toBe('video');
  });
});

describe('buildXEnqueueRequest (spec 132 §4.5)', () => {
  it('builds a post-now text request with the reply setting always explicit', () => {
    const request = buildXEnqueueRequest(DESTINATION_ID, shape());
    expect(request).toEqual({
      platform: 'x',
      destinationId: DESTINATION_ID,
      kind: 'text',
      caption: 'Hello X',
      mediaItemIds: [],
      intent: 'now',
      platformOptions: { replySettings: 'everyone' },
    });
  });

  it('carries exactly one media id — the MAX-1 attachment rule', () => {
    const request = buildXEnqueueRequest(DESTINATION_ID, shape({ item: IMAGE_ITEM }));
    expect(request.kind).toBe('image');
    expect(request.mediaItemIds).toEqual([MEDIA_ID]);
  });

  it('maps the schedule intent to the contract vocabulary with an ISO instant', () => {
    const when = new Date('2027-01-05T09:30:00.000Z');
    const request = buildXEnqueueRequest(DESTINATION_ID, shape({ intent: 'schedule', scheduleDate: when }));
    expect(request.intent).toBe('scheduled');
    expect(request.scheduledAt).toBe('2027-01-05T09:30:00.000Z');
  });

  it('sends no scheduledAt for the queue intent (the server resolves the slot)', () => {
    const request = buildXEnqueueRequest(DESTINATION_ID, shape({ intent: 'queue' }));
    expect(request.intent).toBe('queue');
    expect(request.scheduledAt).toBeUndefined();
    expect('slotId' in request).toBe(false);
  });

  it('includes quote and alt text only when present (alt text needs media)', () => {
    const bare = buildXEnqueueRequest(DESTINATION_ID, shape({ altText: 'ignored without media' }));
    expect(bare.platformOptions).toEqual({ replySettings: 'everyone' });

    const full = buildXEnqueueRequest(
      DESTINATION_ID,
      shape({ item: IMAGE_ITEM, quoteTweetId: ' 1234567890 ', altText: ' A chart ' })
    );
    expect(full.platformOptions).toEqual({
      replySettings: 'everyone',
      quoteTweetId: '1234567890',
      altText: 'A chart',
    });
  });

  it('assembles the poll with trimmed options and no media', () => {
    const request = buildXEnqueueRequest(
      DESTINATION_ID,
      shape({ poll: { options: [' Yes ', 'No'], durationMinutes: 1440 }, replySettings: 'following' })
    );
    expect(request.platformOptions).toEqual({
      replySettings: 'following',
      poll: { options: ['Yes', 'No'], durationMinutes: 1440 },
    });
    expect(request.mediaItemIds).toEqual([]);
  });

  it('never emits thread-chain keys (the strict schema rejects them; chains are absent in v1)', () => {
    const request = buildXEnqueueRequest(DESTINATION_ID, shape());
    expect(Object.keys(request.platformOptions ?? {})).not.toContain('thread');
    expect(Object.keys(request)).not.toContain('thread');
  });
});
