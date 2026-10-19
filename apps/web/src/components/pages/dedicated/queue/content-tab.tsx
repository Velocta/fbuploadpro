'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { THEME, PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PostComposer, type ComposerInitialPost } from '../composer/post-composer';
import { BulkAddModal } from '../bulk/bulk-add-modal';
import { formatSlotShort } from '../composer/queue-slot-utils';
import { formatLabel } from '../bulk/bulk-utils';
import type { PageSlotSummary } from '../tab-dashboard';
import { QueueSummaryHeader, queueHeaderRowStyle } from './queue-summary-header';
import { QueueFilterTabs } from './queue-filter-tabs';
import { QueueRow, type QueueRowBucket } from './queue-row';
import { QueueRescheduleDialog } from './queue-reschedule-dialog';
import { QueueFailedBanner } from './queue-failed-banner';
import { QueueEmptyStates } from './queue-empty-states';
import { QueueToasts, type QueueToast } from './queue-toasts';
import {
  resolveFormat,
  filterItems,
  countByFilter,
  sortForDisplay,
  planReorder,
  getFailedReason,
  computeRetryTime,
  isSlotBased,
} from './queue-logic';
import type { DedicatedQueueItem, PageTabQueueProps, QueueFilter } from './queue-types';

export type { DedicatedQueueItem, PageTabQueueProps } from './queue-types';

/** Undo window for single deletes. */
const UNDO_DURATION_MS = 8000;
/** Default toast lifetime. */
const TOAST_DURATION_MS = 4000;
/** M1: never hang on the skeleton — surface an error state after this long. */
const LOAD_TIMEOUT_MS = 15000;

function checklistKey(pageId: string): string {
  return `fbuploadpro:content-checklist-dismissed:${pageId}`;
}

function toInitialPost(item: DedicatedQueueItem): ComposerInitialPost {
  return {
    id: item.id,
    mediaId: item.mediaId ?? null,
    postFormat: resolveFormat(item),
    linkUrl: item.linkUrl ?? null,
    caption: item.caption ?? null,
    scheduledTime: item.scheduledTime,
    status: item.status,
    media: item.media
      ? {
          name: item.media.name,
          mediaType: item.media.mediaType,
          thumbnailUrl: item.media.thumbnailUrl ?? null,
          url: item.media.url,
          durationSeconds: item.media.durationSeconds ?? null,
        }
      : null,
  };
}

/** Normalizes the queue API's created-item shape into a DedicatedQueueItem. */
function mapCreatedItem(raw: unknown): DedicatedQueueItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.scheduledTime !== 'string') return null;
  const media =
    record.media && typeof record.media === 'object'
      ? (record.media as Record<string, unknown>)
      : null;
  const postFormat = record.postFormat as DedicatedQueueItem['postFormat'];
  return {
    id: record.id as string,
    mediaId: (record.mediaId as string | null | undefined) ?? null,
    ...(postFormat ? { postFormat } : {}),
    linkUrl: (record.linkUrl as string | null | undefined) ?? null,
    caption: (record.caption as string | null | undefined) ?? '',
    firstComment: (record.firstComment as string | null | undefined) ?? null,
    scheduledTime: record.scheduledTime as string,
    status: record.status as DedicatedQueueItem['status'],
    retryCount: Number(record.retryCount ?? 0),
    maxRetries: Number(record.maxRetries ?? 3),
    fbPostId: (record.fbPostId as string | null | undefined) ?? null,
    publishedAt: (record.publishedAt as string | null | undefined) ?? null,
    createdAt: (record.createdAt as string | undefined) ?? new Date().toISOString(),
    media: media
      ? {
          name: String(media.name ?? ''),
          mediaType: media.mediaType === 'video' ? 'video' : 'image',
          thumbnailUrl: (media.thumbnailUrl as string | null | undefined) ?? null,
          url: String(media.url ?? ''),
          aspectRatio: (media.aspectRatio as string | undefined) ?? 'unknown',
          durationSeconds:
            media.durationSeconds != null ? Number(media.durationSeconds) : null,
        }
      : null,
  };
}

/**
 * Content tab: queue summary, filter tabs, reorderable rows, reschedule,
 * failed-post recovery, and empty states. Owns its mutations against the
 * queue API with optimistic local state; the parent route's queueItems prop
 * is the initial source and resyncs on parent refetch.
 */
