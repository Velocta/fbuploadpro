'use client';

/**
 * Unified destination section frame (spec 131 PR-131-4, spec §1.3/§9.4).
 *
 * This file is the CANONICAL identity-header pattern for dedicated
 * sections: platform icon + avatar + full name in a fixed position
 * (UX Rule 1), status as colour + icon + text (OD-3 / UX Rule 27).
 * PR-131-3 adopts this landed header for the Facebook Page section —
 * the direction is frame-first here, Facebook second.
 *
 * The frame mounts the four spec 128 slots (queue / composer /
 * posting-times / history) per spec §9.4. The slotted deliverables that
 * exist today (spec 134's queue panel + posting-times, spec 132's
 * composers) are Facebook-Page-shaped — they consume a Page row and the
 * Pages queue/slots APIs. There is no destination enqueue endpoint and
 * no destination posting-slots API today, so for a unified destination
 * each slot renders its owner's own not-yet-available state
 * (spec §4.2.1(c)) — never a 131-invented substitute, never a fake
 * control. The composer slot is spec 132's T-G0 host: it carries the
 * destination's identity (id + platform) as data attributes so the
 * platform composer sets mount into it without a frame change.
 *
 * OD131-2 (History tab) is UNANSWERED: history mounts as a slot in
 * this frame with its existing state only — no tab is created or
 * renamed anywhere in this PR.
 *
 * Data: the route server-prefetches the destination into the React
 * Query cache (spec §8.1); this shell reads that cache entry and only
 * fetches on mount when the prefetch missed (e.g. it failed server-side,
 * where the error states below are the ladder rung). The two error
 * strings are preserved verbatim from the deleted client-side
 * `loadDestinationDetail` helper (spec §6.3).
 */
import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FacebookIcon } from 'lucide-react';

import { api, buildTenantApiPath, isApiError } from '@/lib/api';
import {
  DestinationDetailResponseSchema,
  type DestinationDetail,
} from '@/lib/api/schemas/connect';
import { queryKeys } from '@/lib/data/query-keys';
import { PLATFORM_LABELS } from '@/lib/connect/registry';
import {
  socialStatusLabel,
  socialStatusSignal,
} from '@/components/accounts/social-accounts-list';
import {
  InstagramIcon,
  ThreadsIcon,
  TikTokIcon,
  XTwitterIcon,
  YouTubeIcon,
} from '@/components/workspace/platform-nav-config';
import { EmptyState } from '@/components/shared/ui/empty-state';
import { Skeleton } from '@/components/shared/ui/skeleton';
import { StatusDot } from '@/components/shared/ui/status-dot';

export const DESTINATION_NOT_FOUND_MESSAGE =
  "We couldn't find this destination.";
export const DESTINATION_LOAD_ERROR_MESSAGE =
  "Couldn't load this destination. Please try again.";

export type DestinationDetailView = DestinationDetail;

/** Maps a failed destination load to its preserved verbatim message. */
export function destinationLoadErrorMessage(error: unknown): string {
  if (isApiError(error) && error.status === 404) {
    return DESTINATION_NOT_FOUND_MESSAGE;
  }
  return DESTINATION_LOAD_ERROR_MESSAGE;
}

function DestinationPlatformIcon({
  platform,
}: Readonly<{ platform: DestinationDetail['platform'] }>) {
  const className = 'flex size-6 shrink-0 items-center justify-center text-ink-sub';
  switch (platform) {
    case 'instagram':
      return (
        <span aria-hidden className={className}>
          <InstagramIcon size={20} />
        </span>
      );
    case 'threads':
      return (
        <span aria-hidden className={className}>
          <ThreadsIcon size={20} />
        </span>
      );
    case 'tiktok':
      return (
        <span aria-hidden className={className}>
          <TikTokIcon size={20} />
        </span>
      );
    case 'x':
      return (
        <span aria-hidden className={className}>
          <XTwitterIcon size={20} />
        </span>
      );
    case 'youtube':
      return (
        <span aria-hidden className={className}>
          <YouTubeIcon size={20} />
        </span>
      );
    default:
      return (
        <span aria-hidden className={className}>
          <FacebookIcon className="size-5" />
        </span>
      );
  }
}

