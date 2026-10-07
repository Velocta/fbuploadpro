import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MediaPreviewModal } from '../../src/components/media/media-preview-modal';
import type { MediaItemResponse } from '@fbuploadpro/contracts';

describe('MediaPreviewModal Component (T108)', () => {
  const dummyVideoItem: MediaItemResponse = {
    id: '11111111-1111-1111-1111-111111111111',
    userId: 'user-1',
    folderId: null,
    name: 'product-reel.mp4',
    fileSize: 52428800,
    mimeType: 'video/mp4',
    mediaType: 'video',
    storageKey: 'tenants/acme/media/1/product-reel.mp4',
    url: 'https://cdn.example.com/product-reel.mp4',
    thumbnailKey: 'tenants/acme/media/1/thumb.webp',
    thumbnailUrl: 'https://cdn.example.com/thumb.webp',
    durationSeconds: 15.5,
    aspectRatio: '9:16',
    tags: ['promo', 'reels'],
    captionTemplateId: null,
    captionText: 'Limited time summer sale! Link in bio.',
    createdAt: '2026-10-07T10:00:00Z',
    updatedAt: '2026-10-07T10:00:00Z',
  };

  const dummyImageItem: MediaItemResponse = {
    id: '22222222-2222-2222-2222-222222222222',
    userId: 'user-1',
    folderId: null,
    name: 'summer-hero.webp',
    fileSize: 1048576,
    mimeType: 'image/webp',
    mediaType: 'image',
    storageKey: 'tenants/acme/media/2/summer-hero.webp',
    url: 'https://cdn.example.com/summer-hero.webp',
    thumbnailKey: null,
    thumbnailUrl: null,
    durationSeconds: null,
    aspectRatio: '16:9',
    tags: ['hero', 'web'],
    captionTemplateId: null,
    captionText: null,
    createdAt: '2026-10-07T10:00:00Z',
    updatedAt: '2026-10-07T10:00:00Z',
  };

  it('returns null when isOpen is false or item is null', () => {
    const html1 = renderToString(
      <MediaPreviewModal item={null} isOpen={true} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(html1).toBe('');

    const html2 = renderToString(
      <MediaPreviewModal item={dummyVideoItem} isOpen={false} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(html2).toBe('');
  });

  it('renders video player, technical metadata, and caption for video item', () => {
    const html = renderToString(
      <MediaPreviewModal
        item={dummyVideoItem}
        isOpen={true}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Player & Title
    expect(html).toContain('product-reel.mp4');
    expect(html).toContain('<video');
    expect(html).toContain('https://cdn.example.com/product-reel.mp4');

    // Technical Metadata Inspector
    expect(html).toContain('50.00 MB');
    expect(html).toContain('video/mp4');
    expect(html).toContain('9:16');
    expect(html).toContain('0:15');

    // Tags & Caption
    expect(html).toContain('#promo');
    expect(html).toContain('Limited time summer sale! Link in bio.');

    // Delete CTA
    expect(html).toContain('Delete Asset');
  });

  it('renders image preview and metadata for image item', () => {
    const html = renderToString(
      <MediaPreviewModal
        item={dummyImageItem}
        isOpen={true}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(html).toContain('summer-hero.webp');
    expect(html).toContain('<img');
    expect(html).toContain('1.00 MB');
    expect(html).toContain('image/webp');
    expect(html).toContain('16:9');
  });
});
