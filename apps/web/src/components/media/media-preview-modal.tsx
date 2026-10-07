'use client';

import React, { useState } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import { formatDuration, formatFileSize } from './media-grid';

export interface MediaPreviewModalProps {
  item: MediaItemResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (item: MediaItemResponse) => Promise<void> | void;
}

export function MediaPreviewModal({
  item,
  isOpen,
  onClose,
  onDelete,
}: MediaPreviewModalProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);

  if (!isOpen || !item) return null;

  const isVideo = item.mediaType === 'video';
  const sizeFormatted = formatFileSize(item.fileSize);
  const durationFormatted = formatDuration(item.durationSeconds);
  const formattedDate = new Date(item.createdAt).toLocaleString();

  const handleDeleteClick = async () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(item);
      setIsConfirmingDelete(false);
      onClose();
    } catch (_err) {
      // Handled by parent
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyCaption = () => {
    if (item.captionText && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(item.captionText);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          maxWidth: '960px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
            <span style={{ fontSize: '1.25rem' }}>{isVideo ? '🎬' : '🖼️'}</span>
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={item.name}
            >
              {item.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '1.5rem',
              color: '#94a3b8',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body: Split Media Player & Inspector */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
            flex: 1,
            overflow: 'auto',
          }}
        >
          {/* Left: Media Viewport */}
          <div
            style={{
              backgroundColor: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              minHeight: '380px',
            }}
          >
            {isVideo ? (
              <video
                src={item.url}
                poster={item.thumbnailUrl || undefined}
                controls
                playsInline
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                }}
              />
            ) : (
              <img
                src={item.url}
                alt={item.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                }}
              />
            )}
          </div>

          {/* Right: Technical Metadata Inspector */}
          <div
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              backgroundColor: '#ffffff',
              overflowY: 'auto',
            }}
          >
            {/* Metadata Group */}
            <div>
              <h4
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Technical Metadata
              </h4>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  backgroundColor: '#f8fafc',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8125rem',
                }}
              >
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>File Size</span>
                  <strong style={{ color: '#0f172a' }}>{sizeFormatted}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Aspect Ratio</span>
                  <strong style={{ color: '#0f172a' }}>{item.aspectRatio}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>MIME Type</span>
                  <strong style={{ color: '#0f172a' }}>{item.mimeType}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Duration</span>
                  <strong style={{ color: '#0f172a' }}>{durationFormatted || 'N/A'}</strong>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', display: 'block' }}>Uploaded</span>
                  <span style={{ color: '#0f172a' }}>{formattedDate}</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {item.tags.length > 0 && (
              <div>
                <h4
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Tags
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {item.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}
                    >
                      {`#${t}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Attached Caption Copy */}
            {item.captionText && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Default Caption Copy
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#2563eb',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {copiedCaption ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.8125rem',
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  {item.captionText}
                </div>
              </div>
            )}

            {/* Actions / Danger Zone */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
              {isConfirmingDelete ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: '#fee2e2',
                    borderRadius: '0.5rem',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#991b1b' }}>
                    Confirm permanent deletion? This purges the file from Cloudflare R2 and refunds your storage quota.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isDeleting}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        cursor: 'pointer',
                        flex: 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={isDeleting}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        fontWeight: 600,
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        flex: 1,
                      }}
                    >
                      {isDeleting ? 'Purging...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete Asset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
