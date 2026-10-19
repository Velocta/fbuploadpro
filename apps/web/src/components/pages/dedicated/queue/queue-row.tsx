'use client';

import React from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
  STATUS_SIGNALS,
} from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatSlotLong, formatSlotShort } from '../composer/queue-slot-utils';
import { formatLabel } from '../bulk/bulk-utils';
import { resolveFormat } from './queue-logic';
import type { DedicatedQueueItem } from './queue-types';

export type QueueRowBucket = 'queued' | 'scheduled' | 'published' | 'failed';

export interface QueueRowProps {
  item: DedicatedQueueItem;
  timeZone: string;
  bucket: QueueRowBucket;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  reorderable: boolean;
  isDragOver: boolean;
  onDragStart: (id: string) => void;
  onDragOverRow: (id: string) => void;
  onDropOnRow: (id: string) => void;
  onDragEnd: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onEdit: (item: DedicatedQueueItem) => void;
  onReschedule: (item: DedicatedQueueItem) => void;
  onDelete: (item: DedicatedQueueItem) => void;
  onRetry: (item: DedicatedQueueItem) => void;
  retryBlocked: boolean;
  failedReason: string | null;
  busyAction: 'retry' | 'delete' | null;
}

const THUMBNAIL_SIZE = 56;

function StatusDot({ signal }: Readonly<{ signal: keyof typeof STATUS_SIGNALS }>) {
  return (
    <span
      aria-hidden="true"
      style={{ ...COMPONENT_STYLES.statusDot(signal), alignSelf: 'center' }}
    />
  );
}

