'use client';

import React, { useState } from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
  STATUS_SIGNALS,
} from '@/lib/theme';
import type { FacebookPageItem } from '../page-card';
import type { PostFormat } from '@fbuploadpro/contracts';

export interface PageQueueItemSummary {
  id: string;
  mediaId?: string | null;
  mediaType?: 'video' | 'image';
  postFormat?: PostFormat;
  linkUrl?: string | null;
  caption?: string | null;
  firstComment?: string | null;
  scheduledTime: string;
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'skipped' | 'cancelled';
  thumbnailUrl?: string | null;
}

export interface PageSlotSummary {
  id: string;
  slotTime: string;
  timezone: string;
  isActive: boolean;
  allowedFormats?: string[] | null;
}

export interface PageTabDashboardProps {
  page: FacebookPageItem;
  queueItems: PageQueueItemSummary[];
  slots: PageSlotSummary[];
  onPublishNow: (itemId: string) => Promise<void>;
  onSwitchTab: (tab: 'queue' | 'calendar' | 'insights' | 'settings') => void;
  onOpenAddQueue: () => void;
}

function formatItemBadge(item: PageQueueItemSummary): string {
  const fmt = item.postFormat || (item.mediaType === 'video' ? 'video' : 'image');
  return fmt === 'image' ? 'PHOTO' : fmt.toUpperCase();
}

