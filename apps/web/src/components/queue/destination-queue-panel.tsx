'use client';

/**
 * Per-destination unified queue panel (spec 134 PR-134-3, T26–T28 as
 * rescoped by OD-134-3: no unified queue home — queues live
 * per-destination only, inside the PR-131-4 destination frame).
 *
 * Data path (T23, verified in the PR): web-composed posts land in
 * unified `queue_items` (composer create → destination enqueue,
 * PRs 750/756/759) and the worker publishes only from unified
 * `queue_items`; this panel reads and acts on that same table through
 * the unified destination queue routes (PR-134-3's API seam). During
 * the cutover the legacy Facebook Page section still read the
 * pre-unification queue table, so a post composed on the web appeared
 * HERE, not in the Page-section queue; since the Phase 7 drop, the
 * Page section reads the unified table too.
 *
 * The row/table system is PR-134-1's, imported — never forked: the
 * same QueueRow, filter tabs, summary header, failed banner, bulk
 * delete dialog, reschedule dialog, and queue-logic (filters, counts,
 * reorder planning, slot matching) the Page panel uses. What differs
 * is the data adapter and the destination-scoped behaviours:
 *
 * - Slot READ convergence (the seam PR 759 recorded): the slot
 *   summaries this panel — and the composer it mounts — render are
 *   the destination's unified `posting_slots`, the same table the
 *   enqueue resolves server-side. On destination surfaces the two
 *   reads are one.
 * - Reorder assigns each position's governing slot alongside its
 *   time, so an item's `slot_id` follows its position.
 * - Retry is the unified server action (the route resolves the retry
 *   time through the unified slot scheduler); the panel never
 *   computes a retry time itself.
 * - Edit mounts the item's own platform composer where one exists in
 *   this codebase: Facebook's (its edit settles through the unified
 *   item actions — the G4 residual). Other platforms' composer sets
 *   have not landed yet, so their Edit is disabled-with-reason
 *   (T27's matrix, never a dead control).
 * - The toolbar carries NO Create post / Bulk add: creation lives in
 *   the frame's Composer slot (spec 132's deliverable); this panel is
 *   the working surface for what is already queued.
 * - Delete + Undo: the Undo re-enqueues the item through the unified
 *   destination enqueue at its original time (a new row — the claim
 *   path keys on content + scheduled time, not the old id).
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import {
  DestinationEnqueueResponseSchema,
  ListDestinationPostingSlotsResponseSchema,
  type PostFormat,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import type { DestinationDetail } from '@/lib/api/schemas/connect';
import { ListFacebookPagesResponseSchema } from '@/lib/api/schemas/pages';
import {
  ListDestinationQueueResponseSchema,
  UnifiedQueueItemSchema,
  type UnifiedQueueItem,
} from '@/lib/api/schemas/unified-queue';
import { queryKeys } from '@/lib/data/query-keys';
import { PLATFORM_LABELS } from '@/lib/connect/registry';
import { Banner } from '@/components/shared/ui/banner';
import { Button } from '@/components/shared/ui/button';
import { Skeleton } from '@/components/shared/ui/skeleton';
import { TableBatchBar, TableToolbar } from '@/components/shared/ui/table';
import { toast } from '@/components/shared/ui/toast';

import { PostComposer, type ComposerInitialPost } from '../pages/dedicated/composer/post-composer';
import { formatSlotShort } from '../pages/dedicated/composer/queue-slot-utils';
import type { PageSlotSummary } from '../pages/dedicated/tab-dashboard';
import { QueueSummaryHeader } from '../pages/dedicated/queue/queue-summary-header';
import { QueueFilterTabs } from '../pages/dedicated/queue/queue-filter-tabs';
import { QueueRow, type QueueRowBucket } from '../pages/dedicated/queue/queue-row';
import { QueueFailedBanner } from '../pages/dedicated/queue/queue-failed-banner';
import {
  countByFilter,
  filterItems,
  isSlotBased,
  matchSlotForTime,
  planReorder,
  resolveFormat,
  sortForDisplay,
} from '../pages/dedicated/queue/queue-logic';
import type {
  DedicatedQueueItem,
  QueueFilter,
} from '../pages/dedicated/queue/queue-types';
import { QUEUE_FILTER_LABELS } from '../pages/dedicated/queue/queue-types';
import { DestinationQueueEmptyStates } from './destination-queue-empty-states';
import { getDestinationFailedReason } from './destination-failed-reason';

/** Shown after a queue reorder saves successfully (spec 112, verbatim). */
export const DESTINATION_QUEUE_REORDER_SUCCESS_MESSAGE =
  'Queue reordered — posting times updated.';
