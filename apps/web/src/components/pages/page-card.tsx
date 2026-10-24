'use client';

/**
 * Page card (spec 131 PR-131-2) — rebuilt on the design system:
 * token-backed Tailwind utilities only (zero inline styles), the
 * avatar on `next/image` (the file's raw img element is deleted),
 * and status as colour + icon + text via the shared/ui `StatusDot`
 * (spec §6.4.1 / OD-3 — the one named deviation from the previous
 * bare-text status). Layout, copy, testids, and the click / Enter /
 * Space activation behaviours are preserved (spec §6 parity).
 *
 * The exported `FacebookPageItem` type is a cross-PR contract
 * (consumed by the dedicated section route, PR-131-3) — its shape
 * is frozen in this PR. The status colour/ring helper functions keep
 * returning the theme values the parity suites pin; the card's own
 * rendering maps the same statuses onto token classes.
 */
import * as React from 'react';
import Image from 'next/image';
import { MoveUpRightIcon, TriangleAlertIcon } from 'lucide-react';

import { PALETTE, THEME } from '@/lib/theme';
import { getUserInitials } from '@/lib/user-initials';
import { cn } from '@/lib/utils';
import { StatusDot, type Status } from '@/components/shared/ui/status-dot';

export type FacebookPageStatus =
  | 'active'
  | 'paused'
  | 'fb_rate_limited'
  | 'page_checkpoint'
  | 'invalid_token'
  | 'disconnected';

export interface FacebookPageItem {
  id: string;
  facebookAccountId: string;
  accountDisplayName?: string | undefined;
  fbPageId: string;
  pageName: string;
  profilePictureUrl?: string | null | undefined;
  category?: string | null | undefined;
  timezone?: string | undefined;
  startingFollowers: number;
  currentFollowers: number;
  followersGained: number;
  status: FacebookPageStatus;
  tasks?: string[] | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface PageCardProps {
  page: FacebookPageItem;
  subdomain?: string | undefined;
  onSelectPage?: ((page: FacebookPageItem) => void) | undefined;
  forceAvatarError?: boolean | undefined;
}

export function isPageNeedsAttention(status: FacebookPageStatus): boolean {
  return (
    status === 'invalid_token' ||
    status === 'page_checkpoint' ||
    status === 'fb_rate_limited'
  );
}

export function getPageStatusLabel(status: FacebookPageStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'invalid_token':
      return 'Token Expired';
    case 'page_checkpoint':
      return 'Identity Checkpoint';
    case 'fb_rate_limited':
      return 'Rate Limited';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Active';
  }
}

export function getPageAttentionMessage(
  status: FacebookPageStatus
): string | null {
  switch (status) {
    case 'invalid_token':
      return 'Token Expired — Reconnect the parent Facebook account to resume publishing.';
    case 'page_checkpoint':
      return 'Identity Checkpoint — Confirm page identity on Facebook mobile to resume.';
    case 'fb_rate_limited':
      return 'Rate Limited — Facebook temporarily restricted posting (auto-resumes after 3 days).';
    default:
      return null;
  }
}

export function getPageStatusColor(status: FacebookPageStatus): string {
  if (isPageNeedsAttention(status)) {
    return PALETTE.accent3;
  }
  if (status === 'paused') {
    return PALETTE.primary;
  }
  if (status === 'active') {
    return PALETTE.accent4;
  }
  return `var(--text-dim, ${THEME.default.text.muted})`;
}

export function getPageStatusRingBorder(status: FacebookPageStatus): string {
  if (isPageNeedsAttention(status)) {
    return `1.5px solid ${PALETTE.accent3}`;
  }
  if (status === 'paused') {
    return `1.5px solid ${PALETTE.primary}`;
  }
  if (status === 'active') {
    return `1.5px solid ${PALETTE.accent4}`;
  }
  return `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`;
}

/** Token signal for a page status — the StatusDot presentation (§6.4.1). */
export function getPageStatusSignal(status: FacebookPageStatus): Status {
  if (isPageNeedsAttention(status)) return 'critical';
  if (status === 'paused') return 'queued';
  if (status === 'active') return 'operational';
  return 'idle';
}

const RING_CLASSES: Record<Status, string> = {
  operational: 'border-2 border-signal-operational',
  queued: 'border-2 border-signal-queued',
  critical: 'border-2 border-signal-critical',
  idle: 'border border-line',
};

/**
 * Short, human-comparable form of a page's Facebook Page ID.
 * Pages can share a display name (and even followers and category), so the
 * ID suffix is the distinguishing line that tells two same-named pages apart.
 */
export function formatPageIdSuffix(fbPageId: string): string {
  const trimmed = fbPageId.trim();
  if (!trimmed) return '';
  return trimmed.length <= 6 ? trimmed : `…${trimmed.slice(-6)}`;
}

export function computeFollowersGained(
  page: Pick<FacebookPageItem, 'currentFollowers' | 'startingFollowers'> & {
    followersGained?: number | undefined;
  }
): number {
  if (typeof page.followersGained === 'number') {
    return page.followersGained;
  }
  const current = page.currentFollowers ?? 0;
  const starting = page.startingFollowers ?? current;
  return current - starting;
}

