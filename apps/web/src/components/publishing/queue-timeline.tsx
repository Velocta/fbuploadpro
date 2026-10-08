'use client';

import React, { useState } from 'react';
import type { QueueItem } from '@fbuploadpro/contracts';

export interface QueueTimelineProps {
  items: QueueItem[];
  onPublishNow: (itemId: string) => Promise<void>;
  onSkip: (itemId: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

export function QueueTimeline({
  items,
  onPublishNow,
  onSkip,
  onDelete,
}: QueueTimelineProps) {
  const [filter, setFilter] = useState<'all' | 'queued' | 'published' | 'failed' | 'skipped'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const handleAction = async (action: () => Promise<void>, itemId: string) => {
    try {
      setActionLoadingId(itemId);
      await action();
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: QueueItem['status']) => {
    switch (status) {
      case 'queued':
        return { label: 'Queued', bg: '#e8f0fe', text: '#1a73e8' };
      case 'publishing':
        return { label: 'Publishing...', bg: '#fef7e0', text: '#b06000' };
      case 'published':
        return { label: 'Published', bg: '#e6f4ea', text: '#137333' };
      case 'failed':
        return { label: 'Failed', bg: '#fce8e6', text: '#c5221f' };
      case 'skipped':
      default:
        return { label: 'Skipped', bg: '#f1f3f4', text: '#5f6368' };
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #dadce0',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#202124' }}>
            Publishing Schedule & Queue
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#5f6368' }}>
            Chronological timeline of upcoming and dispatched Facebook posts
          </p>
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f1f3f4', padding: '0.25rem', borderRadius: '6px' }}>
          {(['all', 'queued', 'published', 'failed', 'skipped'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                padding: '0.3rem 0.65rem',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                backgroundColor: filter === tab ? '#ffffff' : 'transparent',
                color: filter === tab ? '#1a73e8' : '#5f6368',
                boxShadow: filter === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            border: '1px dashed #dadce0',
            borderRadius: '6px',
            color: '#5f6368',
            fontSize: '0.9rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500 }}>
            No scheduled items in the queue.
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#80868b' }}>
            Enqueue media assets to populate upcoming publishing slots.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredItems.map((item) => {
            const badge = getStatusBadge(item.status);
            const isBusy = actionLoadingId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  border: '1px solid #e8eaed',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  padding: '1rem',
                  gap: '1rem',
                  alignItems: 'flex-start',
                }}
              >
                {/* Thumbnail / Media Box */}
                <div
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '6px',
                    backgroundColor: '#f1f3f4',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {item.media?.thumbnailUrl || item.media?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.media.thumbnailUrl || item.media.url}
                      alt={item.media.name || 'Media'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.75rem' }}>
                      {item.media?.mediaType === 'video' ? '🎬' : '🖼️'}
                    </span>
                  )}
                  {item.media?.mediaType && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: '0.65rem',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      {item.media.mediaType}
                    </span>
                  )}
                </div>

                {/* Content Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.35rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        backgroundColor: badge.bg,
                        color: badge.text,
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {badge.label}
                    </span>

                    <span style={{ fontSize: '0.8rem', color: '#5f6368', fontWeight: 500 }}>
                      📅 {formatDateTime(item.scheduledTime)}
                    </span>

                    {item.media?.name && (
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: '#80868b',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '180px',
                        }}
                      >
                        {item.media.name}
                      </span>
                    )}

                    {item.retryCount > 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#d93025' }}>
                        (Retry {item.retryCount}/{item.maxRetries})
                      </span>
                    )}
                  </div>

                  {/* Caption */}
                  <p
                    style={{
                      margin: '0 0 0.4rem',
                      fontSize: '0.875rem',
                      color: '#202124',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.caption || <span style={{ color: '#80868b', fontStyle: 'italic' }}>No caption specified</span>}
                  </p>

                  {/* First Comment Callout */}
                  {item.firstComment && (
                    <div
                      style={{
                        backgroundColor: '#f8f9fa',
                        borderLeft: '3px solid #1877f2',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '0.8rem',
                        color: '#444',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <strong style={{ color: '#1877f2' }}>💬 First Comment: </strong>
                      <span>{item.firstComment}</span>
                    </div>
                  )}

                  {/* Facebook Post info */}
                  {item.fbPostId && (
                    <div style={{ fontSize: '0.75rem', color: '#137333', fontWeight: 600 }}>
                      Published Post ID: {item.fbPostId}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    alignItems: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  {(item.status === 'queued' || item.status === 'failed') && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAction(() => onPublishNow(item.id), item.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          backgroundColor: '#1877f2',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          opacity: isBusy ? 0.7 : 1,
                        }}
                      >
                        Publish Now
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAction(() => onSkip(item.id), item.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          backgroundColor: '#f1f3f4',
                          color: '#3c4043',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Skip
                      </button>
                    </>
                  )}

                  {item.status !== 'publishing' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(() => onDelete(item.id), item.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        backgroundColor: 'transparent',
                        color: '#d93025',
                        border: '1px solid #fad2cf',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
