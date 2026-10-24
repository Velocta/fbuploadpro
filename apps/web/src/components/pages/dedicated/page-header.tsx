'use client';

/**
 * Dedicated Page identity header (spec 131 PR-131-3) — clean-room
 * rebuild on shared/ui primitives + tokens, adopting the canonical
 * §1.3 identity-header pattern landed by PR-131-4 in the destinations
 * frame: platform icon + avatar + full name in a fixed position
 * (UX Rule 1), status as colour + icon + text (OD-3 / UX Rule 27 —
 * never colour alone). Legacy file was read for behavioural facts and
 * copy only.
 *
 * Data: the header holds NO fetch of its own — the former checkpoint
 * banner's raw PATCH is deleted; reactivation goes through the frame's
 * status mutation via `onStatusToggle` (the typed data layer), exactly
 * as the Settings tab's copy of the banner already did in effect.
 * The actions menu is the shared/ui Menu (Radix) — the hand-rolled
 * dropdown and its document listeners are deleted with it.
 */

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
  MoreVerticalIcon,
  PlusIcon,
  PowerIcon,
} from 'lucide-react';

import { reportError } from '@/lib/report-error';
import { Banner } from '@/components/shared/ui/banner';
import { Button } from '@/components/shared/ui/button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/shared/ui/menu';
import { StatusDot, type Status } from '@/components/shared/ui/status-dot';
import { cn } from '@/lib/utils';
import type { FacebookPageItem } from '../page-card';

export interface DedicatedPageHeaderProps {
  page: FacebookPageItem;
  subdomain: string;
  onStatusToggle: (nextStatus: 'active' | 'paused') => Promise<void>;
  onOpenAddQueue: () => void;
  onDisconnectRequest: () => void;
}

interface PageStatusDetails {
  isPaused: boolean;
  status: Status;
  statusLabel: string;
  ringClass: string;
}

function resolvePageStatus(status: FacebookPageItem['status']): PageStatusDetails {
  if (
    status === 'invalid_token' ||
    status === 'page_checkpoint' ||
    status === 'fb_rate_limited'
  ) {
    return {
      isPaused: false,
      status: 'critical',
      statusLabel: 'Needs Attention',
      ringClass: 'ring-signal-critical',
    };
  }

  if (status === 'paused') {
    return {
      isPaused: true,
      status: 'queued',
      statusLabel: 'Paused',
      ringClass: 'ring-signal-queued',
    };
  }

  if (status === 'active') {
    return {
      isPaused: false,
      status: 'operational',
      statusLabel: 'Active',
      ringClass: 'ring-signal-operational',
    };
  }

  return {
    isPaused: false,
    status: 'idle',
    statusLabel: 'Active',
    ringClass: 'ring-line',
  };
}

/** Facebook glyph in the platform-nav-config icon style (lucide ships
 * no brand icons) — same local glyph as PR-131-4's destination frame. */
function FacebookPlatformIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function DedicatedAvatar({
  page,
  ringClass,
  monogram,
}: Readonly<{ page: FacebookPageItem; ringClass: string; monogram: string }>) {
  const [failedAvatarUrl, setFailedAvatarUrl] = React.useState<string | null>(null);

  if (page.profilePictureUrl && failedAvatarUrl !== page.profilePictureUrl) {
    return (
      <Image
        src={page.profilePictureUrl}
        alt={page.pageName}
        data-testid="dedicated-page-avatar"
        width={44}
        height={44}
        onError={() => setFailedAvatarUrl(page.profilePictureUrl ?? '__error__')}
        className={cn('size-11 shrink-0 rounded-md object-cover ring-2', ringClass)}
      />
    );
  }

  return (
    <div
      data-testid="dedicated-page-avatar-fallback"
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-md bg-subtle text-body font-bold text-brand-gold ring-2',
        ringClass
      )}
    >
      {monogram}
    </div>
  );
}

