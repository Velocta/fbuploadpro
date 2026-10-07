'use client';

import React from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';

export interface MediaGridProps {
  items: MediaItemResponse[];
  isLoading?: boolean;
  onSelectItem: (item: MediaItemResponse) => void;
  onDeleteQuick?: (itemId: string) => void;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '';
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function MediaGrid({
  items,
  isLoading = false,
  onSelectItem,
  onDeleteQuick,
}: MediaGridProps) {
  if (isLoading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '1.25rem',
          width: '100%',
        }}
      >
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              height: '240px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                height: '160px',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '0.8125rem',
              }}
            >
              Loading assets...
            </div>
            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ height: '0.875rem', width: '70%', backgroundColor: '#f1f5f9', borderRadius: '4px' }} />
              <div style={{ height: '0.75rem', width: '40%', backgroundColor: '#f8fafc', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 1rem',
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px dashed #cbd5e1',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>
          No media assets found
        </h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', maxWidth: '360px' }}>
          Upload short-form videos or images, or try adjusting your current folder and tag filters.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1.25rem',
        width: '100%',
      }}
    >
      {items.map((item) => {
        const isVideo = item.mediaType === 'video';
        const displayThumb = item.thumbnailUrl || (item.mediaType === 'image' ? item.url : null);
        const durationStr = formatDuration(item.durationSeconds);
        const sizeStr = formatFileSize(item.fileSize);

        return (
          <div
            key={item.id}
            onClick={() => onSelectItem(item)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {/* Thumbnail Header Area */}
            <div
              style={{
                position: 'relative',
                height: '160px',
                backgroundColor: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {displayThumb ? (
                <img
                  src={displayThumb}
                  alt={item.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  loading="lazy"
                />
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '2rem' }}>
                  {isVideo ? '🎬' : '🖼️'}
                </div>
              )}

              {/* Aspect Ratio Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  left: '0.5rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  letterSpacing: '0.025em',
                }}
              >
                {item.aspectRatio}
              </div>

              {/* Media Type & Duration Badge */}
              {isVideo && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '0.5rem',
                    right: '0.5rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(4px)',
                    color: '#ffffff',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span>▶</span>
                  {durationStr && <span>{durationStr}</span>}
                </div>
              )}
            </div>

            {/* Content Details */}
            <div
              style={{
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.375rem',
                flex: 1,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={item.name}
              >
                {item.name}
              </h4>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: '#64748b',
                }}
              >
                <span>{sizeStr}</span>
                <span>{item.mediaType}</span>
              </div>

              {/* Tags */}
              {item.tags.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.25rem',
                    marginTop: '0.25rem',
                  }}
                >
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.125rem 0.375rem',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        borderRadius: '0.25rem',
                      }}
                    >
                      {`#${tag}`}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: '#94a3b8',
                        padding: '0.125rem',
                      }}
                    >
                      {`+${item.tags.length - 3}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
