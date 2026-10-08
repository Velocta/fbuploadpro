'use client';

import React, { useState, useEffect } from 'react';
import type { FacebookPageView, MediaItemResponse, CaptionTemplateResponse } from '@fbuploadpro/contracts';

export interface EnqueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: FacebookPageView[];
  mediaItems: MediaItemResponse[];
  captionTemplates: CaptionTemplateResponse[];
  selectedPageId?: string | undefined;
  onSubmit: (data: {
    pageId: string;
    mediaId: string;
    caption: string;
    firstComment?: string | undefined;
    scheduledTime?: string | undefined;
  }) => Promise<void>;
}

export function EnqueueModal({
  isOpen,
  onClose,
  pages,
  mediaItems,
  captionTemplates,
  selectedPageId,
  onSubmit,
}: EnqueueModalProps) {
  const [pageId, setPageId] = useState('');
  const [mediaId, setMediaId] = useState('');
  const [caption, setCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPageId(selectedPageId || (pages.length > 0 ? pages[0].id : ''));
      setMediaId(mediaItems.length > 0 ? mediaItems[0].id : '');
      setCaption('');
      setFirstComment('');
      setScheduledTime('');
      setError(null);
    }
  }, [isOpen, selectedPageId, pages, mediaItems]);

  if (!isOpen) return null;

  const handleApplyTemplate = (templateContent: string) => {
    setCaption(templateContent);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pageId) {
      setError('Please select a target Facebook Page.');
      return;
    }
    if (!mediaId) {
      setError('Please select a media asset to enqueue.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: {
        pageId: string;
        mediaId: string;
        caption: string;
        firstComment?: string | undefined;
        scheduledTime?: string | undefined;
      } = {
        pageId,
        mediaId,
        caption: caption.trim(),
      };
      if (firstComment.trim()) {
        payload.firstComment = firstComment.trim();
      }
      if (scheduledTime) {
        payload.scheduledTime = new Date(scheduledTime).toISOString();
      }
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to enqueue media asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMedia = mediaItems.find((m) => m.id === mediaId);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#202124' }}>
              Enqueue Media for Publishing
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#5f6368' }}>
              Assign to upcoming slot with automated first comment
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#5f6368',
              padding: '0.25rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {error && (
            <div
              style={{
                padding: '0.65rem 0.9rem',
                backgroundColor: '#fce8e6',
                color: '#c5221f',
                borderRadius: '4px',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Facebook Page Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#202124' }}>
              Target Facebook Page *
            </label>
            {pages.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#d93025' }}>
                No connected Facebook Pages found. Please connect a Page in Facebook Channels first.
              </p>
            ) : (
              <select
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                required
                style={{
                  padding: '0.5rem',
                  border: '1px solid #dadce0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  backgroundColor: '#fff',
                }}
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pageName} ({p.category || 'Page'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Media Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#202124' }}>
              Select Media Asset *
            </label>
            {mediaItems.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#d93025' }}>
                No assets in Media Library. Please upload images or videos first.
              </p>
            ) : (
              <>
                <select
                  value={mediaId}
                  onChange={(e) => setMediaId(e.target.value)}
                  required
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    backgroundColor: '#fff',
                  }}
                >
                  {mediaItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} [{m.mediaType.toUpperCase()}] ({m.aspectRatio || 'original'})
                    </option>
                  ))}
                </select>

                {/* Selected Preview Snippet */}
                {selectedMedia && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      border: '1px solid #e8eaed',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '4px',
                        backgroundColor: '#e0e0e0',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selectedMedia.thumbnailUrl || selectedMedia.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedMedia.thumbnailUrl || selectedMedia.url}
                          alt={selectedMedia.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span>{selectedMedia.mediaType === 'video' ? '🎬' : '🖼️'}</span>
                      )}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#202124',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {selectedMedia.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#5f6368' }}>
                        Type: {selectedMedia.mediaType.toUpperCase()} | Ratio: {selectedMedia.aspectRatio}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Caption & Templates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#202124' }}>
                Post Caption
              </label>
              {captionTemplates.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#5f6368' }}>Insert Saved Template:</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleApplyTemplate(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.4rem',
                      border: '1px solid #dadce0',
                      borderRadius: '4px',
                      backgroundColor: '#fff',
                    }}
                  >
                    <option value="" disabled>
                      Select...
                    </option>
                    {captionTemplates.map((t) => (
                      <option key={t.id} value={t.content}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write captivating post caption or select template..."
              rows={3}
              maxLength={5000}
              style={{
                padding: '0.5rem',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <span style={{ fontSize: '0.7rem', color: '#80868b', alignSelf: 'flex-end' }}>
              {caption.length}/5000
            </span>
          </div>

          {/* Optional First Comment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#202124' }}>
              Automated First Comment (Optional)
            </label>
            <input
              type="text"
              value={firstComment}
              onChange={(e) => setFirstComment(e.target.value)}
              placeholder="e.g. Link in bio: https://example.com/promo #exclusive"
              maxLength={2000}
              style={{
                padding: '0.5rem',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#5f6368' }}>
              Posted to Facebook automatically within seconds of post going live.
            </span>
          </div>

          {/* Optional Custom Schedule Time */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#202124' }}>
              Custom Schedule Time (Optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              style={{
                padding: '0.45rem',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                fontSize: '0.85rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#80868b' }}>
              Leave blank to automatically calculate and assign to the next vacant recurring slot.
            </span>
          </div>

          {/* Token Deduction Notice */}
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#e8f0fe',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#1967d2',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>⚡</span>
            <span>
              <strong>Billing Assurance:</strong> Exactly 1 token will be deducted strictly upon verified post publication to Facebook. Zero charge on failures.
            </span>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.5rem',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f1f3f4',
                color: '#3c4043',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || pages.length === 0 || mediaItems.length === 0}
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: '#1877f2',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Enqueueing...' : 'Enqueue Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
