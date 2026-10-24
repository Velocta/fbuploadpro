'use client';

/**
 * Dedicated Page settings tab (spec 131 PR-131-3) — clean-room rebuild
 * on shared/ui primitives + tokens. Legacy file was read for
 * behavioural facts and copy only.
 *
 * Timezone (OD131-6, last-consumer duty): this tab was the legacy
 * `dedicated/schedule-timezone-modal.tsx`'s LAST remaining consumer
 * (134-2 rebuilt the other consumer and built the new flow under
 * `posting-times/timezone/`). This rebuild moves the settings tab onto
 * that rebuilt flow — identical props contract — and DELETES the
 * legacy modal file in this PR (zero-consumer grep in the PR body).
 * Stored timezone VALUES are never changed by the rebuild (Q2): the
 * value changes only through the user's explicit confirm, which runs
 * the frame's timezone mutation (`onUpdateTimezone`).
 *
 * Data: zero raw `fetch(` — the timezone impact counts load through
 * the typed client, failures are reported (never silent) and leave the
 * counts at their defaults, exactly the legacy non-blocking behaviour
 * minus its silent catches. The checkpoint banner's raw PATCH is
 * deleted; reactivation goes through `onStatusToggle` (the frame's
 * status mutation), as in the header. The disconnect confirmation is
 * the shared/ui alert-dialog pattern (UI Rule 3: verb-named confirm,
 * focus starts on Cancel, no outside-click/Esc dismissal).
 */

import * as React from 'react';

import { api, buildTenantApiPath } from '@/lib/api';
import {
  ListQueueItemsResponseSchema,
  ListQueueSlotsResponseSchema,
} from '@/lib/api/schemas/queue';
import { reportError } from '@/lib/report-error';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shared/ui/alert-dialog';
import { Banner } from '@/components/shared/ui/banner';
import { Button } from '@/components/shared/ui/button';
import { StatusDot, type Status } from '@/components/shared/ui/status-dot';
import { Switch } from '@/components/shared/ui/switch';
import type { FacebookPageItem } from '../page-card';
import { ScheduleTimezoneModal } from './posting-times/timezone/schedule-timezone-modal';

export interface PageTabSettingsProps {
  page: FacebookPageItem;
  subdomain: string;
  onStatusToggle: (nextStatus: 'active' | 'paused') => Promise<void>;
  onDisconnectPage: () => Promise<void>;
  onUpdateTimezone?: (newTimezone: string) => Promise<void>;
}

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Mirrors the single account-health model: Connected / Expired / Error.
function getSettingsStatusDetails(status: string): {
  isPaused: boolean;
  isNeedsAttention: boolean;
  status: Status;
  statusLabel: string;
} {
  const isPaused = status === 'paused';
  const isExpired = status === 'invalid_token';
  const isError = status === 'page_checkpoint' || status === 'fb_rate_limited';
  const isNeedsAttention = isExpired || isError;

  let signal: Status = 'operational';
  let label = 'Connected';

  if (isExpired) {
    signal = 'critical';
    label = 'Expired';
  } else if (isError) {
    signal = 'critical';
    label = 'Error';
  }

  return { isPaused, isNeedsAttention, status: signal, statusLabel: label };
}

const cardClass = 'rounded-md border border-line bg-panel p-6 shadow-card';
const detailTileClass = 'rounded-sm bg-active p-4';
const detailLabelClass = 'text-xs text-ink-sub';
const detailValueClass = 'mt-1 text-body font-medium text-ink';