export function PageTabQueue(props: Readonly<PageTabQueueProps>) {
  // onPublishNow / onUpdateItem / onDeleteItem are retained in the props
  // contract for route compatibility; the tab performs its own API calls so
  // single deletes stay undoable and reorder/reschedule stay optimistic.
  const { page, queueItems, isLoading = false, onOpenAddQueue } = props;
  const params = useParams();
  const subdomain = (params.subdomain as string) || '';
  const pageId = page.id;

  const [items, setItems] = useState<DedicatedQueueItem[]>(queueItems);
  const [slots, setSlots] = useState<PageSlotSummary[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [connectionExpired, setConnectionExpired] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<DedicatedQueueItem | null>(null);
  const [editItem, setEditItem] = useState<DedicatedQueueItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toasts, setToasts] = useState<QueueToast[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<{ id: string; action: 'retry' | 'delete' } | null>(null);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(checklistKey(pageId)) === '1';
    } catch {
      return false;
    }
  });

  const toastSeq = useRef(0);
  const timeZone = page.timezone || slots.find((s) => s.timezone)?.timezone || 'UTC';

  // --- toasts ---------------------------------------------------------------
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (
      message: string,
      options?: {
        tone?: 'success' | 'error';
        action?: { label: string; onClick: () => void };
        duration?: number;
      }
    ) => {
      toastSeq.current += 1;
      const id = toastSeq.current;
      const toast: QueueToast = { id, message, tone: options?.tone ?? 'success' };
      if (options?.action) toast.action = options.action;
      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => dismissToast(id), options?.duration ?? TOAST_DURATION_MS);
    },
    [dismissToast]
  );

  // --- data -----------------------------------------------------------------
  useEffect(() => {
    setItems(queueItems);
  }, [queueItems]);

  const fetchSlots = useCallback(async () => {
    if (!subdomain || !pageId) return;
    try {
      const res = await fetch(`/api/tenant/${subdomain}/pages/${pageId}/slots`);
      if (res.ok) {
        const data = await res.json();
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      }
    } catch {
      // Non-blocking: slots-dependent actions degrade gracefully
    } finally {
      setSlotsLoaded(true);
    }
  }, [subdomain, pageId]);

  useEffect(() => {
    void fetchSlots();
  }, [fetchSlots]);

  const refreshItems = useCallback(async () => {
    if (!subdomain || !pageId) return;
    try {
      const res = await fetch(`/api/tenant/${subdomain}/publishing/queue?pageId=${pageId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) setItems(data.items);
      }
    } catch {
      // Non-blocking refresh
    }
  }, [subdomain, pageId]);

  // M1: never leave the tab on an infinite skeleton — surface a retryable
  // error state when loading takes too long. Posting slots load independently
  // and progressively enhance the list (filter counts, reorder validation).
  useEffect(() => {
    if (!isLoading) {
      setLoadTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadTimedOut(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  // Connection health gates failed-post retry (brief §10.2).
  const failedCount = useMemo(
    () => items.filter((item) => item.status === 'failed').length,
    [items]
  );

  useEffect(() => {
    if (failedCount === 0 || !subdomain) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/accounts`);
        if (!res.ok) return;
        const data = await res.json();
        const account = (data.accounts || []).find(
          (candidate: { id?: string }) => candidate.id === page.facebookAccountId
        );
        if (!cancelled) {
          setConnectionExpired(account ? account.status !== 'active' : false);
        }
      } catch {
        // Non-blocking: retry stays enabled when health is unknown
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [failedCount, subdomain, page.facebookAccountId]);

  // --- derived ---------------------------------------------------------------
  const counts = useMemo(
    () => countByFilter(items, slots, timeZone, slotsLoaded),
    [items, slots, timeZone, slotsLoaded]
  );
  const visibleItems = useMemo(
    () => sortForDisplay(filterItems(items, filter, slots, timeZone, slotsLoaded)),
    [items, filter, slots, timeZone, slotsLoaded]
  );
  const reorderableItems = useMemo(
    () =>
      sortForDisplay(
        items.filter((item) => item.status === 'queued' || item.status === 'publishing')
      ),
    [items]
  );

  const bucketFor = useCallback(
    (item: DedicatedQueueItem): QueueRowBucket => {
      if (item.status === 'failed') return 'failed';
      if (item.status === 'published') return 'published';
      if (!slotsLoaded) return 'queued';
      return isSlotBased(item, slots, timeZone) ? 'queued' : 'scheduled';
    },
    [slots, timeZone, slotsLoaded]
  );

  // --- server mutations -------------------------------------------------------
  const patchOnServer = useCallback(
    async (id: string, data: Record<string, unknown>): Promise<boolean> => {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/publishing/queue/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [subdomain]
  );

  const applyPatch = useCallback(
    async (id: string, data: Record<string, unknown>): Promise<boolean> => {
      const ok = await patchOnServer(id, data);
      if (ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, ...(data as Partial<DedicatedQueueItem>) } : item
          )
        );
      }
      return ok;
    },
    [patchOnServer]
  );

  // --- reorder ------------------------------------------------------------------
  const applyReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const plan = planReorder({
        ordered: reorderableItems,
        fromIndex,
        toIndex,
        slots,
        timeZone,
      });
      if ('blocked' in plan) {
        setBlockedMessage(plan.blocked);
        return;
      }
      if (plan.assignments.length === 0) return;
      const timesById = new Map(plan.assignments.map((a) => [a.id, a.scheduledTime]));
      setItems((prev) =>
        prev.map((item) =>
          timesById.has(item.id)
            ? { ...item, scheduledTime: timesById.get(item.id) as string }
            : item
        )
      );
      const results = await Promise.all(
        plan.assignments.map((assignment) =>
          patchOnServer(assignment.id, { scheduledTime: assignment.scheduledTime })
        )
      );
      if (results.some((ok) => !ok)) {
        pushToast("Couldn't save the new order.", { tone: 'error' });
        void refreshItems();
        return;
      }
      pushToast('Queue reordered — posting times updated.');
    },
    [reorderableItems, slots, timeZone, patchOnServer, pushToast, refreshItems]
  );

  const handleDropOnRow = useCallback(
    (targetId: string) => {
      const fromIndex = reorderableItems.findIndex((item) => item.id === dragId);
      const toIndex = reorderableItems.findIndex((item) => item.id === targetId);
      setDragId(null);
      setDragOverId(null);
      if (!dragId || fromIndex < 0 || toIndex < 0) return;
      void applyReorder(fromIndex, toIndex);
    },
    [dragId, reorderableItems, applyReorder]
  );

  const handleMove = useCallback(
    (id: string, direction: -1 | 1) => {
      const index = reorderableItems.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= reorderableItems.length) return;
      void applyReorder(index, target);
    },
    [reorderableItems, applyReorder]
  );

  // --- delete ---------------------------------------------------------------------
  /** Re-creates a deleted post from its snapshot (Undo). */
  const restoreDeletedItem = useCallback(
    async (snapshot: DedicatedQueueItem) => {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/publishing/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId,
            mediaId: snapshot.mediaId ?? null,
            postFormat: resolveFormat(snapshot),
            linkUrl: snapshot.linkUrl ?? null,
            scheduledTime: new Date(snapshot.scheduledTime).toISOString(),
            caption: snapshot.caption ?? '',
            firstComment: snapshot.firstComment ?? null,
          }),
        });
        if (!res.ok) {
          pushToast("Couldn't restore this post.", { tone: 'error' });
          return;
        }
        const created = mapCreatedItem(await res.json().catch(() => null));
        if (created) {
          setItems((prev) =>
            prev.some((candidate) => candidate.id === created.id) ? prev : [...prev, created]
          );
        } else {
          void refreshItems();
        }
        pushToast('Post restored.');
      } catch {
        pushToast("Couldn't restore this post.", { tone: 'error' });
      }
    },
    [subdomain, pageId, pushToast, refreshItems]
  );

  const handleDelete = useCallback(
    async (item: DedicatedQueueItem) => {
      setBusyRow({ id: item.id, action: 'delete' });
      let ok = false;
      try {
        const res = await fetch(`/api/tenant/${subdomain}/publishing/queue/${item.id}`, {
          method: 'DELETE',
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
      setBusyRow(null);
      if (!ok) {
        pushToast("Couldn't delete this post. Please try again.", { tone: 'error' });
        return;
      }
      setItems((prev) => prev.filter((candidate) => candidate.id !== item.id));
      setSelection((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      pushToast('Post deleted.', {
        duration: UNDO_DURATION_MS,
        action: { label: 'Undo', onClick: () => void restoreDeletedItem(item) },
      });
    },
    [subdomain, pushToast, restoreDeletedItem]
  );

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selection];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/publishing/queue/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) deleted += 1;
      } catch {
        // Counted as a failure below
      }
    }
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelecting(false);
    setSelection(new Set());
    if (deleted > 0) {
      const deletedIds = new Set(ids);
      setItems((prev) => prev.filter((item) => !deletedIds.has(item.id)));
    }
    if (deleted === ids.length) {
      pushToast(`${deleted} ${deleted === 1 ? 'post' : 'posts'} deleted.`);
    } else {
      pushToast(`Deleted ${deleted} of ${ids.length} posts.`, { tone: 'error' });
      void refreshItems();
    }
  }, [selection, subdomain, pushToast, refreshItems]);

  // --- retry ------------------------------------------------------------------------
  const handleRetry = useCallback(
    async (item: DedicatedQueueItem) => {
      if (connectionExpired) return;
      setBusyRow({ id: item.id, action: 'retry' });
      const retryTime = computeRetryTime(item, slots, timeZone);
      if (!retryTime) {
        setBusyRow(null);
        pushToast(`No posting time covers ${formatLabel(resolveFormat(item))}s yet.`, {
          tone: 'error',
        });
        return;
      }
      const ok = await applyPatch(item.id, {
        status: 'queued',
        scheduledTime: retryTime.toISOString(),
      });
      setBusyRow(null);
      if (!ok) {
        pushToast("Couldn't retry this post. Please try again.", { tone: 'error' });
        return;
      }
      pushToast(`Retrying ${formatSlotShort(retryTime, timeZone)}.`);
    },
    [connectionExpired, slots, timeZone, applyPatch, pushToast]
  );

  // --- selection ----------------------------------------------------------------------
  const toggleSelect = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // --- checklist -------------------------------------------------------------------------
  const dismissChecklist = useCallback(() => {
    try {
      window.localStorage.setItem(checklistKey(pageId), '1');
    } catch {
      // Dismissal still applies for this session
    }
    setChecklistDismissed(true);
  }, [pageId]);

  // --- render -----------------------------------------------------------------------------
  if (isLoading && !loadTimedOut) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }} aria-label="Loading posts">
        {[0, 1, 2].map((index) => (
          <div key={index} style={{ display: 'flex', gap: SPACING.md, alignItems: 'center' }}>
            <Skeleton variant="rect" width={56} height={56} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="70%" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadTimedOut) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: SPACING.sm,
          padding: `${SPACING.xxl} 0`,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            fontWeight: TYPOGRAPHY.weights.medium,
          }}
        >
          Couldn't load your posts.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setLoadTimedOut(false);
            void fetchSlots();
            void refreshItems();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const isEmpty = items.length === 0;

  function renderListBody(): React.ReactNode {
    if (isEmpty) {
      return (
        <QueueEmptyStates
          pageId={pageId}
          subdomain={subdomain}
          slots={slots}
          onSlotsChanged={setSlots}
          onCreatePost={onOpenAddQueue}
          onBulkAdd={() => setBulkOpen(true)}
          checklistDismissed={checklistDismissed}
          onDismissChecklist={dismissChecklist}
        />
      );
    }
    if (visibleItems.length === 0) {
      return (
        <p
          style={{
            margin: 0,
            padding: `${SPACING.xl} 0`,
            textAlign: 'center',
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Nothing here.
        </p>
      );
    }
    return (
      <ul
        aria-label="Posts"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}
      >
        {visibleItems.map((item) => {
          const bucket = bucketFor(item);
          const reorderable =
            (item.status === 'queued' || item.status === 'publishing') &&
            (filter === 'all' || filter === 'queued' || filter === 'scheduled');
          return (
            <QueueRow
              key={item.id}
              item={item}
              timeZone={timeZone}
              bucket={bucket}
              selectable={selecting}
              selected={selection.has(item.id)}
              onToggleSelect={toggleSelect}
              reorderable={reorderable}
              isDragOver={dragOverId === item.id}
              onDragStart={setDragId}
              onDragOverRow={(id) => {
                if (dragId && id !== dragId) setDragOverId(id);
              }}
              onDropOnRow={handleDropOnRow}
              onDragEnd={() => {
                setDragId(null);
                setDragOverId(null);
              }}
              onMove={handleMove}
              onEdit={setEditItem}
              onReschedule={setRescheduleItem}
              onDelete={(target) => void handleDelete(target)}
              onRetry={(target) => void handleRetry(target)}
              retryBlocked={connectionExpired === true}
              failedReason={
                bucket === 'failed'
                  ? getFailedReason(item, connectionExpired === true)
                  : null
              }
              busyAction={busyRow?.id === item.id ? busyRow.action : null}
            />
          );
        })}
      </ul>
    );
  }

  return (
    <div
      data-testid="content-tab"
      style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}
    >
      {!isEmpty && (
        <>
          <QueueFailedBanner count={failedCount} onReview={() => setFilter('failed')} />
          <div style={queueHeaderRowStyle()}>
            <QueueSummaryHeader items={items} timeZone={timeZone} />
            <div style={{ display: 'flex', gap: SPACING.sm, alignItems: 'center' }}>
              {!selecting ? (
                <Button variant="ghost" size="sm" onClick={() => setSelecting(true)}>
                  Select
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelecting(false);
                    setSelection(new Set());
                  }}
                >
                  Done
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                data-testid="queue-bulk-add-btn"
                onClick={() => setBulkOpen(true)}
              >
                Bulk add
              </Button>
              <Button
                variant="primary"
                size="sm"
                data-testid="queue-create-post-btn"
                onClick={onOpenAddQueue}
              >
                Create post
              </Button>
            </div>
          </div>
          <QueueFilterTabs counts={counts} active={filter} onChange={setFilter} />

          {selecting && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.md,
                padding: `${SPACING.xs} 0`,
              }}
              aria-live="polite"
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                {selection.size} selected
              </span>
              <Button
                variant="link"
                size="sm"
                disabled={selection.size === 0}
                onClick={() => setShowBulkDeleteConfirm(true)}
                style={{ color: PALETTE.accent3 }}
              >
                Delete ({selection.size})
              </Button>
            </div>
          )}

          {blockedMessage && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: SPACING.md,
                padding: `${SPACING.sm} 0`,
                borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                }}
              >
                {blockedMessage}
              </span>
              <Button variant="link" size="sm" onClick={() => setBlockedMessage(null)}>
                Dismiss
              </Button>
            </div>
          )}
        </>
      )}

      {renderListBody()}

      {/* Reschedule dialog */}
      {rescheduleItem && (
        <QueueRescheduleDialog
          item={rescheduleItem}
          items={items}
          slots={slots}
          timeZone={timeZone}
          onPatch={applyPatch}
          onClose={() => setRescheduleItem(null)}
          onSaved={(message) => pushToast(message)}
          onError={(message) => pushToast(message, { tone: 'error' })}
        />
      )}

      {/* Bulk delete confirmation */}
      <Dialog
        open={showBulkDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setShowBulkDeleteConfirm(false);
        }}
      >
        <DialogContent style={{ maxWidth: '400px' }}>
          <DialogHeader>
            <DialogTitle>
              Delete {selection.size} {selection.size === 1 ? 'post' : 'posts'}?
            </DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setShowBulkDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={bulkDeleting}
              onClick={() => void handleBulkDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit composer */}
      {editItem && (
        <PostComposer
          pageId={pageId}
          subdomain={subdomain}
          slots={slots}
          initialPost={toInitialPost(editItem)}
          onClose={() => setEditItem(null)}
          onSubmitted={(message) => {
            setEditItem(null);
            pushToast(message);
            void refreshItems();
          }}
        />
      )}

      {/* Bulk add modal */}
      {bulkOpen && (
        <BulkAddModal
          pageId={pageId}
          subdomain={subdomain}
          slots={slots}
          isOpen={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onComplete={() => {
            setBulkOpen(false);
            void refreshItems();
          }}
        />
      )}

      <QueueToasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
