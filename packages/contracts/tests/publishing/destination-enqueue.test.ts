import { describe, expect, it } from 'vitest';
import {
  DestinationEnqueueRequestSchema,
  resolveDestinationPlatformOptions,
} from '../../src/publishing/destination-enqueue.js';

const destinationId = '33333333-3333-4333-a333-333333333333';
const mediaId = '44444444-4444-4444-a444-444444444444';
const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe('DestinationEnqueueRequestSchema', () => {
  it('accepts a Facebook text post for immediate publish', () => {
    const parsed = DestinationEnqueueRequestSchema.parse({
      platform: 'facebook',
      destinationId,
      kind: 'text',
      caption: 'Hello page',
      intent: 'now',
    });
    expect(parsed.intent).toBe('now');
    expect(parsed.mediaItemIds).toEqual([]);
    expect(parsed.caption).toBe('Hello page');
  });

  it('accepts a scheduled Instagram reel with options', () => {
    const parsed = DestinationEnqueueRequestSchema.parse({
      platform: 'instagram',
      destinationId,
      kind: 'video',
      platformFormat: 'reel',
      caption: 'A reel',
      mediaItemIds: [mediaId],
      intent: 'scheduled',
      scheduledAt: future,
      platformOptions: { shareToFeed: true },
    });
    expect(parsed.platform).toBe('instagram');
    expect(parsed.scheduledAt).toBe(future);
  });

  it('rejects a scheduled post without scheduledAt', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'facebook',
      destinationId,
      kind: 'text',
      caption: 'Hi',
      intent: 'scheduled',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a scheduled post in the past', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'facebook',
      destinationId,
      kind: 'text',
      caption: 'Hi',
      intent: 'scheduled',
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects scheduledAt on a post-now intent', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'facebook',
      destinationId,
      kind: 'text',
      caption: 'Hi',
      intent: 'now',
      scheduledAt: future,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a media post without media', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'instagram',
      destinationId,
      kind: 'image',
      caption: 'Photo',
      intent: 'now',
    });
    expect(result.success).toBe(false);
  });

  it('rejects media attached to a text post', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'x',
      destinationId,
      kind: 'text',
      caption: 'Text',
      mediaItemIds: [mediaId],
      intent: 'now',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a text-only Instagram post (no such format)', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'instagram',
      destinationId,
      kind: 'text',
      caption: 'Text',
      intent: 'now',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a YouTube post without a title', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'youtube',
      destinationId,
      kind: 'video',
      caption: 'Description',
      mediaItemIds: [mediaId],
      intent: 'now',
      platformOptions: { privacy: 'public', madeForKids: false },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a YouTube post without the required audience declaration', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'youtube',
      destinationId,
      kind: 'video',
      title: 'My video',
      mediaItemIds: [mediaId],
      intent: 'now',
      platformOptions: { privacy: 'public' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a TikTok isDraft smuggle (spec 126: deliberately unmodelled)', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'tiktok',
      destinationId,
      kind: 'video',
      caption: 'Clip',
      mediaItemIds: [mediaId],
      intent: 'now',
      platformOptions: { isDraft: true },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown Instagram option key (strict schemas)', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'instagram',
      destinationId,
      kind: 'image',
      caption: 'Photo',
      mediaItemIds: [mediaId],
      intent: 'now',
      platformOptions: { locationTag: 'somewhere' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an X poll combined with media (poll XOR media)', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'x',
      destinationId,
      kind: 'image',
      caption: 'Pick one',
      mediaItemIds: [mediaId],
      intent: 'now',
      platformOptions: {
        poll: { options: ['A', 'B'], durationMinutes: 60 },
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts an X poll as a text post', () => {
    const parsed = DestinationEnqueueRequestSchema.parse({
      platform: 'x',
      destinationId,
      kind: 'text',
      caption: 'Pick one',
      intent: 'queue',
      platformOptions: {
        poll: { options: ['A', 'B'], durationMinutes: 60 },
      },
    });
    expect(parsed.platform).toBe('x');
  });

  it('requires carousel items for an Instagram carousel post', () => {
    const missing = DestinationEnqueueRequestSchema.safeParse({
      platform: 'instagram',
      destinationId,
      kind: 'carousel',
      caption: 'Swipe',
      mediaItemIds: [mediaId],
      intent: 'now',
    });
    expect(missing.success).toBe(false);

    const present = DestinationEnqueueRequestSchema.safeParse({
      platform: 'instagram',
      destinationId,
      kind: 'carousel',
      caption: 'Swipe',
      mediaItemIds: [mediaId],
      intent: 'now',
      platformOptions: {
        carouselItems: [
          { mediaUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' },
          { mediaUrl: 'https://cdn.example.com/2.jpg', mediaType: 'image' },
        ],
      },
    });
    expect(present.success).toBe(true);
  });

  it('rejects a Facebook story with a first comment', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      platform: 'facebook',
      destinationId,
      kind: 'story',
      mediaItemIds: [mediaId],
      firstComment: 'First!',
      intent: 'now',
    });
    expect(result.success).toBe(false);
  });

  it('normalises an empty first comment to null', () => {
    const parsed = DestinationEnqueueRequestSchema.parse({
      platform: 'facebook',
      destinationId,
      kind: 'text',
      caption: 'Hi',
      firstComment: '   ',
      intent: 'now',
    });
    expect(parsed.firstComment).toBeNull();
  });
});

describe('resolveDestinationPlatformOptions', () => {
  it('materialises TikTok defaults for an omitted options object', () => {
    const resolved = resolveDestinationPlatformOptions('tiktok', undefined);
    expect(resolved).toEqual({ ok: true, options: { privacy: 'public' } });
  });

  it('fails YouTube for an omitted options object (no omission path)', () => {
    const resolved = resolveDestinationPlatformOptions('youtube', undefined);
    expect(resolved.ok).toBe(false);
  });

  it('fails a TikTok isDraft smuggle at resolution time', () => {
    const resolved = resolveDestinationPlatformOptions('tiktok', {
      isDraft: true,
    });
    expect(resolved.ok).toBe(false);
  });

  it('passes valid Instagram options through unchanged', () => {
    const resolved = resolveDestinationPlatformOptions('instagram', {
      shareToFeed: false,
    });
    expect(resolved).toEqual({ ok: true, options: { shareToFeed: false } });
  });
});
