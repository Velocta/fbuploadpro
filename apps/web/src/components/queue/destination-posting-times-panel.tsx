'use client';

/**
 * Per-destination posting-times panel (spec 134 PR-134-3) — the data
 * adapter that drives PR-134-2's posting-times orchestrator
 * (`PageTabPostingTimes`: header, slot rows, add/edit form, delete
 * confirm, timezone flow — the same components, no fork) from the
 * destination's unified `posting_slots` and the destination timezone
 * write. One posting-times implementation, two data adapters
 * (spec §3.3): the Facebook Page section feeds it legacy page slots;
 * this panel feeds it unified destination slots.
 *
 * Writes settle through the unified slots routes (PR-134-3's API
 * seam): create/update/delete beside the read the composers use, and
 * the timezone through the collection PATCH. A duplicate time comes
 * back as the route's plain-language 409 and surfaces as a toast —
 * never a silent failure. Slot changes invalidate BOTH destination
 * keys: the queue panel's slot-dependent state (buckets, reorder
 * coverage, retry timing) reads the same table.
 */
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import {
  DestinationPostingSlotSchema,
  ListDestinationPostingSlotsResponseSchema,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import type { DestinationDetail } from '@/lib/api/schemas/connect';
import { ListDestinationQueueResponseSchema } from '@/lib/api/schemas/unified-queue';
import { queryKeys } from '@/lib/data/query-keys';
import { toast } from '@/components/shared/ui/toast';

import { PageTabPostingTimes } from '../pages/dedicated/posting-times/tab-posting-times';
import type { PageSlotSummary } from '../pages/dedicated/tab-dashboard';

/** Passthrough ack for the timezone write: failures throw via the
 *  typed client, never vanish. */
const AckSchema = z.object({}).passthrough();

export interface DestinationPostingTimesPanelProps {
  subdomain: string;
  destination: DestinationDetail;
}

export function DestinationPostingTimesPanel({
  subdomain,
  destination,
}: Readonly<DestinationPostingTimesPanelProps>) {
  const queryClient = useQueryClient();
  const tenant = queryKeys.tenant(subdomain);
  const slotsKey = tenant.destinations.slots(destination.id);
  const queueKey = tenant.destinations.queue(destination.id);

  const slotsPath = buildTenantApiPath(
    subdomain,
    `/destinations/${destination.id}/posting-slots`
  );
  const queuePath = buildTenantApiPath(
    subdomain,
    `/destinations/${destination.id}/queue`
  );

  const slotsQuery = useQuery({
    queryKey: slotsKey,
    queryFn: ({ signal }) =>
      api.get(slotsPath, {
        schema: ListDestinationPostingSlotsResponseSchema,
        signal,
      }),
  });

  // The pending count feeds the timezone-change warning (how many
  // queued posts re-base). It reads the queue panel's cache entry —
  // same key, same schema, so React Query dedupes the fetch and the
  // two panels can never hold different copies of the list.
  const queueQuery = useQuery({
    queryKey: queueKey,
    queryFn: ({ signal }) =>
      api.get(queuePath, { schema: ListDestinationQueueResponseSchema, signal }),
  });
  const pendingQueueCount = React.useMemo(
    () =>
      (queueQuery.data?.items ?? []).filter(
        (item) => item.status === 'queued' || item.status === 'publishing'
      ).length,
    [queueQuery.data]
  );

  const timezone = slotsQuery.data?.timezone ?? destination.timezone;
  const slots: PageSlotSummary[] = React.useMemo(
    () =>
      (slotsQuery.data?.slots ?? []).map((slot) => ({
        id: slot.id,
        slotTime: slot.timeOfDay,
        timezone,
        isActive: slot.isActive,
        allowedFormats: slot.kind,
      })),
    [slotsQuery.data, timezone]
  );

  const invalidateSlots = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: slotsKey });
    void queryClient.invalidateQueries({ queryKey: queueKey });
  }, [queryClient, slotsKey, queueKey]);

  const surfaceError = React.useCallback((error: unknown, fallback: string) => {
    toast.error(error instanceof Error ? error.message : fallback);
  }, []);

  const handleAddSlot = React.useCallback(
    async (data: { slotTime: string; timezone: string; allowedFormats?: string[] }) => {
      try {
        await api.post(
          slotsPath,
          {
            timeOfDay: data.slotTime,
            ...(data.allowedFormats ? { kind: data.allowedFormats } : {}),
          },
          { schema: DestinationPostingSlotSchema }
        );
        invalidateSlots();
      } catch (error) {
        surfaceError(error, "Couldn't add that posting time. Please try again.");
        throw error;
      }
    },
    [slotsPath, invalidateSlots, surfaceError]
  );

  const handleUpdateSlot = React.useCallback(
    async (
      slotId: string,
      data: {
        slotTime?: string;
        timezone?: string;
        isActive?: boolean;
        allowedFormats?: string[];
      }
    ) => {
      try {
        await api.patch(
          `${slotsPath}/${slotId}`,
          {
            ...(data.slotTime ? { timeOfDay: data.slotTime } : {}),
            ...(data.allowedFormats ? { kind: data.allowedFormats } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          },
          { schema: DestinationPostingSlotSchema }
        );
        invalidateSlots();
      } catch (error) {
        surfaceError(error, "Couldn't save that posting time. Please try again.");
        throw error;
      }
    },
    [slotsPath, invalidateSlots, surfaceError]
  );

  const handleToggleSlot = React.useCallback(
    async (slotId: string, isActive: boolean) => {
      await handleUpdateSlot(slotId, { isActive });
    },
    [handleUpdateSlot]
  );

  const handleDeleteSlot = React.useCallback(
    async (slotId: string) => {
      try {
        await api.delete(`${slotsPath}/${slotId}`, { schema: AckSchema });
        invalidateSlots();
      } catch (error) {
        surfaceError(error, "Couldn't remove that posting time. Please try again.");
        throw error;
      }
    },
    [slotsPath, invalidateSlots, surfaceError]
  );

  const handleUpdateTimezone = React.useCallback(
    async (newTimezone: string) => {
      try {
        await api.patch(slotsPath, { timezone: newTimezone }, { schema: AckSchema });
        invalidateSlots();
      } catch (error) {
        surfaceError(error, "Couldn't change the timezone. Please try again.");
        throw error;
      }
    },
    [slotsPath, invalidateSlots, surfaceError]
  );

  return (
    <div data-testid="destination-posting-times-panel">
      <PageTabPostingTimes
        page={{ timezone: destination.timezone }}
        slots={slots}
        isLoading={slotsQuery.isPending}
        pendingQueueCount={pendingQueueCount}
        onAddSlot={handleAddSlot}
        onUpdateSlot={handleUpdateSlot}
        onUpdateTimezone={handleUpdateTimezone}
        onToggleSlot={handleToggleSlot}
        onDeleteSlot={handleDeleteSlot}
      />
    </div>
  );
}
