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
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from './modal-styles';
import type { FacebookPageItem } from '../page-card';
import type { PostFormat } from '@fbuploadpro/contracts';

const QUEUE_EDIT_TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  padding: SPACING.sm,
  borderRadius: RADII.sm,
  backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
  color: `var(--text-main, ${THEME.default.text.primary})`,
  fontSize: '0.875rem',
  resize: 'vertical',
  boxSizing: 'border-box',
};

export interface DedicatedQueueItem {
  id: string;
  mediaId?: string | null;
  postFormat?: PostFormat;
  linkUrl?: string | null;
  caption?: string | null;
  firstComment?: string | null;
  scheduledTime: string;
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'skipped' | 'cancelled';
  retryCount?: number;
  maxRetries?: number;
  fbPostId?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  media?: {
    name: string;
    mediaType: 'video' | 'image';
    thumbnailUrl?: string | null;
    url: string;
    aspectRatio?: string;
    durationSeconds?: number | null;
  } | null;
}

export interface PageTabQueueProps {
  page: FacebookPageItem;
  queueItems: DedicatedQueueItem[];
  isLoading?: boolean;
  onPublishNow: (itemId: string) => Promise<void>;
  onUpdateItem: (itemId: string, data: { caption?: string; firstComment?: string | null }) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onOpenAddQueue: () => void;
}