/** Shown when a queue reorder could not be saved (spec 112, verbatim). */
export const DESTINATION_QUEUE_REORDER_ERROR_MESSAGE = "Couldn't save the new order.";
/** Shown when a reorder attempt changes nothing (spec 134 §3.1.1). */
export const DESTINATION_QUEUE_REORDER_NOOP_MESSAGE =
  'That post is already in that position — the order did not change.';

/** Undo window for single deletes (spec 105 §5.1.6). */
const UNDO_DURATION_MS = 8000;
/** Rows rendered per window past the virtualisation threshold (OD-134-4). */
const WINDOW_SIZE = 50;

const QueueRescheduleDialog = dynamic(
  () =>
    import('../pages/dedicated/queue/queue-reschedule-dialog').then(
      (m) => m.QueueRescheduleDialog
    ),
  { ssr: false }
);
const QueueBulkDeleteDialog = dynamic(
  () =>
    import('../pages/dedicated/queue/queue-bulk-delete-dialog').then(
      (m) => m.QueueBulkDeleteDialog
    ),
  { ssr: false }
);

/** Passthrough ack for queue mutations whose bodies the panel does not
 *  consume: the typed client's error taxonomy still applies in full —
 *  failures throw, never vanish. */
const AckSchema = z.object({}).passthrough();

function toPostFormat(item: UnifiedQueueItem): PostFormat {
  if (item.platformFormat === 'reel') return 'reel';
  switch (item.kind) {
    case 'video':
      return 'video';
    case 'story':
      return 'story';
    case 'image':
    case 'carousel':
      return 'image';
    default:
      return 'text';
  }
}

function toQueueItem(item: UnifiedQueueItem): DedicatedQueueItem {
  return {
    id: item.id,
    mediaId: item.mediaItemId,
    postFormat: toPostFormat(item),
    linkUrl: item.linkUrl,
    caption: item.caption,
    firstComment: item.firstComment,
    scheduledTime: item.scheduledTime,
    status: item.status,
    retryCount: item.retryCount,
    maxRetries: item.maxRetries,
    fbPostId: item.externalPostId,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    media: item.media
      ? {
          name: item.media.name,
          mediaType: item.media.mediaType,
          thumbnailUrl: item.media.thumbnailUrl,
          url: item.media.url,
          durationSeconds: item.media.durationSeconds,
        }
      : null,
  };
}

function toSlotSummary(
  slot: { id: string; kind: string[]; timeOfDay: string; isActive: boolean },
  timezone: string
): PageSlotSummary {
  return {
    id: slot.id,
    slotTime: slot.timeOfDay,
    timezone,
    isActive: slot.isActive,
    allowedFormats: slot.kind,
  };
}