export function DedicatedPageHeader({
  page,
  subdomain,
  onStatusToggle,
  onOpenAddQueue,
  onDisconnectRequest,
}: Readonly<DedicatedPageHeaderProps>) {
  const router = useRouter();
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [hasCopiedId, setHasCopiedId] = React.useState(false);

  const statusInfo = resolvePageStatus(page.status);
  const monogram = (page.pageName || 'P').slice(0, 2).toUpperCase();
  const fbPageUrl = `https://facebook.com/${page.fbPageId}`;

  const isCheckpoint =
    page.status === 'page_checkpoint' ||
    (page.status as string) === 'checkpoint_required';

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(page.fbPageId);
      setHasCopiedId(true);
      setTimeout(() => setHasCopiedId(false), 2000);
    } catch (error) {
      reportError(error, { source: 'page-header-copy-id' });
    }
  };

  const handleReactivate = async () => {
    setIsUpdatingStatus(true);
    try {
      await onStatusToggle('active');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div data-testid="dedicated-page-header" className="mb-6">
      {/* Quiet back link */}
      <div className="mb-4">
        <button
          type="button"
          data-testid="back-to-pages-link"
          onClick={() => router.push(`/tenant/${subdomain}/pages`)}
          className="inline-flex min-h-11 items-center gap-1 px-1 text-body font-medium text-ink-sub transition-colors hover:text-ink"
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
          <span>Facebook Pages</span>
        </button>
      </div>

      {/* Checkpoint reactivation banner */}
      {isCheckpoint && (
        <div className="mb-4 overflow-hidden rounded-md border border-line">
          <Banner
            variant="warning"
            data-testid="checkpoint-reactivation-banner"
            title="Facebook Checkpoint Verification Required"
            description="Facebook requires verification in the mobile app or browser before automated publishing can resume."
            action={
              <Button
                type="button"
                data-testid="reactivate-page-btn"
                disabled={isUpdatingStatus}
                onClick={() => void handleReactivate()}
              >
                {isUpdatingStatus ? 'Reactivating...' : 'Mark Verified & Reactivate Page'}
              </Button>
            }
          />
        </div>
      )}

      {/* Main header: identity left, actions right */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center text-ink-sub">
            <FacebookPlatformIcon />
          </span>
          <DedicatedAvatar page={page} ringClass={statusInfo.ringClass} monogram={monogram} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                data-testid="dedicated-page-heading"
                className="m-0 truncate text-xxl font-bold tracking-h1 text-ink"
              >
                {page.pageName}
              </h1>
              <a
                href={fbPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="page-live-link"
                title="View live Page on Facebook"
                aria-label={`View ${page.pageName} live on Facebook`}
                className="inline-flex size-11 items-center justify-center text-ink-dim transition-colors hover:text-ink"
              >
                <ExternalLinkIcon className="size-4" aria-hidden />
              </a>
            </div>

            {/* Sub-row: status (colour + icon + text) + account + followers + category */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-body text-ink-sub">
              <span data-testid="dedicated-page-status" className="inline-flex items-center">
                <StatusDot status={statusInfo.status} label={statusInfo.statusLabel} />
              </span>

              {page.accountDisplayName && (
                <>
                  <span aria-hidden className="h-3 w-px shrink-0 bg-line" />
                  <span>Connected via {page.accountDisplayName}</span>
                </>
              )}

              {typeof page.currentFollowers === 'number' && (
                <>
                  <span aria-hidden className="h-3 w-px shrink-0 bg-line" />
                  <span>{page.currentFollowers.toLocaleString('en-US')} followers</span>
                </>
              )}

              {page.category && (
                <>
                  <span aria-hidden className="h-3 w-px shrink-0 bg-line" />
                  <span>{page.category}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions cluster */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="header-automation-status"
            className="inline-flex h-11 items-center text-body font-medium text-ink-sub"
          >
            {statusInfo.isPaused ? 'Automation off' : 'Automation on'}
          </span>

          <Button type="button" data-testid="header-add-queue-btn" onClick={onOpenAddQueue}>
            <PlusIcon aria-hidden />
            <span>Queue Post</span>
          </Button>

          <Menu>
            <MenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                data-testid="header-settings-dropdown-btn"
                aria-label="Page actions menu"
              >
                <MoreVerticalIcon aria-hidden />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem data-testid="header-menu-copy-id-btn" onSelect={() => void handleCopyId()}>
                <CopyIcon aria-hidden />
                <span>{hasCopiedId ? 'Page ID Copied' : 'Copy Page ID'}</span>
              </MenuItem>
              <MenuItem asChild>
                <a href={fbPageUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon aria-hidden />
                  <span>Open on Facebook</span>
                </a>
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                variant="destructive"
                data-testid="header-menu-disconnect-btn"
                onSelect={onDisconnectRequest}
              >
                <PowerIcon aria-hidden />
                <span>Disconnect Page</span>
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
    </div>
  );
}
