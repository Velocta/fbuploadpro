import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MediaGrid, formatDuration } from '../../src/components/media/media-grid';
import type { MediaItemResponse } from '@fbuploadpro/contracts';

describe('MediaGrid Component (T107)', () => {
  const dummyItems: MediaItemResponse[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      folderId: null,
      name: 'viral-reel.mp4',
      fileSize: 52428800,
      mimeType: 'video/mp4',
      mediaType: 'video',
      storageKey: 'tenants/acme/media/1/reel.mp4',
      url: 'https://cdn.example.com/reel.mp4',
      thumbnailKey: 'tenants/acme/media/1/thumb.webp',
      thumbnailUrl: 'https://cdn.example.com/thumb.webp',
      durationSeconds: 15.5,
      aspectRatio: '9:16',
      tags: ['viral', 'summer'],
      captionTemplateId: null,
      captionText: 'Watch this now!',
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      userId: 'user-1',
      folderId: null,
      name: 'promo-banner.png',
      fileSize: 2097152,
      mimeType: 'image/png',
      mediaType: 'image',
      storageKey: 'tenants/acme/media/2/banner.png',
      url: 'https://cdn.example.com/banner.png',
      thumbnailKey: null,
      thumbnailUrl: null,
      durationSeconds: null,
      aspectRatio: '16:9',
      tags: ['banner'],
      captionTemplateId: null,
      captionText: null,
      createdAt: '2026-10-07T11:00:00Z',
      updatedAt: '2026-10-07T11:00:00Z',
    },
  ];

  it('formats video duration into mm:ss accurately', () => {
    expect(formatDuration(15.5)).toBe('0:15');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(3605)).toBe('60:05');
    expect(formatDuration(null)).toBe('');
  });

  it('renders empty state when items is empty and not loading', () => {
    const html = renderToString(<MediaGrid items={[]} isLoading={false} onSelectItem={vi.fn()} />);
    expect(html).toContain('No media assets found');
  });

  it('renders loading skeleton when isLoading is true', () => {
    const html = renderToString(<MediaGrid items={[]} isLoading={true} onSelectItem={vi.fn()} />);
    expect(html).toContain('Loading assets');
  });

  it('renders media grid items with aspect ratio badges and video indicators', () => {
    const html = renderToString(
      <MediaGrid items={dummyItems} isLoading={false} onSelectItem={vi.fn()} />
    );

    // Video card
    expect(html).toContain('viral-reel.mp4');
    expect(html).toContain('9:16');
    expect(html).toContain('0:15');
    expect(html).toContain('50.00 MB');
    expect(html).toContain('#viral');

    // Image card
    expect(html).toContain('promo-banner.png');
    expect(html).toContain('16:9');
    expect(html).toContain('2.00 MB');
    expect(html).toContain('#banner');
  });
});