function toInitialPost(
  item: DedicatedQueueItem,
  destinationId: string
): ComposerInitialPost {
  return {
    id: item.id,
    destinationId,
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

export interface DestinationQueuePanelProps {
  subdomain: string;
  destination: DestinationDetail;
}

export function DestinationQueuePanel({
  subdomain,
  destination,
}: Readonly<DestinationQueuePanelProps>) {
  const queryClient = useQueryClient();
  const tenant = queryKeys.tenant(subdomain);
  const queueKey = tenant.destinations.queue(destination.id);
  const slotsKey = tenant.destinations.slots(destination.id);
  const platformLabel = PLATFORM_LABELS[destination.platform];

  const queuePath = buildTenantApiPath(
    subdomain,
    `/destinations/${destination.id}/queue`
  );
  const slotsPath = buildTenantApiPath(
    subdomain,
    `/destinations/${destination.id}/posting-slots`
  );

  // --- queries -------------------------------------------------------------
  const queueQuery = useQuery({
    queryKey: queueKey,
    queryFn: ({ signal }) =>
      api.get(queuePath, { schema: ListDestinationQueueResponseSchema, signal }),
  });
  const slotsQuery = useQuery({
    queryKey: slotsKey,
    queryFn: ({ signal }) =>
      api.get(slotsPath, {
        schema: ListDestinationPostingSlotsResponseSchema,
        signal,
      }),
  });

  const unifiedItems = React.useMemo(
    () => queueQuery.data?.items ?? [],
    [queueQuery.data]
  );
  const unifiedById = React.useMemo(
    () => new Map(unifiedItems.map((item) => [item.id, item])),
    [unifiedItems]
  );
  // Cancelled items are terminal tombstones for the claim path; they
  // never render as queue rows (spec 134 §3.1's queue-clear state is
  // what an all-cancelled destination shows instead).
  const items: DedicatedQueueItem[] = React.useMemo(
    () =>
      unifiedItems
        .filter((item) => item.status !== 'cancelled')
        .map(toQueueItem),
    [unifiedItems]
  );

  const timeZone = queueQuery.data?.timezone ?? destination.timezone;
  const slots: PageSlotSummary[] = React.useMemo(
    () => (slotsQuery.data?.slots ?? []).map((slot) => toSlotSummary(slot, timeZone)),
    [slotsQuery.data, timeZone]
  );
  const slotsLoaded = slotsQuery.isSuccess || slotsQuery.isError;
  const hasActiveSlot = slots.some((slot) => slot.isActive);

  const failedCount = React.useMemo(
    () => items.filter((item) => item.status === 'failed').length,
    [items]
  );
  // Retry gating (§3.5): the destination's own connection state, from
  // the queue read itself — no second accounts read.
  const connectionDown = queueQuery.data
    ? queueQuery.data.destinationStatus !== 'active'
    : destination.status !== 'active';

  const limit = queueQuery.data?.limit ?? null;
  const limitReached =
    limit !== null &&
    ((limit.nextAllowedPublishAt !== null &&
      new Date(limit.nextAllowedPublishAt).getTime() > Date.now()) ||
      limit.rateUsagePct >= 100);

  // --- panel state -----------------------------------------------------------
  const [filter, setFilter] = React.useState<QueueFilter>('all');
  const [selecting, setSelecting] = React.useState(false);
  const [selection, setSelection] = React.useState<ReadonlySet<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false);
  const [rescheduleItem, setRescheduleItem] = React.useState<DedicatedQueueItem | null>(null);
  const [editTarget, setEditTarget] = React.useState<{
    item: DedicatedQueueItem;
    pageId: string;
  } | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState('');
  const [busyRow, setBusyRow] = React.useState<{
    id: string;
    action: 'retry' | 'delete';
  } | null>(null);
  const [renderWindow, setRenderWindow] = React.useState(WINDOW_SIZE);

  // OD-134-4 windowed rendering, the Page panel's pattern: a sentinel
  // expands the rendered window while reorder works on the full set.
  const sentinelRef = React.useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setRenderWindow((w) => w + WINDOW_SIZE);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const invalidateQueue = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queueKey });
  }, [queryClient, queueKey]);

  const setCachedItems = React.useCallback(
    (updater: (prev: UnifiedQueueItem[]) => UnifiedQueueItem[]) => {
      queryClient.setQueryData(queueKey, (prev: unknown) => {
        const prevData = prev as
          | { items?: UnifiedQueueItem[] }
          | undefined;
        if (!prevData) return prev;
        return { ...prevData, items: updater(prevData.items ?? []) };
      });
    },
    [queryClient, queueKey]
  );

  // --- derived -----------------------------------------------------------------
  const counts = React.useMemo(
    () => countByFilter(items, slots, timeZone, slotsLoaded),
    [items, slots, timeZone, slotsLoaded]
  );
  const visibleItems = React.useMemo(
    () => sortForDisplay(filterItems(items, filter, slots, timeZone, slotsLoaded)),
    [items, filter, slots, timeZone, slotsLoaded]
  );
  const reorderableItems = React.useMemo(
    () =>
      sortForDisplay(items.filter((i) => i.status === 'queued' || i.status === 'publishing')),
    [items]
  );

  const bucketFor = React.useCallback(
    (item: DedicatedQueueItem): QueueRowBucket => {
      if (item.status === 'failed') return 'failed';
      if (item.status === 'published') return 'published';
      if (!slotsLoaded) return 'queued';
      return isSlotBased(item, slots, timeZone) ? 'queued' : 'scheduled';
    },
    [slots, timeZone, slotsLoaded]
  );

  // --- mutations -----------------------------------------------------------------
  const patchItem = React.useCallback(
    async (id: string, data: Record<string, unknown>): Promise<boolean> => {
      try {
        await api.patch(`${queuePath}/${id}`, data, { schema: AckSchema });
        return true;
      } catch {
        return false;
      }
    },
    [queuePath]
  );

  /** The reschedule dialog's patch path: a new time also re-pins the
   *  item to the slot governing that time (or unpins it — a custom
   *  time belongs to no slot). */
  const applyPatch = React.useCallback(
    async (id: string, data: Record<string, unknown>): Promise<boolean> => {
      const enriched: Record<string, unknown> = { ...data };
      if (typeof data.scheduledTime === 'string') {
        enriched.slotId =
          matchSlotForTime(data.scheduledTime, slots, timeZone)?.id ?? null;
      }
      const ok = await patchItem(id, enriched);
      if (ok) {
        setCachedItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(typeof enriched.scheduledTime === 'string'
                    ? { scheduledTime: enriched.scheduledTime }
                    : {}),
                  ...(enriched.slotId !== undefined
                    ? { slotId: enriched.slotId as string | null }
                    : {}),
                }
              : item
          )
        );
      }
      return ok;
    },
    [patchItem, setCachedItems, slots, timeZone]
  );

  const reorderMutation = useMutation({
    mutationFn: async (
      assignments: Array<{ id: string; scheduledTime: string; slotId: string | null }>
    ) => {
      const results = await Promise.all(
        assignments.map(async (a) => {
          try {
            await api.patch(`${queuePath}/${a.id}`, {
              scheduledTime: a.scheduledTime,
              slotId: a.slotId,
            }, { schema: AckSchema });
            return true;
          } catch {
            return false;
          }
        })
      );
      if (results.some((ok) => !ok)) throw new Error('reorder-failed');
    },
    onMutate: (assignments) => {
      const byId = new Map(assignments.map((a) => [a.id, a]));
      const snapshot = queryClient.getQueryData(queueKey);
      setCachedItems((prev) =>
        prev.map((item) =>
          byId.has(item.id)
            ? {
                ...item,
                scheduledTime: byId.get(item.id)?.scheduledTime as string,
                slotId: byId.get(item.id)?.slotId ?? null,
              }
            : item
        )
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queueKey, context.snapshot);
      }
      toast.error(DESTINATION_QUEUE_REORDER_ERROR_MESSAGE);
      invalidateQueue();
    },
    onSuccess: () => {
      toast.success(DESTINATION_QUEUE_REORDER_SUCCESS_MESSAGE);
      invalidateQueue();
    },
  });

  const applyReorder = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      const plan = planReorder({
        ordered: reorderableItems,
        fromIndex,
        toIndex,
        slots,
        timeZone,
      });
      if ('blocked' in plan) {
        setBlockedMessage(plan.blocked);
        setAnnouncement(plan.blocked);
        return;
      }
      if (plan.assignments.length === 0) {
        // §3.1.1: a no-op reorder attempt acknowledges visibly.
        toast.info(DESTINATION_QUEUE_REORDER_NOOP_MESSAGE);
        setAnnouncement(DESTINATION_QUEUE_REORDER_NOOP_MESSAGE);
        return;
      }
      setBlockedMessage(null);
      const targetTime = reorderableItems[toIndex]?.scheduledTime;
      if (targetTime) {
        const newTimeText = formatSlotShort(new Date(targetTime), timeZone);
        setAnnouncement(
          `Moved to position ${toIndex + 1} of ${reorderableItems.length}, due ${newTimeText} ${timeZone}.`
        );
      }
      reorderMutation.mutate(
        plan.assignments.map((a) => ({
          id: a.id,
          scheduledTime: a.scheduledTime,
          slotId: matchSlotForTime(a.scheduledTime, slots, timeZone)?.id ?? null,
        }))
      );
    },
    [reorderableItems, slots, timeZone, reorderMutation]
  );

  const handleDropOnRow = React.useCallback(
    (targetId: string) => {
      const fromIndex = reorderableItems.findIndex((i) => i.id === dragId);
      const toIndex = reorderableItems.findIndex((i) => i.id === targetId);
      setDragId(null);
      setDragOverId(null);
      if (!dragId || fromIndex < 0 || toIndex < 0) {
        if (dragId) {
          toast.info(DESTINATION_QUEUE_REORDER_NOOP_MESSAGE);
          setAnnouncement(DESTINATION_QUEUE_REORDER_NOOP_MESSAGE);
        }
        return;
      }
      applyReorder(fromIndex, toIndex);
    },
    [dragId, reorderableItems, applyReorder]
  );

  const handleMove = React.useCallback(
    (id: string, direction: -1 | 1) => {
      const index = reorderableItems.findIndex((i) => i.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= reorderableItems.length) {
        toast.info(DESTINATION_QUEUE_REORDER_NOOP_MESSAGE);
        setAnnouncement(DESTINATION_QUEUE_REORDER_NOOP_MESSAGE);
        return;
      }
      applyReorder(index, target);
    },
    [reorderableItems, applyReorder]
  );

  // --- delete + undo restore ------------------------------------------------------
  const restoreDeletedItem = React.useCallback(
    async (source: UnifiedQueueItem) => {
      try {
        await api.post(
          buildTenantApiPath(subdomain, '/publishing/destination-queue'),
          {
            platform: destination.platform,
            destinationId: destination.id,
            kind: source.kind,
            ...(source.platformFormat
              ? { platformFormat: source.platformFormat }
              : {}),
            caption: source.caption,
            title: source.title,
            firstComment: source.firstComment,
            mediaItemIds: source.mediaItemId ? [source.mediaItemId] : [],
            linkUrl: source.linkUrl,
            intent: 'scheduled',
            scheduledAt: source.scheduledTime,
            ...(Object.keys(source.platformOptions).length > 0
              ? { platformOptions: source.platformOptions }
              : {}),
          },
          { schema: DestinationEnqueueResponseSchema }
        );
        invalidateQueue();
        toast.success('Post restored.');
      } catch {
        toast.error("Couldn't restore this post.");
      }
    },
    [subdomain, destination.platform, destination.id, invalidateQueue]
  );

  const handleDelete = React.useCallback(
    async (item: DedicatedQueueItem) => {
      const source = unifiedById.get(item.id);
      setBusyRow({ id: item.id, action: 'delete' });
      let ok = false;
      try {
        await api.delete(`${queuePath}/${item.id}`, { schema: AckSchema });
        ok = true;
      } catch {
        ok = false;
      }
      setBusyRow(null);
      if (!ok) {
        toast.error("Couldn't delete this post. Please try again.");
        return;
      }
      setCachedItems((prev) => prev.filter((c) => c.id !== item.id));
      setSelection((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      toast.success('Post deleted.', {
        duration: UNDO_DURATION_MS,
        ...(source
          ? {
              action: {
                label: 'Undo',
                onClick: () => void restoreDeletedItem(source),
              },
            }
          : {}),
      });
    },
    [queuePath, setCachedItems, unifiedById, restoreDeletedItem]
  );

  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const handleBulkDelete = React.useCallback(async () => {
    const ids = [...selection];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let failed = 0;
    for (const id of ids) {
      try {
        await api.delete(`${queuePath}/${id}`, { schema: AckSchema });
      } catch {
        failed += 1;
      }
    }
    const deleted = ids.length - failed;
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelecting(false);
    setSelection(new Set());
    if (deleted > 0) {
      const deletedIds = new Set(ids);
      setCachedItems((prev) => prev.filter((i) => !deletedIds.has(i.id)));
    }
    if (deleted === ids.length) {
      toast.success(`${deleted} ${deleted === 1 ? 'post' : 'posts'} deleted.`);
    } else {
      toast.error(`Deleted ${deleted} of ${ids.length} posts.`);
      invalidateQueue();
    }
  }, [selection, queuePath, setCachedItems, invalidateQueue]);

  // --- retry (the unified server action) -------------------------------------------
  const handleRetry = React.useCallback(
    async (item: DedicatedQueueItem) => {
      if (connectionDown) return;
      setBusyRow({ id: item.id, action: 'retry' });
      try {
        const updated = await api.post(`${queuePath}/${item.id}/retry`, undefined, {
          schema: UnifiedQueueItemSchema,
        });
        setCachedItems((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setBusyRow(null);
        toast.success(
          `Retrying ${formatSlotShort(new Date(updated.scheduledTime), timeZone)}.`
        );
      } catch (error) {
        setBusyRow(null);
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn't retry this post. Please try again."
        );
      }
    },
    [connectionDown, queuePath, setCachedItems, timeZone]
  );

  // --- edit (Facebook composer; other platforms disabled-with-reason) ----------------
  const editDisabledReason =
    destination.platform === 'facebook'
      ? null
      : `${platformLabel} posts can't be edited here yet`;

  const handleEdit = React.useCallback(
    async (item: DedicatedQueueItem) => {
      if (destination.platform !== 'facebook') return;
      try {
        const data = await api.get(buildTenantApiPath(subdomain, '/pages'), {
          schema: ListFacebookPagesResponseSchema,
        });
        const page = data.pages.find(
          (p) => p.fbPageId === destination.externalDestinationId
        );
        if (!page) {
          toast.error(
            "Couldn't find this Page to edit the post. Reconnect the Page, then try again."
          );
          return;
        }
        setEditTarget({ item, pageId: page.id });
      } catch {
        toast.error("Couldn't load this Page to edit the post. Please try again.");
      }
    },
    [subdomain, destination.platform, destination.externalDestinationId]
  );

  const addSlotFromEmptyState = React.useCallback(
    async (timeOfDay: string): Promise<boolean> => {
      try {
        await api.post(slotsPath, { timeOfDay }, { schema: AckSchema });
        void queryClient.invalidateQueries({ queryKey: slotsKey });
        return true;
      } catch {
        return false;
      }
    },
    [slotsPath, queryClient, slotsKey]
  );

  const toggleSelect = React.useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // --- render -------------------------------------------------------------------------
  const showLoading = queueQuery.isPending && items.length === 0;
  const showLoadError = queueQuery.isError && items.length === 0;

  if (showLoading) {
    return (
      <div
        className="flex flex-col gap-4"
        aria-label="Loading posts"
        aria-busy="true"
        data-testid="destination-queue-panel"
      >
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="size-14" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (showLoadError) {
    return (
      <div data-testid="destination-queue-panel">
        <Banner
          variant="critical"
          title="Couldn't load your posts."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                invalidateQueue();
                void queryClient.invalidateQueries({ queryKey: slotsKey });
              }}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const isEmpty = items.length === 0;
  const windowedItems = visibleItems.slice(0, renderWindow);
  const hasMoreWindow = visibleItems.length > windowedItems.length;

  return (
    <div data-testid="destination-queue-panel" className="flex flex-col gap-4">
      <div
        aria-live="polite"
        role="status"
        data-testid="destination-queue-reorder-announcer"
        className="sr-only"
      >
        {announcement}
      </div>

      {!isEmpty && (
        <>
          <QueueFailedBanner count={failedCount} onReview={() => setFilter('failed')} />

          {limitReached && limit && (
            <Banner
              variant="warning"
              title={
                limit.nextAllowedPublishAt
                  ? `This destination has reached its posting limit for now — new posts will go out after ${formatSlotShort(new Date(limit.nextAllowedPublishAt), timeZone)} ${timeZone}.`
                  : 'This destination has reached its posting limit for now.'
              }
            />
          )}

          <TableToolbar className="justify-between">
            <QueueSummaryHeader items={items} timeZone={timeZone} />
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          </TableToolbar>
          <QueueFilterTabs counts={counts} active={filter} onChange={setFilter} />

          {selecting && (
            <TableBatchBar
              selectedCount={selection.size}
              onClearSelection={() => setSelection(new Set())}
            >
              <Button
                variant="destructive"
                size="sm"
                disabled={selection.size === 0}
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                Delete ({selection.size})
              </Button>
            </TableBatchBar>
          )}

          {blockedMessage && (
            <Banner
              variant="warning"
              title={blockedMessage}
              onDismiss={() => setBlockedMessage(null)}
            />
          )}
        </>
      )}

      {isEmpty ? (
        unifiedItems.length > 0 ? (
          <DestinationQueueEmptyStates variant="queue-clear" />
        ) : slotsLoaded && !hasActiveSlot ? (
          <DestinationQueueEmptyStates
            variant="setup-incomplete"
            onAddSlot={addSlotFromEmptyState}
          />
        ) : (
          <DestinationQueueEmptyStates variant="first-use" />
        )
      ) : visibleItems.length === 0 ? (
        <DestinationQueueEmptyStates
          variant="no-results"
          filterLabel={QUEUE_FILTER_LABELS[filter]}
          onClearFilters={() => setFilter('all')}
        />
      ) : (
        <>
          <ul aria-label="Posts" className="m-0 flex list-none flex-col p-0">
            {windowedItems.map((item) => {
              const bucket = bucketFor(item);
              const reorderable =
                (item.status === 'queued' || item.status === 'publishing') &&
                (filter === 'all' || filter === 'queued' || filter === 'scheduled');
              const reorderIndex = reorderableItems.findIndex((i) => i.id === item.id);
              const source = unifiedById.get(item.id);
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
                  onEdit={(target) => void handleEdit(target)}
                  onReschedule={setRescheduleItem}
                  onDelete={(target) => void handleDelete(target)}
                  onRetry={(target) => void handleRetry(target)}
                  retryBlocked={connectionDown}
                  retryBlockedReason={`Reconnect your ${platformLabel} account to retry.`}
                  editDisabledReason={editDisabledReason}
                  failedReason={
                    bucket === 'failed'
                      ? getDestinationFailedReason(
                          item,
                          platformLabel,
                          connectionDown,
                          source?.errorDetail
                        )
                      : null
                  }
                  busyAction={busyRow?.id === item.id ? busyRow.action : null}
                  reorderIndex={reorderIndex}
                  reorderCount={reorderableItems.length}
                  onAnnounce={setAnnouncement}
                  destinationName={destination.name}
                />
              );
            })}
          </ul>
          {hasMoreWindow && (
            <div ref={sentinelRef} className="flex justify-center py-2">
              <Button
                variant="secondary"
                data-testid="destination-queue-show-more-btn"
                onClick={() => setRenderWindow((w) => w + WINDOW_SIZE)}
              >
                Show more posts ({visibleItems.length - windowedItems.length} more)
              </Button>
            </div>
          )}
        </>
      )}

      {rescheduleItem && (
        <QueueRescheduleDialog
          item={rescheduleItem}
          items={items}
          slots={slots}
          timeZone={timeZone}
          onPatch={applyPatch}
          onClose={() => setRescheduleItem(null)}
          onSaved={(message) => {
            toast.success(message);
          }}
          onError={(message) => toast.error(message)}
        />
      )}

      {showBulkDeleteConfirm && (
        <QueueBulkDeleteDialog
          count={selection.size}
          deleting={bulkDeleting}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={() => void handleBulkDelete()}
        />
      )}

      {editTarget && (
        <PostComposer
          pageId={editTarget.pageId}
          subdomain={subdomain}
          slots={slots}
          initialPost={toInitialPost(editTarget.item, destination.id)}
          onClose={() => setEditTarget(null)}
          onSubmitted={(message) => {
            setEditTarget(null);
            toast.success(message);
            invalidateQueue();
          }}
        />
      )}
    </div>
  );
}
