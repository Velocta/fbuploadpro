/**
 * @file media-preview-modal.test.tsx
 * @description Spec 113: Asset Details preview pane renders black while the
 * grid thumbnail renders fine. The preview previously used only the
 * full-size `item.url` — a <video> with no poster and an <img> with no
 * error fallback — on a pitch-black pane. These tests pin the fix: video
 * gets the thumbnail as poster (+ preload="metadata"), images keep the
 * full-size URL primary and fall back to the thumbnail URL (the source
 * the grid renders) before showing a placeholder.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import {
  MediaPreviewModal,
  resolvePreviewImageSrc,
} from '@/components/media/media-preview-modal';
import { render } from '../components/setup';

const VIDEO_ITEM: MediaItemResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  userId: '00000000-0000-4000-8000-000000000001',
  folderId: null,
  name: 'Viral Launch Reel.mp4',
  mediaType: 'video',
  mimeType: 'video/mp4',
  fileSize: 15728640,
  storageKey: 'users/u1/media/m1.mp4',
  url: 'https://media.fbuploadpro.com/users/u1/media/m1.mp4',
  thumbnailKey: 'users/u1/thumbnails/m1.webp',
  thumbnailUrl: 'https://media.fbuploadpro.com/users/u1/thumbnails/m1.webp',
  durationSeconds: 45,
  aspectRatio: '9:16',
  captionText: 'Viral Launch Reel',
  createdAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
};

const IMAGE_ITEM: MediaItemResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  userId: '00000000-0000-4000-8000-000000000001',
  folderId: null,
  name: 'Product_Showcase_Banner.png',
  mediaType: 'image',
  mimeType: 'image/png',
  fileSize: 2097152,
  storageKey: 'users/u1/media/m2.png',
  url: 'https://media.fbuploadpro.com/users/u1/media/m2.png',
  thumbnailKey: 'users/u1/thumbnails/m2.webp',
  thumbnailUrl: 'https://media.fbuploadpro.com/users/u1/thumbnails/m2.webp',
  durationSeconds: null,
  aspectRatio: '1:1',
  captionText: '',
  createdAt: '2026-10-10T11:00:00.000Z',
  updatedAt: '2026-10-10T11:00:00.000Z',
};

describe('Spec 113: MediaPreviewModal preview pane', () => {
  it('renders the video with the thumbnail as poster so the pane is not black before playback', () => {
    const { findTags, hasAttribute } = render(
      <MediaPreviewModal item={VIDEO_ITEM} open={true} onOpenChange={vi.fn()} />
    );

    expect(hasAttribute('data-testid', 'modal-video-player')).toBe(true);
    const video = findTags('video').find(
      (v) => v.attributes['data-testid'] === 'modal-video-player'
    );
    expect(video?.attributes.src).toBe(VIDEO_ITEM.url);
    expect(video?.attributes.poster).toBe(VIDEO_ITEM.thumbnailUrl);
    expect(video?.attributes.preload).toBe('metadata');
    expect(hasAttribute('data-testid', 'modal-preview-placeholder')).toBe(false);
  });

  it('renders a video without a thumbnail with no poster and no placeholder', () => {
    const noThumb = { ...VIDEO_ITEM, thumbnailKey: null, thumbnailUrl: null };
    const { findTags, hasAttribute } = render(
      <MediaPreviewModal item={noThumb} open={true} onOpenChange={vi.fn()} />
    );

    const video = findTags('video').find(
      (v) => v.attributes['data-testid'] === 'modal-video-player'
    );
    expect(video?.attributes.src).toBe(noThumb.url);
    expect(video?.attributes.poster).toBeUndefined();
    expect(hasAttribute('data-testid', 'modal-preview-placeholder')).toBe(false);
  });

  it('renders an image preview from the full-size URL', () => {
    const { findTags, hasAttribute } = render(
      <MediaPreviewModal item={IMAGE_ITEM} open={true} onOpenChange={vi.fn()} />
    );

    expect(hasAttribute('data-testid', 'modal-image-preview')).toBe(true);
    const img = findTags('img').find(
      (i) => i.attributes['data-testid'] === 'modal-image-preview'
    );
    expect(img?.attributes.src).toBe(IMAGE_ITEM.url);
    expect(img?.attributes.alt).toBe(IMAGE_ITEM.name);
    expect(hasAttribute('data-testid', 'modal-preview-placeholder')).toBe(false);
  });
});

describe('Spec 113: resolvePreviewImageSrc fallback order', () => {
  const item = { url: IMAGE_ITEM.url, thumbnailUrl: IMAGE_ITEM.thumbnailUrl };

  it('prefers the full-size URL when nothing has failed', () => {
    expect(resolvePreviewImageSrc(item, new Set())).toBe(IMAGE_ITEM.url);
  });

  it('falls back to the thumbnail URL (the grid source) when the full-size URL fails', () => {
    expect(resolvePreviewImageSrc(item, new Set([IMAGE_ITEM.url]))).toBe(
      IMAGE_ITEM.thumbnailUrl
    );
  });

  it('returns null when both sources have failed so a placeholder renders instead of black', () => {
    expect(
      resolvePreviewImageSrc(item, new Set([IMAGE_ITEM.url, IMAGE_ITEM.thumbnailUrl!]))
    ).toBeNull();
  });

  it('returns null when the full-size URL fails and there is no distinct thumbnail', () => {
    expect(resolvePreviewImageSrc({ url: IMAGE_ITEM.url, thumbnailUrl: null }, new Set([IMAGE_ITEM.url]))).toBeNull();
    expect(
      resolvePreviewImageSrc(
        { url: IMAGE_ITEM.url, thumbnailUrl: IMAGE_ITEM.url },
        new Set([IMAGE_ITEM.url])
      )
    ).toBeNull();
  });
});
