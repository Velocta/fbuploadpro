/**
 * @file media-import-confirm-parse.test.ts
 * @description Spec 114: the media confirm API returns the media item
 * directly as the response body (no `{ item: ... }` wrapper) — see
 * `apps/web/src/app/api/tenant/[subdomain]/media/confirm/route.ts`, which
 * responds `NextResponse.json(MediaItemResponseSchema.parse(...), { status: 201 })`.
 * `confirmMediaUpload()` previously read `confirmData.item`, so the uploaded
 * item was always `undefined` and `onUploadSuccess` never fired.
 */

import { describe, it, expect } from 'vitest';
import { MediaItemResponseSchema, type MediaItemResponse } from '@fbuploadpro/contracts';
import { parseConfirmUploadResponse } from '@/components/media/media-import-upload-engine';

/** Exact shape the confirm route returns: the item itself, validated by its schema. */
const confirmResponseBody: MediaItemResponse = MediaItemResponseSchema.parse({
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  folderId: null,
  name: 'boss-clip.mp4',
  fileSize: 2048,
  mimeType: 'video/mp4',
  mediaType: 'video',
  storageKey: 'direct-post/boss-clip.mp4',
  url: 'https://media.example.com/boss-clip.mp4',
  thumbnailKey: null,
  thumbnailUrl: null,
  durationSeconds: 9,
  aspectRatio: '9:16',
  captionText: 'boss clip',
  width: 1080,
  height: 1920,
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
});

describe('parseConfirmUploadResponse (Spec 114)', () => {
  it('returns the media item from the direct response body', () => {
    const item = parseConfirmUploadResponse(confirmResponseBody);
    expect(item).toBeDefined();
    expect(item).toEqual(confirmResponseBody);
    expect(item.id).toBe(confirmResponseBody.id);
    expect(item.name).toBe('boss-clip.mp4');
  });

  it('does not expect an { item } wrapper — a wrapped body is not the API shape', () => {
    // Regression guard for the old parse: reading `.item` off the real
    // (unwrapped) body yielded undefined, which suppressed onUploadSuccess.
    const parsed = parseConfirmUploadResponse(confirmResponseBody) as
      | MediaItemResponse
      | undefined;
    expect(parsed).not.toBeUndefined();
    expect((confirmResponseBody as unknown as { item?: unknown }).item).toBeUndefined();
  });
});