function QueueItemThumbnailPreview({
  resolvedFormat,
  thumbnailUrl,
  mediaType,
}: {
  resolvedFormat: string;
  thumbnailUrl?: string | null | undefined;
  mediaType?: string | null | undefined;
}) {
  if (resolvedFormat === 'text') {
    return (
      <div
        style={{
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </div>
    );
  }

  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt="Media Preview"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }

  return (
    <div
      style={{
        color: `var(--text-sub, ${THEME.default.text.secondary})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {mediaType === 'video' ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )}
    </div>
  );
}

export function PageTabQueue({
  page: _page,
  queueItems,
  isLoading = false,
  onPublishNow,
  onUpdateItem,
  onDeleteItem,
  onOpenAddQueue,
}: Readonly<PageTabQueueProps>) {
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'queued' | 'published' | 'failed' | 'skipped' | 'cancelled'
  >('all');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<DedicatedQueueItem | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editFirstComment, setEditFirstComment] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DedicatedQueueItem | null>(null);

  const filteredItems = queueItems.filter((item) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'queued') return item.status === 'queued' || item.status === 'publishing';
    if (filterStatus === 'published') return item.status === 'published';
    if (filterStatus === 'failed') return item.status === 'failed';
    if (filterStatus === 'skipped') return item.status === 'skipped';
    if (filterStatus === 'cancelled') return item.status === 'cancelled';
    return true;
  });

  const handleOpenEdit = (item: DedicatedQueueItem) => {
    setEditingItem(item);
    setEditCaption(item.caption ?? '');
    setEditFirstComment(item.firstComment ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
      await onUpdateItem(editingItem.id, {
        caption: editCaption,
        firstComment: editFirstComment.trim() ? editFirstComment.trim() : null,
      });
      setEditingItem(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handlePublishNow = async (itemId: string) => {
    setPublishingId(itemId);
    try {
      await onPublishNow(itemId);
    } finally {
      setPublishingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeletingId(itemToDelete.id);
    try {
      await onDeleteItem(itemToDelete.id);
      setItemToDelete(null);
    } finally {
      setDeletingId(null);
    }
  };

  const formatScheduledDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return isoString;
    }
  };

  const getStatusSignal = (status: DedicatedQueueItem['status']) => {
    switch (status) {
      case 'published':
        return { signal: STATUS_SIGNALS.operational, label: 'Published' };
      case 'publishing':
        return { signal: STATUS_SIGNALS.queued, label: 'Publishing' };
      case 'failed':
        return { signal: STATUS_SIGNALS.critical, label: 'Failed' };
      case 'skipped':
        return { signal: STATUS_SIGNALS.idle, label: 'Skipped' };
      case 'cancelled':
        return { signal: STATUS_SIGNALS.idle, label: 'Cancelled' };
      case 'queued':
      default:
        return { signal: STATUS_SIGNALS.queued, label: 'Queued' };
    }
  };

  return (
    <div data-testid="page-tab-queue" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
      {/* Controls Bar: Filters & Add Action */}
      <div
        data-testid="queue-controls-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: SPACING.md,
        }}
      >
        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: SPACING.xs, alignItems: 'center' }}>
          {(['all', 'queued', 'published', 'failed', 'skipped', 'cancelled'] as const).map((filter) => {
            const isSelected = filterStatus === filter;
            const labels: Record<typeof filter, string> = {
              all: `All (${queueItems.length})`,
              queued: `Queued (${queueItems.filter((i) => i.status === 'queued' || i.status === 'publishing').length})`,
              published: `Published (${queueItems.filter((i) => i.status === 'published').length})`,
              failed: `Failed (${queueItems.filter((i) => i.status === 'failed').length})`,
              skipped: `Skipped (${queueItems.filter((i) => i.status === 'skipped').length})`,
              cancelled: `Cancelled (${queueItems.filter((i) => i.status === 'cancelled').length})`,
            };

            return (
              <button
                key={filter}
                type="button"
                data-testid={`filter-${filter}-btn`}
                onClick={() => setFilterStatus(filter)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  borderRadius: RADII.sm,
                  fontSize: '0.8125rem',
                  fontWeight: isSelected ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.medium,
                  backgroundColor: isSelected
                    ? `var(--bg-active, ${THEME.default.surfaces.active})`
                    : 'transparent',
                  color: isSelected
                    ? `var(--text-main, ${THEME.default.text.primary})`
                    : `var(--text-sub, ${THEME.default.text.secondary})`,
                  border: isSelected
                    ? `1px solid var(--border-focus, ${THEME.default.borders.focus})`
                    : `1px solid transparent`,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          data-testid="add-queue-button"
          onClick={onOpenAddQueue}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACING.xs,
            padding: `${SPACING.sm} ${SPACING.md}`,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add to Queue
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          data-testid="queue-loading-skeleton"
          style={{
            padding: SPACING.xl,
            textAlign: 'center',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.875rem',
          }}
        >
          Loading publishing queue...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredItems.length === 0 && (
        <div
          data-testid="queue-empty-state"
          style={{
            padding: SPACING.xxl,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px dashed var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: SPACING.md,
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: RADII.full,
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {filterStatus === 'all'
                ? 'Publishing queue is empty'
                : `No ${filterStatus} items found`}
            </h4>
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                maxWidth: '380px',
              }}
            >
              Schedule media from your asset library to schedule automated publication to this Facebook Page.
            </p>
          </div>
          <button
            type="button"
            data-testid="empty-add-queue-button"
            onClick={onOpenAddQueue}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              padding: `${SPACING.sm} ${SPACING.lg}`,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Schedule First Post
          </button>
        </div>
      )}

      {/* Queue Items List */}
      {!isLoading && filteredItems.length > 0 && (
        <div
          data-testid="queue-items-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.md,
          }}
        >
          {filteredItems.map((item) => {
            const isItemPublishing = publishingId === item.id || item.status === 'publishing';
            const isItemDeleting = deletingId === item.id;
            const isPublished = item.status === 'published';
            const { signal, label } = getStatusSignal(item.status);
            const resolvedFormat = item.postFormat ?? (item.media?.mediaType === 'video' ? 'video' : 'image');
            const mediaType = item.media?.mediaType ?? (resolvedFormat === 'video' || resolvedFormat === 'reel' ? 'video' : 'image');
            const thumbnailUrl = item.media?.thumbnailUrl || item.media?.url;

            return (
              <div
                key={item.id}
                data-testid={`queue-item-${item.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: SPACING.lg,
                  padding: SPACING.md,
                  backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  borderRadius: RADII.md,
                  boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
                  flexWrap: 'wrap',
                }}
              >
                {/* Left: Media Thumbnail & Content Information */}
                <div style={{ display: 'flex', gap: SPACING.md, flex: '1 1 340px', minWidth: '280px' }}>
                  {/* Media Thumbnail */}
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: RADII.sm,
                      backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                      overflow: 'hidden',
                      position: 'relative',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <QueueItemThumbnailPreview
                      resolvedFormat={resolvedFormat}
                      thumbnailUrl={thumbnailUrl}
                      mediaType={mediaType}
                    />
                    {/* Media Type Indicator */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        left: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        borderRadius: RADII.xs,
                        padding: '2px 4px',
                        fontSize: '0.6875rem',
                        fontWeight: TYPOGRAPHY.weights.semibold,
                        color: PALETTE.text,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {resolvedFormat === 'image' ? 'PHOTO' : resolvedFormat.toUpperCase()}
                    </div>
                  </div>

                  {/* Post Metadata, Caption, First Comment */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs, flex: 1 }}>
                    {/* Scheduled Time & Unboxed Status Dot */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
                      <span
                        data-testid={`queue-item-format-${item.id}`}
                        style={{
                          padding: '1px 5px',
                          backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                          borderRadius: RADII.xs,
                          fontSize: '0.625rem',
                          fontWeight: TYPOGRAPHY.weights.semibold,
                          letterSpacing: '0.04em',
                          color: `var(--text-sub, ${THEME.default.text.secondary})`,
                          textTransform: 'uppercase',
                        }}
                      >
                        {resolvedFormat === 'image' ? 'PHOTO' : resolvedFormat.toUpperCase()}
                      </span>

                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: TYPOGRAPHY.weights.semibold,
                          color: `var(--text-main, ${THEME.default.text.primary})`,
                        }}
                      >
                        {isPublished ? 'Published' : `Slot: ${formatScheduledDate(item.scheduledTime)}`}
                      </span>

                      {/* Unboxed 6px luminous dot */}
                      <div
                        data-testid={`queue-status-${item.id}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: signal.dot,
                            boxShadow: signal.halo,
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: TYPOGRAPHY.weights.medium,
                            color: signal.color,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    </div>

                    {/* Caption Preview */}
                    <p
                      data-testid={`queue-caption-${item.id}`}
                      style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        lineHeight: 1.45,
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.caption || (
                        <span style={{ color: `var(--text-sub, ${THEME.default.text.secondary})`, fontStyle: 'italic' }}>
                          No caption provided
                        </span>
                      )}
                    </p>

                    {/* First Comment Preview */}
                    {item.firstComment && (
                      <div
                        data-testid={`queue-first-comment-${item.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: SPACING.xs,
                          fontSize: '0.8125rem',
                          color: `var(--text-sub, ${THEME.default.text.secondary})`,
                          backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                          padding: `${SPACING.xs} ${SPACING.sm}`,
                          borderRadius: RADII.sm,
                          marginTop: '2px',
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ marginTop: '2px', flexShrink: 0 }}
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.firstComment}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions Group */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACING.sm,
                    flexShrink: 0,
                  }}
                >
                  {/* Publish Now (if not yet published) */}
                  {!isPublished && (
                    <button
                      type="button"
                      data-testid={`publish-now-btn-${item.id}`}
                      disabled={isItemPublishing}
                      onClick={() => handlePublishNow(item.id)}
                      style={{
                        ...COMPONENT_STYLES.primaryButton,
                        padding: `${SPACING.xs} ${SPACING.md}`,
                        fontSize: '0.8125rem',
                        fontWeight: TYPOGRAPHY.weights.semibold,
                        color: PALETTE.background,
                        cursor: isItemPublishing ? 'not-allowed' : 'pointer',
                        opacity: isItemPublishing ? 0.7 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: SPACING.xs,
                      }}
                    >
                      {isItemPublishing ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="2" x2="12" y2="6" />
                            <line x1="12" y1="18" x2="12" y2="22" />
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                          </svg>
                          Publishing...
                        </>
                      ) : (
                        'Publish Now'
                      )}
                    </button>
                  )}

                  {/* Edit Caption / First Comment */}
                  {!isPublished && (
                    <button
                      type="button"
                      data-testid={`edit-queue-btn-${item.id}`}
                      onClick={() => handleOpenEdit(item)}
                      style={{
                        padding: `${SPACING.xs} ${SPACING.sm}`,
                        borderRadius: RADII.sm,
                        fontSize: '0.8125rem',
                        fontWeight: TYPOGRAPHY.weights.medium,
                        backgroundColor: 'transparent',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Edit
                    </button>
                  )}

                  {/* Delete / Cancel Item */}
                  <button
                    type="button"
                    data-testid={`delete-queue-btn-${item.id}`}
                    disabled={isItemDeleting}
                    onClick={() => setItemToDelete(item)}
                    style={{
                      padding: `${SPACING.xs} ${SPACING.sm}`,
                      borderRadius: RADII.sm,
                      fontSize: '0.8125rem',
                      fontWeight: TYPOGRAPHY.weights.medium,
                      backgroundColor: 'transparent',
                      color: PALETTE.accent3,
                      border: `1px solid rgba(239, 68, 68, 0.25)`,
                      cursor: isItemDeleting ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal Dialog */}
      {editingItem && (
        <div
          data-testid="edit-queue-modal-backdrop"
          style={MODAL_BACKDROP_STYLE}
        >
          <div
            data-testid="edit-queue-modal"
            style={{
              ...MODAL_CONTAINER_STYLE,
              maxWidth: '540px',
              gap: SPACING.lg,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                }}
              >
                Edit Queued Post
              </h3>
              <button
                type="button"
                data-testid="close-edit-modal-btn"
                onClick={() => setEditingItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  cursor: 'pointer',
                  padding: SPACING.xs,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Caption Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
              <label
                htmlFor="edit-caption-field"
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                Post Caption
              </label>
              <textarea
                id="edit-caption-field"
                data-testid="edit-caption-input"
                rows={4}
                value={editCaption}
                maxLength={5000}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Write a caption for this post..."
                style={QUEUE_EDIT_TEXTAREA_STYLE}
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  alignSelf: 'flex-end',
                }}
              >
                {editCaption.length} / 5000
              </span>
            </div>

            {/* First Comment Input / Story Notice */}
            {editingItem?.postFormat === 'story' ? (
              <div
                data-testid="story-no-comment-notice"
                style={{
                  padding: SPACING.sm,
                  borderRadius: RADII.sm,
                  backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                }}
              >
                Facebook Stories do not support comments.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
                <label
                  htmlFor="edit-first-comment-field"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  Automated First Comment (Optional)
                </label>
                <textarea
                  id="edit-first-comment-field"
                  data-testid="edit-first-comment-input"
                  rows={2}
                  value={editFirstComment}
                  maxLength={2000}
                  onChange={(e) => setEditFirstComment(e.target.value)}
                  placeholder="Links, hashtags, or supplementary notes..."
                  style={QUEUE_EDIT_TEXTAREA_STYLE}
                />
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    alignSelf: 'flex-end',
                  }}
                >
                  {editFirstComment.length} / 2000
                </span>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
              <button
                type="button"
                data-testid="cancel-edit-btn"
                onClick={() => setEditingItem(null)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  borderRadius: RADII.sm,
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  backgroundColor: 'transparent',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="save-edit-btn"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                style={{
                  ...COMPONENT_STYLES.primaryButton,
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  cursor: isSavingEdit ? 'not-allowed' : 'pointer',
                  opacity: isSavingEdit ? 0.7 : 1,
                }}
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <div
          data-testid="delete-confirm-backdrop"
          style={MODAL_BACKDROP_STYLE}
        >
          <div
            data-testid="delete-confirm-dialog"
            style={{
              ...MODAL_CONTAINER_STYLE,
              maxWidth: '440px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Remove from Queue
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to remove this scheduled item? This post will not be published to your Facebook Page.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm }}>
              <button
                type="button"
                data-testid="cancel-delete-btn"
                onClick={() => setItemToDelete(null)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  borderRadius: RADII.sm,
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  backgroundColor: 'transparent',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  cursor: 'pointer',
                }}
              >
                Keep Item
              </button>
              <button
                type="button"
                data-testid="confirm-delete-btn"
                onClick={handleConfirmDelete}
                style={{
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  borderRadius: RADII.sm,
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  backgroundColor: PALETTE.accent3,
                  color: PALETTE.text,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Remove Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