export function PageTabSettings({
  page,
  subdomain,
  onStatusToggle,
  onDisconnectPage,
  onUpdateTimezone,
}: Readonly<PageTabSettingsProps>) {
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = React.useState(false);
  const [timezoneSlotsCount, setTimezoneSlotsCount] = React.useState(0);
  const [timezonePendingCount, setTimezonePendingCount] = React.useState(0);
  const [timezoneOverride, setTimezoneOverride] = React.useState<string | null>(null);

  const { isPaused, isNeedsAttention, status, statusLabel } = getSettingsStatusDetails(page.status);
  const displayedTimezone = timezoneOverride || page.timezone || detectBrowserTimezone();

  let automationStateLabel = isPaused ? 'Off' : 'On';
  if (isUpdatingStatus) {
    automationStateLabel = 'Updating…';
  }

  const isCheckpoint =
    page.status === 'page_checkpoint' || (page.status as string) === 'checkpoint_required';

  const handleToggleAutomation = async () => {
    setIsUpdatingStatus(true);
    try {
      await onStatusToggle(isPaused ? 'active' : 'paused');
    } finally {
      setIsUpdatingStatus(false);
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

  const handleOpenTimezoneModal = async () => {
    setIsTimezoneModalOpen(true);
    // Load real counts for the impact-review step; non-blocking on
    // failure (reported, defaults kept) as in the legacy tab.
    try {
      const slotsData = await api.get(
        buildTenantApiPath(subdomain, `/pages/${page.id}/slots`),
        { schema: ListQueueSlotsResponseSchema }
      );
      setTimezoneSlotsCount(slotsData.slots.length);
    } catch (error) {
      reportError(error, { source: 'page-settings-timezone-slots-count' });
    }
    try {
      const queueData = await api.get(
        buildTenantApiPath(subdomain, '/publishing/queue'),
        { schema: ListQueueItemsResponseSchema, query: { pageId: page.id } }
      );
      setTimezonePendingCount(
        queueData.items.filter(
          (item) => item.status === 'queued' || item.status === 'publishing'
        ).length
      );
    } catch (error) {
      reportError(error, { source: 'page-settings-timezone-queue-count' });
    }
  };

  const handleConfirmTimezone = async (newTimezone: string) => {
    if (!onUpdateTimezone) {
      throw new Error("Couldn't update the schedule timezone. Please try again.");
    }
    await onUpdateTimezone(newTimezone);
    setTimezoneOverride(newTimezone);
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await onDisconnectPage();
      setIsDisconnectDialogOpen(false);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div data-testid="page-tab-settings" className="flex flex-col gap-6">
      {/* Timezone line */}
      <div data-testid="settings-timezone-line" className="flex flex-wrap items-center gap-1.5 text-body text-ink-sub">
        <span>Times shown in</span>
        <span className="font-semibold text-ink">{displayedTimezone}</span>
        <span aria-hidden="true">—</span>
        <Button
          type="button"
          variant="link"
          data-testid="settings-change-timezone-btn"
          onClick={() => void handleOpenTimezoneModal()}
          className="h-11 px-1"
        >
          Change
        </Button>
      </div>

      {/* Checkpoint reactivation banner */}
      {isCheckpoint && (
        <div className="overflow-hidden rounded-md border border-line">
          <Banner
            variant="warning"
            data-testid="checkpoint-reactivation-banner"
            title="Facebook checkpoint verification required"
            description="Finish Facebook's identity check in the Facebook app or browser before automatic posting can continue."
            action={
              <Button
                type="button"
                data-testid="reactivate-page-btn"
                disabled={isUpdatingStatus}
                onClick={() => void handleReactivate()}
              >
                {isUpdatingStatus ? 'Reactivating...' : 'Mark verified and reactivate page'}
              </Button>
            }
          />
        </div>
      )}

      {/* 1. Automation state */}
      <div data-testid="settings-automation-card" className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
        <div className="max-w-xl">
          <h4 className="m-0 text-lg font-semibold text-ink">Automation</h4>
          <p className="mt-1 text-body leading-relaxed text-ink-sub">
            When automation is on, queued posts publish at your posting times. Pausing stops publishing without deleting your queue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            data-testid="toggle-automation-btn"
            aria-label="Automation"
            checked={!isPaused}
            disabled={isUpdatingStatus}
            onClick={() => void handleToggleAutomation()}
          />
          <span className="text-body font-semibold text-ink">{automationStateLabel}</span>
        </div>
      </div>

      {/* 2. Page connection details */}
      <div data-testid="settings-token-card" className={cardClass}>
        <div className="mb-4">
          <h4 className="m-0 text-lg font-semibold text-ink">Facebook page connection</h4>
          <p className="mt-1 text-body text-ink-sub">Your page details and connection status.</p>
        </div>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <div className={detailTileClass}>
            <span className={detailLabelClass}>Facebook Page ID</span>
            <div className={`${detailValueClass} font-mono`}>{page.fbPageId}</div>
          </div>

          <div className={detailTileClass}>
            <span className={detailLabelClass}>Linked Facebook Account</span>
            <div className={detailValueClass}>{page.accountDisplayName || 'Primary Administrator'}</div>
          </div>

          <div className={detailTileClass}>
            <span className={detailLabelClass}>Category</span>
            <div className={detailValueClass}>{page.category || 'General Page'}</div>
          </div>

          <div className={detailTileClass}>
            <span className={detailLabelClass}>Connection status</span>
            <div className="mt-1">
              <StatusDot status={status} label={statusLabel} className="text-body" />
            </div>
          </div>
        </div>

        {isNeedsAttention && (
          <div className="mt-4 overflow-hidden rounded-sm border border-line">
            <Banner
              variant="critical"
              data-testid="token-alert-banner"
              title="Your Facebook connection expired or needs attention. Reconnect it in the Facebook Accounts section to resume publishing."
            />
          </div>
        )}
      </div>

      {/* 3. Danger zone: disconnect page */}
      <div
        data-testid="settings-danger-zone"
        className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-brand-rose/40 bg-panel p-6 shadow-card"
      >
        <div className="max-w-xl">
          <h4 className="m-0 text-lg font-semibold text-brand-rose">Disconnect Facebook Page</h4>
          <p className="mt-1 text-body leading-relaxed text-ink-sub">
            Disconnecting this page stops automatic posting and cancels any queued posts.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          data-testid="disconnect-page-btn"
          onClick={() => setIsDisconnectDialogOpen(true)}
          className="border-brand-rose/50 text-brand-rose"
        >
          Disconnect Page
        </Button>
      </div>

      {/* Disconnect confirmation — alert-dialog pattern (UI Rule 3) */}
      <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
        <AlertDialogContent data-testid="disconnect-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {page.pageName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the Facebook Page from your workspace. Any queued posts will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-disconnect-btn" disabled={isDisconnecting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-disconnect-btn"
              disabled={isDisconnecting}
              onClick={() => void handleConfirmDisconnect()}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect Page'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Timezone change — the rebuilt 134-2 flow (OD131-6) */}
      <ScheduleTimezoneModal
        isOpen={isTimezoneModalOpen}
        activeTimezone={displayedTimezone}
        slotsCount={timezoneSlotsCount}
        pendingQueueCount={timezonePendingCount}
        onClose={() => setIsTimezoneModalOpen(false)}
        onConfirmTimezone={handleConfirmTimezone}
      />
    </div>
  );
}
