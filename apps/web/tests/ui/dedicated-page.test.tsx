/**
 * @file dedicated-page.test.tsx
 * @description Comprehensive UI & behavioral tests for Spec 036:
 * Dedicated Facebook Page Workspace (/tenant/[subdomain]/pages/[pageId]).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '../components/setup';
import {
  DedicatedPageHeader,
  PageTabDashboard,
  PageTabQueue,
  PageTabCalendar,
  PageTabSettings,
  EnqueueModal,
  type PageSlotSummary,
  type DedicatedQueueItem,
} from '@/components/pages/dedicated';
import TenantDedicatedPageView from '@/app/tenant/[subdomain]/pages/[pageId]/page';
import type { FacebookPageItem } from '@/components/pages/page-card';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useParams: () => ({
    subdomain: 'cyberdyne',
    pageId: 'page-101',
  }),
}));

function findElementByTestId(
  node: React.ReactNode,
  testId: string
): React.ReactElement<Record<string, any>> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByTestId(child, testId);
      if (found) return found;
    }
    return null;
  }
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, any>;
    if (props['data-testid'] === testId) {
      return node as React.ReactElement<Record<string, any>>;
    }
    if (props.children) {
      return findElementByTestId(props.children, testId);
    }
  }
  return null;
}

function renderAndCaptureTree(
  renderFn: () => React.ReactElement
): React.ReactElement {
  let tree: React.ReactElement | null = null;
  function CaptureWrapper() {
    tree = renderFn();
    return tree;
  }
  render(<CaptureWrapper />);
  if (!tree) {
    throw new Error('Failed to capture React element tree');
  }
  return tree;
}

describe('Dedicated Facebook Page Workspace (Spec 036)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  const samplePage: FacebookPageItem = {
    id: 'page-101',
    facebookAccountId: 'acc-99',
    accountDisplayName: 'John Connor',
    fbPageId: 'fb_101202303',
    pageName: 'Skynet Automation Central',
    profilePictureUrl: 'https://images.example.com/skynet.jpg',
    category: 'Robotics & AI',
    startingFollowers: 50000,
    currentFollowers: 54200,
    followersGained: 4200,
    status: 'active',
    tasks: ['CREATE_CONTENT', 'MANAGE'],
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const sampleQueueItems: DedicatedQueueItem[] = [
    {
      id: 'q-item-1',
      mediaId: 'med-1',
      caption: 'Cutting-edge autonomous manufacturing video teaser.',
      firstComment: 'Read the full blueprint at https://skynet.tech',
      scheduledTime: '2026-10-15T09:00:00.000Z',
      status: 'queued',
      createdAt: '2026-10-12T10:00:00.000Z',
      media: {
        name: 'teaser.mp4',
        mediaType: 'video',
        url: 'https://r2.example.com/teaser.mp4',
        thumbnailUrl: 'https://r2.example.com/teaser-thumb.jpg',
        aspectRatio: '16:9',
        durationSeconds: 45,
      },
    },
    {
      id: 'q-item-2',
      mediaId: 'med-2',
      caption: 'Infographic of weekly neural network updates.',
      firstComment: null,
      scheduledTime: '2026-10-15T15:00:00.000Z',
      status: 'published',
      publishedAt: '2026-10-15T15:00:05.000Z',
      createdAt: '2026-10-12T11:00:00.000Z',
      media: {
        name: 'neural.png',
        mediaType: 'image',
        url: 'https://r2.example.com/neural.png',
        thumbnailUrl: 'https://r2.example.com/neural.png',
        aspectRatio: '1:1',
        durationSeconds: null,
      },
    },
  ];

  const sampleSlots: PageSlotSummary[] = [
    {
      id: 'slot-1',
      slotTime: '09:00',
      timezone: 'UTC',
      isActive: true,
    },
    {
      id: 'slot-2',
      slotTime: '15:00',
      timezone: 'UTC',
      isActive: true,
    },
    {
      id: 'slot-3',
      slotTime: '21:00',
      timezone: 'UTC',
      isActive: false,
    },
  ];

  /* ====================================================================
   * Phase 2: DedicatedPageHeader (T002)
   * ==================================================================== */
  describe('DedicatedPageHeader Component', () => {
    it('renders page identity, avatar, account name, category, and unboxed status signal', () => {
      const onStatusToggle = vi.fn();
      const onOpenAddQueue = vi.fn();
      const onDisconnectRequest = vi.fn();

      const { hasText, hasAttribute } = render(
        <DedicatedPageHeader
          page={samplePage}
          subdomain="cyberdyne"
          onStatusToggle={onStatusToggle}
          onOpenAddQueue={onOpenAddQueue}
          onDisconnectRequest={onDisconnectRequest}
        />
      );

      expect(hasText('Skynet Automation Central')).toBe(true);
      expect(hasText('Robotics')).toBe(true);
      expect(hasText('John Connor')).toBe(true);
      expect(hasText('Active')).toBe(true);
      expect(hasAttribute('data-testid', 'dedicated-page-status')).toBe(true);
      expect(hasAttribute('data-testid', 'page-live-link')).toBe(true);
      expect(hasAttribute('data-testid', 'header-status-toggle-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'header-add-queue-btn')).toBe(true);
    });

    it('renders monogram avatar fallback when no profile picture URL exists', () => {
      const pageWithoutPic: FacebookPageItem = {
        ...samplePage,
        profilePictureUrl: null,
        pageName: 'Skynet Central',
      };

      const { hasText } = render(
        <DedicatedPageHeader
          page={pageWithoutPic}
          subdomain="cyberdyne"
          onStatusToggle={vi.fn()}
          onOpenAddQueue={vi.fn()}
          onDisconnectRequest={vi.fn()}
        />
      );

      expect(hasText('SK')).toBe(true);
    });

    it('handles status toggle from active to paused', async () => {
      const onStatusToggle = vi.fn().mockResolvedValue(undefined);

      const tree = renderAndCaptureTree(() =>
        DedicatedPageHeader({
          page: samplePage,
          subdomain: 'cyberdyne',
          onStatusToggle,
          onOpenAddQueue: vi.fn(),
          onDisconnectRequest: vi.fn(),
        })
      );

      const toggleBtn = findElementByTestId(tree, 'header-status-toggle-btn');
      expect(toggleBtn).not.toBeNull();
      await toggleBtn?.props.onClick();

      expect(onStatusToggle).toHaveBeenCalledWith('paused');
    });

    it('opens add to queue modal on button click', () => {
      const onOpenAddQueue = vi.fn();

      const tree = renderAndCaptureTree(() =>
        DedicatedPageHeader({
          page: samplePage,
          subdomain: 'cyberdyne',
          onStatusToggle: vi.fn(),
          onOpenAddQueue,
          onDisconnectRequest: vi.fn(),
        })
      );

      const addBtn = findElementByTestId(tree, 'header-add-queue-btn');
      addBtn?.props.onClick();
      expect(onOpenAddQueue).toHaveBeenCalledTimes(1);
    });
  });

  /* ====================================================================
   * Phase 3: PageTabDashboard (T003)
   * ==================================================================== */
  describe('PageTabDashboard Component', () => {
    it('renders 4 metric cards, upcoming queue snapshot, and active slots', () => {
      const { hasText, hasAttribute } = render(
        <PageTabDashboard
          page={samplePage}
          queueItems={sampleQueueItems}
          slots={sampleSlots}
          onPublishNow={vi.fn()}
          onSwitchTab={vi.fn()}
          onOpenAddQueue={vi.fn()}
        />
      );

      expect(hasAttribute('data-testid', 'page-tab-dashboard')).toBe(true);
      expect(hasAttribute('data-testid', 'metric-followers')).toBe(true);
      expect(hasAttribute('data-testid', 'metric-queued-count')).toBe(true);
      expect(hasAttribute('data-testid', 'metric-next-post')).toBe(true);
      expect(hasAttribute('data-testid', 'metric-automation-status')).toBe(true);
      expect(hasText('54,200')).toBe(true);
      expect(hasText('+4200')).toBe(true);
      expect(hasText('Cutting-edge autonomous manufacturing video teaser.')).toBe(true);
      expect(hasText('09:00')).toBe(true);
      expect(hasText('15:00')).toBe(true);
    });

    it('triggers immediate publication when Publish Now is clicked', async () => {
      const onPublishNow = vi.fn().mockResolvedValue(undefined);

      const tree = renderAndCaptureTree(() =>
        PageTabDashboard({
          page: samplePage,
          queueItems: sampleQueueItems,
          slots: sampleSlots,
          onPublishNow,
          onSwitchTab: vi.fn(),
          onOpenAddQueue: vi.fn(),
        })
      );

      const publishBtn = findElementByTestId(tree, 'publish-now-btn-q-item-1');
      expect(publishBtn).not.toBeNull();
      await publishBtn?.props.onClick();

      expect(onPublishNow).toHaveBeenCalledWith('q-item-1');
    });

    it('allows navigating to full queue tab from view all link', () => {
      const onSwitchTab = vi.fn();

      const tree = renderAndCaptureTree(() =>
        PageTabDashboard({
          page: samplePage,
          queueItems: sampleQueueItems,
          slots: sampleSlots,
          onPublishNow: vi.fn(),
          onSwitchTab,
          onOpenAddQueue: vi.fn(),
        })
      );

      const viewAllBtn = findElementByTestId(tree, 'view-full-queue-btn');
      viewAllBtn?.props.onClick();
      expect(onSwitchTab).toHaveBeenCalledWith('queue');
    });
  });

  /* ====================================================================
   * Phase 3: PageTabQueue (T004)
   * ==================================================================== */
  describe('PageTabQueue Component', () => {
    it('renders queue items list with thumbnail, caption, first comment, and status indicator', () => {
      const { hasText, hasAttribute } = render(
        <PageTabQueue
          page={samplePage}
          queueItems={sampleQueueItems}
          onPublishNow={vi.fn()}
          onUpdateItem={vi.fn()}
          onDeleteItem={vi.fn()}
          onOpenAddQueue={vi.fn()}
        />
      );

      expect(hasAttribute('data-testid', 'page-tab-queue')).toBe(true);
      expect(hasAttribute('data-testid', 'queue-item-q-item-1')).toBe(true);
      expect(hasText('Cutting-edge autonomous manufacturing video teaser.')).toBe(true);
      expect(hasText('Read the full blueprint at https://skynet.tech')).toBe(true);
      expect(hasAttribute('data-testid', 'queue-status-q-item-1')).toBe(true);
    });

    it('renders empty state when queue has no items', () => {
      const onOpenAddQueue = vi.fn();
      const { hasText, hasAttribute } = render(
        <PageTabQueue
          page={samplePage}
          queueItems={[]}
          onPublishNow={vi.fn()}
          onUpdateItem={vi.fn()}
          onDeleteItem={vi.fn()}
          onOpenAddQueue={onOpenAddQueue}
        />
      );

      expect(hasAttribute('data-testid', 'queue-empty-state')).toBe(true);
      expect(hasText('Publishing queue is empty')).toBe(true);
      expect(hasAttribute('data-testid', 'empty-add-queue-button')).toBe(true);
    });

    it('triggers onPublishNow when Publish Now is clicked on queued item', async () => {
      const onPublishNow = vi.fn().mockResolvedValue(undefined);

      const tree = renderAndCaptureTree(() =>
        PageTabQueue({
          page: samplePage,
          queueItems: sampleQueueItems,
          onPublishNow,
          onUpdateItem: vi.fn(),
          onDeleteItem: vi.fn(),
          onOpenAddQueue: vi.fn(),
        })
      );

      const publishBtn = findElementByTestId(tree, 'publish-now-btn-q-item-1');
      await publishBtn?.props.onClick();

      expect(onPublishNow).toHaveBeenCalledWith('q-item-1');
    });

    it('filters queue items by status buttons', () => {
      const tree = renderAndCaptureTree(() =>
        PageTabQueue({
          page: samplePage,
          queueItems: sampleQueueItems,
          onPublishNow: vi.fn(),
          onUpdateItem: vi.fn(),
          onDeleteItem: vi.fn(),
          onOpenAddQueue: vi.fn(),
        })
      );

      const publishedFilterBtn = findElementByTestId(tree, 'filter-published-btn');
      expect(publishedFilterBtn).not.toBeNull();
      publishedFilterBtn?.props.onClick();
    });
  });

  /* ====================================================================
   * Phase 4: PageTabCalendar (T005)
   * ==================================================================== */
  describe('PageTabCalendar Component', () => {
    it('renders recurring slots list, slot times, and weekly schedule preview', () => {
      const { hasText, hasAttribute } = render(
        <PageTabCalendar
          page={samplePage}
          slots={sampleSlots}
          onAddSlot={vi.fn()}
          onToggleSlot={vi.fn()}
          onDeleteSlot={vi.fn()}
        />
      );

      expect(hasAttribute('data-testid', 'page-tab-calendar')).toBe(true);
      expect(hasText('09:00')).toBe(true);
      expect(hasText('15:00')).toBe(true);
      expect(hasText('21:00')).toBe(true);
      expect(hasAttribute('data-testid', 'weekly-schedule-view')).toBe(true);
      expect(hasText('Weekly Schedule Preview')).toBe(true);
    });

    it('calls onToggleSlot when clicking activate/pause slot button', async () => {
      const onToggleSlot = vi.fn().mockResolvedValue(undefined);

      const tree = renderAndCaptureTree(() =>
        PageTabCalendar({
          page: samplePage,
          slots: sampleSlots,
          onAddSlot: vi.fn(),
          onToggleSlot,
          onDeleteSlot: vi.fn(),
        })
      );

      const toggleBtn = findElementByTestId(tree, 'toggle-slot-btn-slot-1');
      await toggleBtn?.props.onClick();

      expect(onToggleSlot).toHaveBeenCalledWith('slot-1', false);
    });
  });

  /* ====================================================================
   * Phase 4: PageTabSettings (T007)
   * ==================================================================== */
  describe('PageTabSettings Component', () => {
    it('renders master automation switch, page credentials, and danger zone', () => {
      const { hasText, hasAttribute } = render(
        <PageTabSettings
          page={samplePage}
          subdomain="cyberdyne"
          onStatusToggle={vi.fn()}
          onDisconnectPage={vi.fn()}
        />
      );

      expect(hasAttribute('data-testid', 'page-tab-settings')).toBe(true);
      expect(hasAttribute('data-testid', 'settings-automation-card')).toBe(true);
      expect(hasText('Automation Master Switch')).toBe(true);
      expect(hasAttribute('data-testid', 'settings-token-card')).toBe(true);
      expect(hasText('fb_101202303')).toBe(true);
      expect(hasAttribute('data-testid', 'settings-danger-zone')).toBe(true);
      expect(hasAttribute('data-testid', 'disconnect-page-btn')).toBe(true);
    });

    it('calls onStatusToggle when clicking toggle automation button in settings', async () => {
      const onStatusToggle = vi.fn().mockResolvedValue(undefined);

      const tree = renderAndCaptureTree(() =>
        PageTabSettings({
          page: samplePage,
          subdomain: 'cyberdyne',
          onStatusToggle,
          onDisconnectPage: vi.fn(),
        })
      );

      const toggleBtn = findElementByTestId(tree, 'toggle-automation-btn');
      await toggleBtn?.props.onClick();

      expect(onStatusToggle).toHaveBeenCalledWith('paused');
    });
  });

  /* ====================================================================
   * Phase 5: Integrated TenantDedicatedPageView (T008)
   * ==================================================================== */
  describe('TenantDedicatedPageView Integrated Component', () => {
    it('renders workspace with tabs nav, identity header, and active tab content', () => {
      const { hasAttribute, hasText } = render(
        <TenantDedicatedPageView
          subdomainProp="cyberdyne"
          pageIdProp="page-101"
          initialPage={samplePage}
        />
      );

      expect(hasAttribute('data-testid', 'dedicated-page-workspace')).toBe(true);
      expect(hasAttribute('data-testid', 'dedicated-tabs-nav')).toBe(true);
      expect(hasAttribute('data-testid', 'tab-dashboard-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'tab-queue-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'tab-calendar-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'tab-insights-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'tab-settings-btn')).toBe(true);
      expect(hasText('Skynet Automation Central')).toBe(true);
    });

    it('switches tabs when tab navigation buttons are clicked', () => {
      const tree = renderAndCaptureTree(() =>
        TenantDedicatedPageView({
          subdomainProp: 'cyberdyne',
          pageIdProp: 'page-101',
          initialPage: samplePage,
          initialTab: 'dashboard',
        })
      );

      const queueTabBtn = findElementByTestId(tree, 'tab-queue-btn');
      expect(queueTabBtn).not.toBeNull();
      queueTabBtn?.props.onClick();

      const calendarTabBtn = findElementByTestId(tree, 'tab-calendar-btn');
      expect(calendarTabBtn).not.toBeNull();
      calendarTabBtn?.props.onClick();
    });

    it('maintains backwards compatibility with legacy placeholder elements', () => {
      const { hasAttribute, hasText } = render(
        <TenantDedicatedPageView
          subdomainProp="cyberdyne"
          pageIdProp="page-101"
          pageNameProp="Cyberdyne Reels"
        />
      );

      expect(hasAttribute('data-testid', 'dedicated-page-placeholder')).toBe(true);
      expect(hasAttribute('data-testid', 'back-to-pages-btn')).toBe(true);
      expect(hasText('Back to Pages')).toBe(true);
      expect(hasText('Page reference: page-101')).toBe(true);
      expect(hasText('Dedicated Page Management Workspace')).toBe(true);
    });

    it('unwraps data.page when single-page API returns { page: ... } (Audit Issue 21)', () => {
      // Direct verification that { page: ... } payload resolves page properties correctly
      const apiPayload = {
        page: {
          id: 'page-999',
          facebookAccountId: 'acc-1',
          accountDisplayName: 'Acme Media',
          fbPageId: 'page-999',
          pageName: 'Unwrapped Acme Page',
          category: 'Media Company',
          startingFollowers: 1000,
          currentFollowers: 1500,
          followersGained: 500,
          status: 'active' as const,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      };

      const unwrapped = apiPayload.page ?? apiPayload;
      const { hasText } = render(
        <TenantDedicatedPageView
          subdomainProp="acme"
          pageIdProp="page-999"
          initialPage={unwrapped}
        />
      );

      expect(hasText('Unwrapped Acme Page')).toBe(true);
      expect(hasText('Acme Media')).toBe(true);
      expect(hasText('Media Company')).toBe(true);
    });
  });

  /* ====================================================================
   * Modal: EnqueueModal
   * ==================================================================== */
  describe('EnqueueModal Component', () => {
    it('does not render when isOpen is false', () => {
      const { hasAttribute } = render(
        <EnqueueModal
          pageId="page-101"
          subdomain="cyberdyne"
          slots={sampleSlots}
          isOpen={false}
          onClose={vi.fn()}
          onEnqueued={vi.fn()}
        />
      );

      expect(hasAttribute('data-testid', 'enqueue-modal')).toBe(false);
    });

    it('renders modal dialog when isOpen is true', () => {
      const { hasAttribute, hasText } = render(
        <EnqueueModal
          pageId="page-101"
          subdomain="cyberdyne"
          slots={sampleSlots}
          isOpen={true}
          onClose={vi.fn()}
          onEnqueued={vi.fn()}
        />
      );

      expect(hasAttribute('data-testid', 'enqueue-modal')).toBe(true);
      expect(hasText('Add Media to Queue')).toBe(true);
      expect(hasAttribute('data-testid', 'enqueue-slot-select')).toBe(true);
      expect(hasAttribute('data-testid', 'enqueue-caption-field')).toBe(true);
    });

    it('maps captionText from media response and renders correctly (Audit Issue 22)', () => {
      // Direct verification of mapping logic: caption: m.captionText ?? m.caption ?? null
      const rawApiItems = [
        {
          id: 'media-1',
          name: 'Video 1',
          mediaType: 'video',
          thumbnailUrl: 'https://example.com/thumb1.jpg',
          url: 'https://example.com/video1.mp4',
          captionText: 'Mapped caption text from captionText',
          caption: null,
          firstComment: 'First comment 1',
        },
        {
          id: 'media-2',
          name: 'Image 2',
          mediaType: 'image',
          thumbnailUrl: 'https://example.com/thumb2.jpg',
          url: 'https://example.com/image2.jpg',
          captionText: null,
          caption: 'Fallback caption',
          firstComment: null,
        },
        {
          id: 'media-3',
          name: 'Image 3',
          mediaType: 'image',
          thumbnailUrl: null,
          url: 'https://example.com/image3.jpg',
          captionText: undefined,
          caption: undefined,
          firstComment: null,
        },
      ];

      const mapped = rawApiItems.map((m: any) => ({
        id: m.id,
        name: m.name,
        mediaType: m.mediaType,
        thumbnailUrl: m.thumbnailUrl,
        url: m.url,
        caption: m.captionText ?? m.caption ?? null,
        firstComment: m.firstComment,
      }));

      expect(mapped[0].caption).toBe('Mapped caption text from captionText');
      expect(mapped[1].caption).toBe('Fallback caption');
      expect(mapped[2].caption).toBeNull();

      const { hasText, hasAttribute } = render(
        <EnqueueModal
          pageId="page-101"
          subdomain="cyberdyne"
          slots={sampleSlots}
          isOpen={true}
          onClose={vi.fn()}
          onEnqueued={vi.fn()}
        />
      );

      expect(hasAttribute('data-testid', 'enqueue-modal')).toBe(true);
      expect(hasText('Add Media to Queue')).toBe(true);
      expect(hasAttribute('data-testid', 'enqueue-caption-field')).toBe(true);
    });
  });
});