export function PageTabDashboard({
  page,
  queueItems,
  slots,
  onPublishNow,
  onSwitchTab,
  onOpenAddQueue,
}: Readonly<PageTabDashboardProps>) {
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const activeQueuedItems = queueItems.filter((i) => i.status === 'queued');
  const nextItem = activeQueuedItems[0];
  const upcomingSlice = activeQueuedItems.slice(0, 3);
  const activeSlots = slots.filter((s) => s.isActive);

  const handlePublishClick = async (itemId: string) => {
    setPublishingId(itemId);
    try {
      await onPublishNow(itemId);
    } finally {
      setPublishingId(null);
    }
  };

  const isPaused = page.status === 'paused';
  const delta = page.followersGained ?? 0;
  const isPositiveGrowth = delta > 0;
  const isNegativeGrowth = delta < 0;

  let growthColor = 'inherit';
  if (isPositiveGrowth) {
    growthColor = PALETTE.accent4;
  } else if (isNegativeGrowth) {
    growthColor = PALETTE.accent3;
  }

  return (
    <div data-testid="page-tab-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
      {/* 4 Overview Metric Cards */}
      <div
        data-testid="dashboard-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: SPACING.md,
        }}
      >
        {/* Metric 1: Followers & Delta */}
        <div
          data-testid="metric-followers"
          style={{
            padding: SPACING.lg,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
            Total Followers
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACING.sm, marginTop: SPACING.xs }}>
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {page.currentFollowers?.toLocaleString() ?? 0}
            </span>
            {delta !== 0 && (
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: growthColor,
                }}
              >
                {isPositiveGrowth ? `+${delta}` : delta}
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Queued Posts */}
        <div
          data-testid="metric-queued-count"
          style={{
            padding: SPACING.lg,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
            Queued Content
          </span>
          <div style={{ marginTop: SPACING.xs }}>
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {activeQueuedItems.length}
            </span>
            <span style={{ fontSize: '0.8125rem', color: `var(--text-dim, ${THEME.default.text.muted})`, marginLeft: '6px' }}>
              posts scheduled
            </span>
          </div>
        </div>

        {/* Metric 3: Next Post */}
        <div
          data-testid="metric-next-post"
          style={{
            padding: SPACING.lg,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
            Next Publication
          </span>
          <div style={{ marginTop: SPACING.xs }}>
            <span
              style={{
                fontSize: nextItem ? '1.125rem' : '0.9375rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {nextItem
                ? new Date(nextItem.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'No posts in queue'}
            </span>
            {nextItem && (
              <span style={{ display: 'block', fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
                {new Date(nextItem.scheduledTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Metric 4: Automation State */}
        <div
          data-testid="metric-automation-status"
          style={{
            padding: SPACING.lg,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
            Edge Dispatcher
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: SPACING.xs }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isPaused ? STATUS_SIGNALS.queued.dot : STATUS_SIGNALS.operational.dot,
                boxShadow: isPaused ? STATUS_SIGNALS.queued.halo : STATUS_SIGNALS.operational.halo,
              }}
            />
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: isPaused ? PALETTE.primary : PALETTE.accent4,
              }}
            >
              {isPaused ? 'Paused' : 'Running'}
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Upcoming Queue vs Active Slots */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: SPACING.lg,
        }}
      >
        {/* Upcoming Queue Section */}
        <div
          data-testid="dashboard-upcoming-queue"
          style={{
            padding: SPACING.xl,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Upcoming Queue
            </h2>
            {activeQueuedItems.length > 0 && (
              <button
                type="button"
                data-testid="view-full-queue-btn"
                onClick={() => onSwitchTab('queue')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: PALETTE.primary,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                View full queue →
              </button>
            )}
          </div>

          {upcomingSlice.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${SPACING.xxl} 0`,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: RADII.sm,
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  marginBottom: SPACING.sm,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p style={{ margin: `0 0 ${SPACING.md} 0`, fontSize: '0.875rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                The publishing queue for this page is currently empty.
              </p>
              <button
                type="button"
                data-testid="dashboard-empty-queue-add-btn"
                onClick={onOpenAddQueue}
                style={{
                  ...COMPONENT_STYLES.primaryButton,
                  height: '32px',
                  padding: `0 ${SPACING.md}`,
                  fontSize: '0.8125rem',
                }}
              >
                Add Content to Queue
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
              {upcomingSlice.map((item) => (
                <div
                  key={item.id}
                  data-testid="dashboard-queue-item-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACING.md,
                    padding: SPACING.md,
                    backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    borderRadius: RADII.sm,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.xs }}>
                      <span
                        data-testid={`dashboard-item-format-${item.id}`}
                        style={{
                          padding: '1px 5px',
                          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                          borderRadius: RADII.xs,
                          fontSize: '0.625rem',
                          fontWeight: TYPOGRAPHY.weights.semibold,
                          letterSpacing: '0.04em',
                          color: `var(--text-sub, ${THEME.default.text.secondary})`,
                          textTransform: 'uppercase',
                        }}
                      >
                        {formatItemBadge(item)}
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          fontWeight: TYPOGRAPHY.weights.medium,
                          color: `var(--text-main, ${THEME.default.text.primary})`,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {item.caption || 'Untitled post'}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
                      Scheduled for {new Date(item.scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid={`publish-now-btn-${item.id}`}
                    disabled={publishingId === item.id}
                    onClick={() => handlePublishClick(item.id)}
                    style={{
                      ...COMPONENT_STYLES.secondaryButton(THEME.default),
                      height: '30px',
                      padding: `0 ${SPACING.sm}`,
                      fontSize: '0.75rem',
                      color: PALETTE.primary,
                      borderColor: 'rgba(250, 215, 52, 0.35)',
                      flexShrink: 0,
                    }}
                  >
                    {publishingId === item.id ? 'Publishing...' : 'Publish Now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Slots Section */}
        <div
          data-testid="dashboard-active-slots"
          style={{
            padding: SPACING.xl,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Daily Posting Times
            </h2>
            <button
              type="button"
              data-testid="view-full-schedule-btn"
              onClick={() => onSwitchTab('calendar')}
              style={{
                background: 'none',
                border: 'none',
                color: PALETTE.primary,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Manage times →
            </button>
          </div>

          {activeSlots.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${SPACING.xxl} 0`,
                textAlign: 'center',
              }}
            >
              <p style={{ margin: `0 0 ${SPACING.md} 0`, fontSize: '0.875rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                No active daily posting times defined yet.
              </p>
              <button
                type="button"
                data-testid="dashboard-setup-schedule-btn"
                onClick={() => onSwitchTab('calendar')}
                style={{
                  ...COMPONENT_STYLES.secondaryButton(THEME.default),
                  height: '32px',
                  padding: `0 ${SPACING.md}`,
                  fontSize: '0.8125rem',
                }}
              >
                Set Posting Times
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm }}>
              {activeSlots.map((slot) => (
                <div
                  key={slot.id}
                  data-testid="dashboard-slot-pill"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: `${SPACING.xs} ${SPACING.md}`,
                    backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    borderRadius: RADII.sm,
                    fontSize: '0.875rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{slot.slotTime}</span>
                  <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
                    {slot.timezone}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