function Thumbnail({ item }: Readonly<{ item: DedicatedQueueItem }>) {
  const format = resolveFormat(item);
  const thumbnailUrl = item.media?.thumbnailUrl ?? item.media?.url ?? null;
  const baseStyle: React.CSSProperties = {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: RADII.sm,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: `var(--text-sub, ${THEME.default.text.secondary})`,
  };

  if (format === 'text') {
    return (
      <div style={baseStyle} aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="16" y2="12" />
          <line x1="4" y1="17" x2="12" y2="17" />
        </svg>
      </div>
    );
  }

  if (thumbnailUrl) {
    return (
      <div style={baseStyle}>
        <img
          src={thumbnailUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div style={baseStyle} aria-hidden="true">
      {item.media?.mediaType === 'video' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )}
    </div>
  );
}

function DragHandle({
  onDragStart,
  onDragEnd,
}: Readonly<{
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}>) {
  return (
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title="Drag to reorder"
      aria-label="Drag to reorder"
      style={{
        cursor: 'grab',
        color: `var(--text-sub, ${THEME.default.text.secondary})`,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 2px',
        flexShrink: 0,
      }}
    >
      <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">
        <circle cx="4" cy="4" r="1.4" />
        <circle cx="10" cy="4" r="1.4" />
        <circle cx="4" cy="10" r="1.4" />
        <circle cx="10" cy="10" r="1.4" />
        <circle cx="4" cy="16" r="1.4" />
        <circle cx="10" cy="16" r="1.4" />
      </svg>
    </span>
  );
}

function MoveButton({
  direction,
  onClick,
  disabled,
}: Readonly<{
  direction: -1 | 1;
  onClick: () => void;
  disabled: boolean;
}>) {
  const label = direction === -1 ? 'Move up' : 'Move down';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled
          ? `var(--text-muted, ${THEME.default.text.muted})`
          : `var(--text-sub, ${THEME.default.text.secondary})`,
        padding: '2px',
        display: 'inline-flex',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        style={{ transform: direction === 1 ? 'rotate(180deg)' : undefined }}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}

const STATUS_SIGNAL: Record<QueueRowBucket, keyof typeof STATUS_SIGNALS> = {
  queued: 'queued',
  scheduled: 'queued',
  published: 'operational',
  failed: 'critical',
};

const STATUS_LABEL: Record<QueueRowBucket, string> = {
  queued: 'Queued',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
};

function timeText(item: DedicatedQueueItem, bucket: QueueRowBucket, timeZone: string): string {
  const date = new Date(item.scheduledTime);
  if (Number.isNaN(date.getTime())) return '';
  switch (bucket) {
    case 'queued':
    case 'failed':
      return formatSlotShort(date, timeZone);
    case 'scheduled':
      return `Scheduled for ${formatSlotLong(date, timeZone)}`;
    case 'published': {
      const published = item.publishedAt ? new Date(item.publishedAt) : date;
      return `Published ${formatSlotLong(Number.isNaN(published.getTime()) ? date : published, timeZone)}`;
    }
  }
}

export function QueueRow({
  item,
  timeZone,
  bucket,
  selectable,
  selected,
  onToggleSelect,
  reorderable,
  isDragOver,
  onDragStart,
  onDragOverRow,
  onDropOnRow,
  onDragEnd,
  onMove,
  onEdit,
  onReschedule,
  onDelete,
  onRetry,
  retryBlocked,
  failedReason,
  busyAction,
}: Readonly<QueueRowProps>) {
  const format = resolveFormat(item);
  const caption = (item.caption ?? '').trim();
  const actionsDisabled = busyAction !== null;

  return (
    <li
      data-testid={`queue-row-${item.id}`}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOverRow(item.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropOnRow(item.id);
      }}
      style={{
        listStyle: 'none',
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        padding: `${SPACING.md} 0`,
        borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        boxShadow: isDragOver ? `inset 0 2px 0 0 ${PALETTE.primary}` : undefined,
      }}
    >
      {selectable && (
        <span style={{ paddingTop: '2px', flexShrink: 0 }}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(item.id)}
            aria-label={caption ? `Select post: ${caption.slice(0, 40)}` : 'Select post'}
          />
        </span>
      )}

      {reorderable && (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <DragHandle
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              onDragStart(item.id);
            }}
            onDragEnd={onDragEnd}
          />
          <MoveButton direction={-1} onClick={() => onMove(item.id, -1)} disabled={actionsDisabled} />
          <MoveButton direction={1} onClick={() => onMove(item.id, 1)} disabled={actionsDisabled} />
        </span>
      )}

      <Thumbnail item={item} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              textTransform: 'uppercase',
              letterSpacing: TYPOGRAPHY.tracking.caption,
            }}
          >
            {formatLabel(format)}
          </span>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {timeText(item, bucket, timeZone)}
          </span>
        </div>

        {caption && (
          <p
            style={{
              margin: `${SPACING.xs} 0 0`,
              fontSize: '0.8125rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {caption}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.xs,
            marginTop: SPACING.xs,
          }}
        >
          <StatusDot signal={item.status === 'publishing' ? 'queued' : STATUS_SIGNAL[bucket]} />
          <span
            style={{
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            {item.status === 'publishing' ? 'Publishing' : STATUS_LABEL[bucket]}
          </span>
          {failedReason && (
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              — {failedReason}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.xs,
            marginTop: SPACING.xs,
            flexWrap: 'wrap',
          }}
        >
          {bucket === 'failed' && (
            <span
              style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}
              title={retryBlocked ? 'Reconnect your Facebook account to retry.' : undefined}
            >
              <Button
                variant="link"
                size="sm"
                disabled={retryBlocked || actionsDisabled}
                isLoading={busyAction === 'retry'}
                onClick={() => onRetry(item)}
              >
                Retry
              </Button>
              {retryBlocked && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  Reconnect your Facebook account to retry.
                </span>
              )}
            </span>
          )}
          <Button
            variant="link"
            size="sm"
            disabled={actionsDisabled}
            onClick={() => onEdit(item)}
          >
            Edit
          </Button>
          {(bucket === 'queued' || bucket === 'scheduled') && (
            <Button
              variant="link"
              size="sm"
              disabled={actionsDisabled}
              onClick={() => onReschedule(item)}
            >
              Reschedule
            </Button>
          )}
          <Button
            variant="link"
            size="sm"
            disabled={actionsDisabled}
            isLoading={busyAction === 'delete'}
            onClick={() => onDelete(item)}
          >
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}