function DestinationAvatar({
  destination,
}: Readonly<{ destination: DestinationDetail }>) {
  if (destination.avatarUrl) {
    return (
      <Image
        src={destination.avatarUrl}
        alt=""
        width={48}
        height={48}
        className="size-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-active text-lg font-semibold text-ink-sub"
    >
      {destination.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/**
 * The §1.3 identity header + summary block. Exported pure so the parity
 * suites render it without the query shell.
 */
export function DestinationSummary({
  destination,
}: Readonly<{ destination: DestinationDetail }>) {
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <DestinationPlatformIcon platform={destination.platform} />
        <DestinationAvatar destination={destination} />
        <h1
          data-testid="destination-name"
          className="m-0 text-xxl font-bold tracking-h1 text-ink"
        >
          {destination.name}
        </h1>
        <StatusDot
          status={socialStatusSignal(destination.status)}
          label={socialStatusLabel(destination.status)}
        />
      </div>

      <div className="mt-4 flex flex-col gap-1 rounded-md border border-line bg-panel px-6 py-4 text-body text-ink">
        <p className="m-0">
          Platform: {PLATFORM_LABELS[destination.platform]}
        </p>
        <p className="m-0">
          Connected through: {destination.account.displayName}
        </p>
        {destination.handle && (
          <p className="m-0">
            Handle:{' '}
            {destination.handle.startsWith('@')
              ? destination.handle
              : `@${destination.handle}`}
          </p>
        )}
        <p className="m-0">Posting timezone: {destination.timezone}</p>
      </div>
    </div>
  );
}

interface DestinationSlotProps {
  destination: DestinationDetail;
  slot: 'queue' | 'composer' | 'posting-times' | 'history';
  title: string;
  description: string;
}

/**
 * One spec 128 slot mount (spec §9.4). Until the owner spec's
 * deliverable exists for unified destinations, the slot renders that
 * owner's own not-yet-available state (§4.2.1(c)): a typed empty state
 * with no action — the frame invents no content and no dead control.
 */
function DestinationSlot({
  destination,
  slot,
  title,
  description,
}: Readonly<DestinationSlotProps>) {
  return (
    <section
      data-testid={`destination-slot-${slot}`}
      data-destination-id={destination.id}
      data-platform={destination.platform}
      aria-label={title}
      className="border-t border-line pt-6"
    >
      <h2 className="m-0 text-lg font-semibold text-ink">{title}</h2>
      <EmptyState type="first-use" title={title} description={description} />
    </section>
  );
}

/** The four spec 128 slots, mounted in spec order (§9.4). */
export function DestinationSlots({
  destination,
}: Readonly<{ destination: DestinationDetail }>) {
  return (
    <div className="mt-8 flex flex-col gap-8">
      <DestinationSlot
        destination={destination}
        slot="queue"
        title="Queue"
        description="Posts scheduled for this destination will appear here once its queue is available."
      />
      <DestinationSlot
        destination={destination}
        slot="composer"
        title="Composer"
        description="The composer for this destination will open here once it is available."
      />
      <DestinationSlot
        destination={destination}
        slot="posting-times"
        title="Posting times"
        description="Posting times for this destination will appear here once they are available."
      />
      <DestinationSlot
        destination={destination}
        slot="history"
        title="History"
        description="Published posts for this destination will appear here once its history is available."
      />
    </div>
  );
}

function DestinationFrameSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading destination" className="mt-6 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-md border border-line bg-panel p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export interface DestinationFrameProps {
  subdomain: string;
  destinationId: string;
}

export function DestinationFrame({
  subdomain,
  destinationId,
}: Readonly<DestinationFrameProps>) {
  const tenant = queryKeys.tenant(subdomain);
  const destinationPath = buildTenantApiPath(
    subdomain,
    `/accounts/social/${destinationId}`
  );

  const destinationQuery = useQuery({
    queryKey: tenant.destinations.detail(destinationId),
    queryFn: ({ signal }) =>
      api.get(destinationPath, {
        schema: DestinationDetailResponseSchema,
        signal,
      }),
  });

  const destination = destinationQuery.data?.destination;

  return (
    <div
      data-testid="destination-section-page"
      className="mx-auto box-border w-full max-w-300 px-6 py-6"
    >
      <Link
        href={`/tenant/${subdomain}/accounts`}
        className="inline-flex min-h-11 items-center text-metadata font-semibold text-primary underline outline-none focus-visible:outline-2 focus-visible:outline-brand-gold"
      >
        Back to Accounts
      </Link>

      {destinationQuery.isPending && <DestinationFrameSkeleton />}

      {destinationQuery.isError && (
        <p
          data-testid="destination-load-error"
          className="mt-6 text-body text-brand-rose"
        >
          {destinationLoadErrorMessage(destinationQuery.error)}
        </p>
      )}

      {destination && (
        <>
          <DestinationSummary destination={destination} />
          <DestinationSlots destination={destination} />
        </>
      )}
    </div>
  );
}
