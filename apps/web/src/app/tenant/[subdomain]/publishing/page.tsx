'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import type {
  FacebookPageView,
  PageQueueSlot,
  QueueItem,
  PublishLog,
  MediaItemResponse,
  CaptionTemplateResponse,
} from '@fbuploadpro/contracts';
import { SlotsManager } from '../../../../components/publishing/slots-manager';
import { QueueTimeline } from '../../../../components/publishing/queue-timeline';
import { EnqueueModal } from '../../../../components/publishing/enqueue-modal';
import { PublishLogsTable } from '../../../../components/publishing/publish-logs-table';

interface PublishingPageProps {
  params: { subdomain: string } | Promise<{ subdomain: string }>;
}

export default function TenantPublishingPage({ params }: PublishingPageProps) {
  const resolvedParams =
    params && typeof (params as any).then === 'function'
      ? use(params as Promise<{ subdomain: string }>)
      : (params as { subdomain: string });
  const subdomain = resolvedParams?.subdomain || 'default';

  // State
  const [pages, setPages] = useState<FacebookPageView[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [slots, setSlots] = useState<PageQueueSlot[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [publishLogs, setPublishLogs] = useState<PublishLog[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItemResponse[]>([]);
  const [captionTemplates, setCaptionTemplates] = useState<CaptionTemplateResponse[]>([]);

  const [activeTab, setActiveTab] = useState<'queue' | 'slots' | 'logs'>('queue');
  const [isEnqueueOpen, setIsEnqueueOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Facebook Pages
  const loadPages = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/pages`);
      if (res.ok) {
        const data = await res.json();
        const pageList: FacebookPageView[] = data.pages || [];
        setPages(pageList);
        if (pageList.length > 0 && !selectedPageId) {
          setSelectedPageId(pageList[0].id);
        }
      }
    } catch (_e) {
      // Graceful fallback
    }
  }, [subdomain, selectedPageId]);

  // Fetch Media Items & Captions for Enqueue Picker
  const loadMediaAndTemplates = useCallback(async () => {
    try {
      const [mediaRes, capRes] = await Promise.all([
        fetch(`/api/tenant/${subdomain}/media`),
        fetch(`/api/tenant/${subdomain}/media/captions`),
      ]);

      if (mediaRes.ok) {
        const data = await mediaRes.json();
        setMediaItems(data.items || []);
      }
      if (capRes.ok) {
        const data = await capRes.json();
        setCaptionTemplates(Array.isArray(data) ? data : data.templates || []);
      }
    } catch (_e) {
      // Graceful fallback
    }
  }, [subdomain]);

  // Fetch Slots for Selected Page
  const loadSlots = useCallback(async (pageId: string) => {
    if (!pageId) {
      setSlots([]);
      return;
    }
    try {
      const res = await fetch(`/api/tenant/${subdomain}/pages/${pageId}/slots`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } catch (_e) {
      // Graceful fallback
    }
  }, [subdomain]);

  // Fetch Queue Items
  const loadQueue = useCallback(async (pageId?: string) => {
    try {
      const url = pageId
        ? `/api/tenant/${subdomain}/publishing/queue?pageId=${pageId}`
        : `/api/tenant/${subdomain}/publishing/queue`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items || []);
      }
    } catch (_e) {
      // Graceful fallback
    }
  }, [subdomain]);

  // Fetch Publish Logs
  const loadLogs = useCallback(async (pageId?: string) => {
    try {
      const url = pageId
        ? `/api/tenant/${subdomain}/publishing/logs?pageId=${pageId}`
        : `/api/tenant/${subdomain}/publishing/logs`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPublishLogs(data.logs || []);
      }
    } catch (_e) {
      // Graceful fallback
    }
  }, [subdomain]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadPages(), loadMediaAndTemplates(), loadQueue(), loadLogs()])
      .finally(() => setIsLoading(false));
  }, [loadPages, loadMediaAndTemplates, loadQueue, loadLogs]);

  // When selectedPageId changes, reload page slots and data
  useEffect(() => {
    if (selectedPageId) {
      loadSlots(selectedPageId);
    }
  }, [selectedPageId, loadSlots]);

  // Actions
  const handleEnqueue = async (payload: {
    pageId: string;
    mediaId: string;
    caption: string;
    firstComment?: string | undefined;
    scheduledTime?: string | undefined;
  }) => {
    const res = await fetch(`/api/tenant/${subdomain}/publishing/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to enqueue asset.');
    }

    await loadQueue(selectedPageId || undefined);
  };

  const handlePublishNow = async (itemId: string) => {
    const res = await fetch(
      `/api/tenant/${subdomain}/publishing/queue/${itemId}/publish-now`,
      { method: 'POST' }
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      alert(errData.message || 'Failed to trigger immediate publish.');
    } else {
      await loadQueue(selectedPageId || undefined);
    }
  };

  const handleSkip = async (itemId: string) => {
    const res = await fetch(
      `/api/tenant/${subdomain}/publishing/queue/${itemId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped' }),
      }
    );
    if (!res.ok) {
      alert('Failed to skip queue item.');
    } else {
      await loadQueue(selectedPageId || undefined);
    }
  };

  const handleDeleteQueueItem = async (itemId: string) => {
    const res = await fetch(
      `/api/tenant/${subdomain}/publishing/queue/${itemId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      alert('Failed to delete queue item.');
    } else {
      await loadQueue(selectedPageId || undefined);
    }
  };

  const handleAddSlot = async (slotTime: string, timezone: string) => {
    if (!selectedPageId) {
      throw new Error('Please select a Facebook Page first.');
    }
    const res = await fetch(
      `/api/tenant/${subdomain}/pages/${selectedPageId}/slots`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotTime, timezone }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to add queue slot.');
    }
    await loadSlots(selectedPageId);
  };

  const handleToggleSlot = async (slotId: string, isActive: boolean) => {
    if (!selectedPageId) return;
    const res = await fetch(
      `/api/tenant/${subdomain}/pages/${selectedPageId}/slots/${slotId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      }
    );
    if (!res.ok) {
      alert('Failed to update slot.');
    } else {
      await loadSlots(selectedPageId);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!selectedPageId) return;
    const res = await fetch(
      `/api/tenant/${subdomain}/pages/${selectedPageId}/slots/${slotId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      alert('Failed to delete slot.');
    } else {
      await loadSlots(selectedPageId);
    }
  };

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Counters
  const queuedCount = queueItems.filter((i) => i.status === 'queued').length;
  const publishedCount = queueItems.filter((i) => i.status === 'published').length;
  const failedCount = queueItems.filter((i) => i.status === 'failed').length;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#202124', fontWeight: 700 }}>
            Publishing Engine & Dispatcher
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#5f6368' }}>
            Automated recurring queue slots, schedule visualizer, and Facebook Graph API dispatch audit.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {pages.length > 0 && (
            <select
              value={selectedPageId}
              onChange={(e) => {
                setSelectedPageId(e.target.value);
                loadQueue(e.target.value);
                loadLogs(e.target.value);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #dadce0',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
                fontWeight: 500,
              }}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pageName}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsEnqueueOpen(true)}
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: '#1877f2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            + Enqueue Asset
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #dadce0',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#5f6368', fontWeight: 600 }}>Queued Upcoming</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a73e8', marginTop: '0.25rem' }}>
            {queuedCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #dadce0',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#5f6368', fontWeight: 600 }}>Active Slots</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#202124', marginTop: '0.25rem' }}>
            {slots.filter((s) => s.isActive).length}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #dadce0',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#5f6368', fontWeight: 600 }}>Successfully Published</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#137333', marginTop: '0.25rem' }}>
            {publishedCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #dadce0',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#5f6368', fontWeight: 600 }}>Failures / Retries</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: failedCount > 0 ? '#d93025' : '#80868b', marginTop: '0.25rem' }}>
            {failedCount}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#fce8e6',
            color: '#c5221f',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #dadce0',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'queue' ? '3px solid #1877f2' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'queue' ? '#1877f2' : '#5f6368',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'queue' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          Upcoming Queue
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('slots')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'slots' ? '3px solid #1877f2' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'slots' ? '#1877f2' : '#5f6368',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'slots' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          Recurring Slots
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'logs' ? '3px solid #1877f2' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'logs' ? '#1877f2' : '#5f6368',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'logs' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          Publish Logs
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'queue' && (
        <QueueTimeline
          items={queueItems}
          onPublishNow={handlePublishNow}
          onSkip={handleSkip}
          onDelete={handleDeleteQueueItem}
        />
      )}

      {activeTab === 'slots' && (
        <SlotsManager
          pageId={selectedPageId}
          pageName={selectedPage?.pageName}
          slots={slots}
          onAddSlot={handleAddSlot}
          onToggleSlot={handleToggleSlot}
          onDeleteSlot={handleDeleteSlot}
        />
      )}

      {activeTab === 'logs' && (
        <PublishLogsTable logs={publishLogs} isLoading={isLoading} />
      )}

      {/* Enqueue Modal */}
      <EnqueueModal
        isOpen={isEnqueueOpen}
        onClose={() => setIsEnqueueOpen(false)}
        pages={pages}
        mediaItems={mediaItems}
        captionTemplates={captionTemplates}
        selectedPageId={selectedPageId}
        onSubmit={handleEnqueue}
      />
    </div>
  );
}