export function formatFollowersGained(gained: number): string {
  if (gained > 0) {
    return `+${gained.toLocaleString('en-US')}`;
  }
  if (gained < 0) {
    return gained.toLocaleString('en-US');
  }
  return '0';
}

export function PageCard({
  page,
  subdomain,
  onSelectPage,
  forceAvatarError = false,
}: Readonly<PageCardProps>) {
  const [failedAvatarUrl, setFailedAvatarUrl] = React.useState<string | null>(
    forceAvatarError ? (page.profilePictureUrl ?? '__forced__') : null
  );

  const needsAttention = isPageNeedsAttention(page.status);
  const attentionMessage = getPageAttentionMessage(page.status);
  const statusLabel = getPageStatusLabel(page.status);
  const statusSignal = getPageStatusSignal(page.status);
  const ringClass = RING_CLASSES[statusSignal];

  const currentFollowers = page.currentFollowers ?? 0;
  const gained = computeFollowersGained(page);
  const formattedGained = formatFollowersGained(gained);

  const gainedClass =
    gained > 0
      ? 'text-brand-emerald'
      : gained < 0
        ? 'text-brand-rose'
        : 'text-ink-sub';

  const rawPageName = page.pageName.trim();
  const initials = rawPageName ? getUserInitials(rawPageName) : 'PG';
  const showAvatarImg =
    Boolean(page.profilePictureUrl) &&
    !forceAvatarError &&
    failedAvatarUrl !== page.profilePictureUrl;

  const targetHref = subdomain
    ? `/tenant/${subdomain}/pages/${page.id}`
    : `/pages/${page.id}`;

  const handleActivate = () => {
    if (onSelectPage) {
      onSelectPage(page);
    } else if (typeof window !== 'undefined') {
      window.location.href = targetHref;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      data-testid={`page-card-${page.id}`}
      data-href={targetHref}
      aria-label={`Open ${page.pageName} page details`}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex min-h-38 min-w-0 cursor-pointer flex-col justify-between rounded-md border bg-panel p-6 shadow-card transition outline-none hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
        needsAttention
          ? 'border-brand-rose hover:border-brand-rose'
          : 'border-line hover:border-brand-emerald/40'
      )}
    >
      {/* Top Section: Avatar with Dynamic Status Ring + Identity + Affordance */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {showAvatarImg ? (
              <Image
                src={page.profilePictureUrl!}
                alt={page.pageName}
                width={42}
                height={42}
                data-testid="page-avatar-img"
                onError={() =>
                  setFailedAvatarUrl(page.profilePictureUrl ?? '__error__')
                }
                className={cn('size-10.5 shrink-0 rounded-full object-cover', ringClass)}
              />
            ) : (
              <div
                data-testid="page-avatar-initials"
                className={cn(
                  'flex size-10.5 shrink-0 items-center justify-center rounded-full bg-subtle text-body font-bold text-ink',
                  ringClass
                )}
              >
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h3
                data-testid="page-name"
                className="m-0 truncate text-body font-semibold text-ink"
              >
                {page.pageName}
              </h3>
              <span
                data-testid="page-followers-line"
                className="mt-0.5 block truncate text-metadata text-ink-sub"
              >
                <span
                  data-testid="page-current-followers"
                  className="font-semibold text-ink tabular-nums"
                >
                  {currentFollowers.toLocaleString('en-US')}
                </span>{' '}
                followers
                <span data-testid="page-category">
                  {' '}
                  · {page.category || 'Facebook Page'}
                </span>
              </span>
              {formatPageIdSuffix(page.fbPageId) && (
                <span
                  data-testid="page-id-line"
                  className="mt-0.5 block truncate text-metadata text-ink-dim"
                >
                  Page ID {formatPageIdSuffix(page.fbPageId)}
                </span>
              )}
            </div>
          </div>

          <MoveUpRightIcon
            aria-hidden
            className="size-4 shrink-0 text-ink-dim transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
          />
        </div>

        {/* Rose Attention Standout Banner (if needs attention) */}
        {needsAttention && attentionMessage && (
          <div
            data-testid="page-attention-banner"
            className="mb-2 flex items-start gap-1 rounded-sm border border-brand-rose/25 bg-brand-rose/10 px-2.5 py-2 text-metadata leading-body font-medium text-brand-rose"
          >
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{attentionMessage}</span>
          </div>
        )}
      </div>

      {/* Symmetrical Two-Column Data Row (Precision Editorial) */}
      <div className="mt-4 flex items-end justify-between gap-4 pt-1">
        {/* Left Column: Followers Gain (rendered only when non-zero) */}
        <div className="min-w-0">
          {gained !== 0 && (
            <div
              data-testid="page-followers-gained"
              className={cn('mt-0.5 text-metadata tabular-nums', gainedClass)}
            >
              {formattedGained}
            </div>
          )}
        </div>

        {/* Right Column: Status (colour + icon + text) & Parent Account */}
        <div className="min-w-0 shrink-0 text-right">
          <StatusDot
            data-testid="page-status"
            status={statusSignal}
            label={statusLabel}
            className="font-semibold tracking-wide"
          />

          <div
            data-testid="page-parent-account"
            className="mt-0.5 max-w-45 truncate text-metadata text-ink-sub"
          >
            Account: {page.accountDisplayName || 'Connected Account'}
          </div>
        </div>
      </div>
    </div>
  );
}
