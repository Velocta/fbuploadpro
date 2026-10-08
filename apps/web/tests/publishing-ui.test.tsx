import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { PageQueueSlot, QueueItem, PublishLog, FacebookPageView, MediaItemResponse, CaptionTemplateResponse } from '@fbuploadpro/contracts';

import { SlotsManager } from '../src/components/publishing/slots-manager';
import { QueueTimeline } from '../src/components/publishing/queue-timeline';
import { EnqueueModal } from '../src/components/publishing/enqueue-modal';
import { PublishLogsTable } from '../src/components/publishing/publish-logs-table';
import TenantPublishingPage from '../src/app/tenant/[subdomain]/publishing/page';
import TenantLayout from '../src/app/tenant/[subdomain]/layout';

describe('Publishing Queue UI Components & Dashboard (T139 - T143)', () => {
  const mockSlots: PageQueueSlot[] = [
    {
      id: 'slot-1111-1111-1111-111111111111',
      userId: 'user-1',
      pageId: 'page-1',
      slotTime: '09:30',
      timezone: 'America/New_York',
      isActive: true,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: 'slot-2222-2222-2222-222222222222',
      userId: 'user-1',
      pageId: 'page-1',
      slotTime: '17:00',
      timezone: 'America/New_York',
      isActive: false,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
  ];

  const mockItems: QueueItem[] = [
    {
      id: 'queue-1111-1111-1111-111111111111',
      userId: 'user-1',
      pageId: 'page-1',
      slotId: 'slot-1111-1111-1111-111111111111',
      mediaId: 'media-1',
      scheduledTime: '2026-10-08T09:30:00Z',
      caption: 'Exciting brand launch reel! Check it out.',
      firstComment: 'Grab your 20% discount: https://example.com #deal',
      status: 'queued',
      retryCount: 0,
      maxRetries: 3,
      fbPostId: null,
      fbCommentId: null,
      publishedAt: null,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
      media: {
        name: 'promo_video.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
        url: 'https://cdn.example.com/promo_video.mp4',
        aspectRatio: '9:16',
        durationSeconds: 30,
      },
    },
    {
      id: 'queue-2222-2222-2222-222222222222',
      userId: 'user-1',
      pageId: 'page-1',
      slotId: null,
      mediaId: 'media-2',
      scheduledTime: '2026-10-08T17:00:00Z',
      caption: 'Product showcase photo',
      firstComment: null,
      status: 'published',
      retryCount: 0,
      maxRetries: 3,
      fbPostId: 'fb_post_99999',
      fbCommentId: null,
      publishedAt: '2026-10-08T17:00:05Z',
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-08T17:00:05Z',
      media: {
        name: 'product_photo.jpg',
        mediaType: 'image',
        thumbnailUrl: 'https://cdn.example.com/photo.jpg',
        url: 'https://cdn.example.com/photo.jpg',
        aspectRatio: '1:1',
        durationSeconds: null,
      },
    },
  ];

  const mockLogs: PublishLog[] = [
    {
      id: 'log-1111-1111-1111-111111111111',
      userId: 'user-1',
      queueItemId: 'queue-2222-2222-2222-222222222222',
      pageId: 'page-1',
      status: 'success',
      attemptNumber: 1,
      fbResponseCode: 200,
      errorMessage: null,
      errorDetails: null,
      tokensDeducted: 1,
      createdAt: '2026-10-08T17:00:05Z',
    },
    {
      id: 'log-2222-2222-2222-222222222222',
      userId: 'user-1',
      queueItemId: 'queue-3333-3333-3333-333333333333',
      pageId: 'page-1',
      status: 'failure',
      attemptNumber: 3,
      fbResponseCode: 190,
      errorMessage: 'Facebook Page token expired (OAuth code 190)',
      errorDetails: { error: 'OAuthException' },
      tokensDeducted: 0,
      createdAt: '2026-10-08T18:00:00Z',
    },
  ];

  const mockPages: FacebookPageView[] = [
    {
      id: 'page-1',
      facebookAccountId: 'acc-1',
      accountDisplayName: 'Marketing Admin',
      fbPageId: '10001',
      pageName: 'Acme Official Store',
      category: 'E-commerce',
      followersCount: 5000,
      status: 'active',
      tasks: ['MANAGE', 'CREATE_CONTENT'],
      createdAt: new Date('2026-10-07T00:00:00Z'),
      updatedAt: new Date('2026-10-07T00:00:00Z'),
    },
  ];

  const mockMediaItems: MediaItemResponse[] = [
    {
      id: 'media-1',
      userId: 'user-1',
      folderId: null,
      name: 'promo_video.mp4',
      storageKey: 'uploads/promo.mp4',
      url: 'https://cdn.example.com/promo_video.mp4',
      thumbnailKey: null,
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      mediaType: 'video',
      mimeType: 'video/mp4',
      fileSize: 10485760,
      aspectRatio: '9:16',
      durationSeconds: 30,
      tags: ['promo'],
      captionTemplateId: null,
      captionText: null,
      createdAt: '2026-10-07T00:00:00Z',
      updatedAt: '2026-10-07T00:00:00Z',
    },
  ];

  const mockCaptionTemplates: CaptionTemplateResponse[] = [
    {
      id: 'cap-1',
      userId: 'user-1',
      title: 'Spring Discount',
      content: 'Grab 20% off all spring items! #spring #deals',
      tags: ['deals'],
      createdAt: '2026-10-07T00:00:00Z',
      updatedAt: '2026-10-07T00:00:00Z',
    },
  ];

  describe('T139: SlotsManager Component (#214)', () => {
    it('renders empty slots message when no slots configured', () => {
      const html = renderToString(
        <SlotsManager
          pageId="page-1"
          pageName="Acme Official Store"
          slots={[]}
          onAddSlot={vi.fn()}
          onToggleSlot={vi.fn()}
          onDeleteSlot={vi.fn()}
        />
      );

      expect(html).toContain('Recurring Publishing Slots');
      expect(html).toContain('No recurring publishing slots configured');
      expect(html).toContain('+ Add Slot');
    });

    it('renders list of slots with active badges, times, and timezone', () => {
      const html = renderToString(
        <SlotsManager
          pageId="page-1"
          pageName="Acme Official Store"
          slots={mockSlots}
          onAddSlot={vi.fn()}
          onToggleSlot={vi.fn()}
          onDeleteSlot={vi.fn()}
        />
      );

      expect(html).toContain('09:30');
      expect(html).toContain('17:00');
      expect(html).toContain('America/New_York');
      expect(html).toContain('Active');
      expect(html).toContain('Paused');
      expect(html).toContain('Delete');
    });
  });

  describe('T140: QueueTimeline Component (#215)', () => {
    it('renders empty state when no items in queue', () => {
      const html = renderToString(
        <QueueTimeline
          items={[]}
          onPublishNow={vi.fn()}
          onSkip={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(html).toContain('Publishing Schedule');
      expect(html).toContain('No scheduled items in the queue');
    });

    it('renders upcoming item card with media thumbnail, caption, first comment, and action buttons', () => {
      const html = renderToString(
        <QueueTimeline
          items={mockItems}
          onPublishNow={vi.fn()}
          onSkip={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(html).toContain('promo_video.mp4');
      expect(html).toContain('Exciting brand launch reel!');
      expect(html).toContain('Grab your 20% discount');
      expect(html).toContain('Publish Now');
      expect(html).toContain('Skip');
      expect(html).toContain('Delete');
      expect(html).toContain('Queued');
      expect(html).toContain('Published');
    });
  });

  describe('T141: EnqueueModal Component (#216)', () => {
    it('returns empty string when isOpen is false', () => {
      const html = renderToString(
        <EnqueueModal
          isOpen={false}
          onClose={vi.fn()}
          pages={mockPages}
          mediaItems={mockMediaItems}
          captionTemplates={mockCaptionTemplates}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toBe('');
    });

    it('renders modal dialog with page selector, media picker, caption, and token notice when open', () => {
      const html = renderToString(
        <EnqueueModal
          isOpen={true}
          onClose={vi.fn()}
          pages={mockPages}
          mediaItems={mockMediaItems}
          captionTemplates={mockCaptionTemplates}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('Enqueue Media for Publishing');
      expect(html).toContain('Target Facebook Page');
      expect(html).toContain('Acme Official Store');
      expect(html).toContain('Select Media Asset');
      expect(html).toContain('promo_video.mp4');
      expect(html).toContain('Post Caption');
      expect(html).toContain('Insert Saved Template');
      expect(html).toContain('Spring Discount');
      expect(html).toContain('Automated First Comment');
      expect(html).toContain('1 token will be deducted');
      expect(html).toContain('Enqueue Asset');
    });
  });

  describe('T142: PublishLogsTable Component (#217)', () => {
    it('renders empty logs message when no audit logs exist', () => {
      const html = renderToString(
        <PublishLogsTable logs={[]} />
      );

      expect(html).toContain('Publish Audit Logs');
      expect(html).toContain('No publish execution logs recorded yet');
    });

    it('renders logs table with status, tokens deducted, timestamp, and error details', () => {
      const html = renderToString(
        <PublishLogsTable logs={mockLogs} />
      );

      expect(html).toContain('Success');
      expect(html).toContain('Failure');
      expect(html).toContain('1 Token');
      expect(html).toContain('0 Tokens');
      expect(html).toContain('Facebook Page token expired');
      expect(html).toContain('OAuth code 190');
    });
  });

  describe('T143: Publishing Dashboard Page (#218)', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/publishing/queue')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockItems, total: 2 }),
          });
        }
        if (url.includes('/publishing/logs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ logs: mockLogs, total: 2 }),
          });
        }
        if (url.includes('/slots')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ slots: mockSlots, total: 2 }),
          });
        }
        if (url.includes('/pages')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pages: mockPages }),
          });
        }
        if (url.includes('/media/captions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCaptionTemplates),
          });
        }
        if (url.includes('/media')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockMediaItems, total: 1 }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });
    });

    it('renders full Publishing page header, tab controls, and enqueue button', () => {
      const pageJsx = React.createElement(TenantPublishingPage, {
        params: { subdomain: 'testco' },
      });

      const html = renderToString(pageJsx);
      expect(html).toContain('Publishing Engine');
      expect(html).toContain('+ Enqueue Asset');
      expect(html).toContain('Upcoming Queue');
      expect(html).toContain('Recurring Slots');
      expect(html).toContain('Publish Logs');
    });
  });

  describe('Tenant Layout Navigation Link', () => {
    it('renders navigation link to Publishing alongside Media Library and Facebook Channels', async () => {
      const layoutJsx = await TenantLayout({
        params: Promise.resolve({ subdomain: 'testco' }),
        children: <div>Child Content</div>,
      });

      const html = renderToString(layoutJsx);
      expect(html).toContain('Media Library');
      expect(html).toContain('Facebook Channels');
      expect(html).toContain('Publishing');
      expect(html).toContain('/tenant/testco/publishing');
    });
  });
});
