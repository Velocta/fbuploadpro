'use client';

import React, { useState, useEffect } from 'react';
import type { PostFormat } from '@fbuploadpro/contracts';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from './modal-styles';
import type { PageSlotSummary } from './tab-dashboard';

export interface EnqueueMediaItemOption {
  id: string;
  name: string;
  mediaType: 'video' | 'image';
  thumbnailUrl?: string | null;
  url: string;
  caption?: string | null;
  firstComment?: string | null;
}

export interface EnqueueModalProps {
  pageId: string;
  subdomain: string;
  slots: PageSlotSummary[];
  isOpen: boolean;
  onClose: () => void;
  onEnqueued: () => void;
}

export function EnqueueModal({
  pageId,
  subdomain,
  slots,
  isOpen,
  onClose,
  onEnqueued,
}: Readonly<EnqueueModalProps>) {
  const [selectedFormat, setSelectedFormat] = useState<PostFormat>('reel');
  const [mediaList, setMediaList] = useState<EnqueueMediaItemOption[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [isCaptionDirty, setIsCaptionDirty] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFormat('reel');
      setSelectedMediaId(null);
      setSelectedSlotId('');
      setCaption('');
      setIsCaptionDirty(false);
      setLinkUrl('');
      setFirstComment('');
      setError(null);
      return;
    }

    let active = true;
    const fetchMedia = async () => {
      setIsLoadingMedia(true);
      setError(null);
      try {
        const res = await fetch(`/api/tenant/${subdomain}/media?limit=50`);
        if (!res.ok) throw new Error('Failed to load media assets');
        const data = await res.json();
        if (active) {
          const items: EnqueueMediaItemOption[] = (data.items || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            mediaType: m.mediaType,
            thumbnailUrl: m.thumbnailUrl,
            url: m.url,
            caption: m.captionText ?? m.caption ?? null,
            firstComment: m.firstComment,
          }));
          setMediaList(items);
          if (items.length > 0) {
            setSelectedMediaId((prevId) => {
              if (prevId) return prevId;
              setCaption((prevCap) => (prevCap ? prevCap : items[0].caption || ''));
              setFirstComment((prevComm) => (prevComm ? prevComm : items[0].firstComment || ''));
              return items[0].id;
            });
          }
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Unable to retrieve media assets');
      } finally {
        if (active) setIsLoadingMedia(false);
      }
    };

    void fetchMedia();
    return () => {
      active = false;
    };
  }, [isOpen, subdomain]);

  if (!isOpen) return null;

  const handleSelectMedia = (m: EnqueueMediaItemOption) => {
    setSelectedMediaId(m.id);
    if (!isCaptionDirty) {
      setCaption(m.caption || '');
    }
    if (!firstComment && m.firstComment) {
      setFirstComment(m.firstComment);
    }
    if (m.mediaType === 'image' && (selectedFormat === 'reel' || selectedFormat === 'video')) {
      setSelectedFormat('image');
    } else if (m.mediaType === 'video' && selectedFormat === 'image') {
      setSelectedFormat('reel');
    }
  };

  const handleSelectFormat = (fmt: PostFormat) => {
    setSelectedFormat(fmt);
    if (fmt === 'text') {
      setSelectedMediaId(null);
    } else if (selectedMediaId) {
      const current = mediaList.find((m) => m.id === selectedMediaId);
      if (current) {
        if (fmt === 'image' && current.mediaType === 'video') {
          const firstImg = mediaList.find((m) => m.mediaType === 'image');
          setSelectedMediaId(firstImg ? firstImg.id : null);
        } else if ((fmt === 'reel' || fmt === 'video') && current.mediaType === 'image') {
          const firstVid = mediaList.find((m) => m.mediaType === 'video');
          setSelectedMediaId(firstVid ? firstVid.id : null);
        }
      }
    } else {
      if (fmt === 'image') {
        const firstImg = mediaList.find((m) => m.mediaType === 'image');
        if (firstImg) setSelectedMediaId(firstImg.id);
      } else if (fmt === 'reel' || fmt === 'video') {
        const firstVid = mediaList.find((m) => m.mediaType === 'video');
        if (firstVid) setSelectedMediaId(firstVid.id);
      }
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedFormat !== 'text' && !selectedMediaId) {
      setError('Please select a media item to enqueue');
      return;
    }
    if (selectedFormat === 'text' && (!caption || caption.trim().length === 0)) {
      setError('Caption is required for text posts');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        pageId,
        caption,
        postFormat: selectedFormat,
      };

      if (selectedFormat !== 'text' && selectedMediaId) {
        payload.mediaId = selectedMediaId;
      }

      if (linkUrl.trim()) {
        payload.linkUrl = linkUrl.trim();
      }

      if (selectedFormat !== 'story' && firstComment.trim()) {
        payload.firstComment = firstComment.trim();
      }

      if (selectedSlotId) {
        payload.slotId = selectedSlotId;
      }

      const res = await fetch(`/api/tenant/${subdomain}/publishing/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to enqueue post');
      }

      onEnqueued();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule media post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSlots = slots.filter((s) => s.isActive);

  const renderMediaList = () => {
    if (isLoadingMedia) {
      return (
        <div
          style={{
            padding: SPACING.lg,
            textAlign: 'center',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.8125rem',
          }}
        >
          Loading media assets...
        </div>
      );
    }

    if (mediaList.length === 0) {
      return (
        <div
          style={{
            padding: SPACING.lg,
            textAlign: 'center',
            backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
            borderRadius: RADII.sm,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.8125rem',
          }}
        >
          No media assets found in library. Upload media first in the Media Library tab.
        </div>
      );
    }

    return (
      <div
        data-testid="enqueue-media-picker-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: SPACING.xs,
          maxHeight: '160px',
          overflowY: 'auto',
          padding: '4px',
          backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
          borderRadius: RADII.sm,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        }}
      >
        {mediaList.map((media) => {
          const isSelected = selectedMediaId === media.id;
          const thumb = media.thumbnailUrl || media.url;

          return (
            <button
              key={media.id}
              type="button"
              data-testid={`media-pick-btn-${media.id}`}
              onClick={() => handleSelectMedia(media)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: RADII.xs,
                overflow: 'hidden',
                border: isSelected
                  ? `2px solid ${PALETTE.primary}`
                  : `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                padding: 0,
                cursor: 'pointer',
              }}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={media.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  {media.mediaType}
                </div>
              )}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: PALETTE.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: '#000',
                    fontWeight: 'bold',
                  }}
                >
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      data-testid="enqueue-modal-backdrop"
      style={MODAL_BACKDROP_STYLE}
    >
      <div
        data-testid="enqueue-modal"
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          gap: SPACING.lg,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Add Media to Queue
            </h3>
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Select content from your media library to schedule for automated publishing.
            </p>
          </div>
          <button
            type="button"
            data-testid="close-enqueue-modal-btn"
            onClick={onClose}
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

        {error && (
          <div
            data-testid="enqueue-modal-error"
            style={{
              padding: SPACING.sm,
              borderRadius: RADII.sm,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: PALETTE.accent3,
              fontSize: '0.8125rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {/* Format Selector Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Post Format
            </span>
            <div
              data-testid="enqueue-format-selector"
              style={{
                display: 'flex',
                gap: SPACING.xs,
                flexWrap: 'wrap',
              }}
            >
              {[
                { id: 'reel', label: 'Reel', testId: 'enqueue-format-reel' },
                { id: 'video', label: 'Video', testId: 'enqueue-format-video' },
                { id: 'image', label: 'Photo', testId: 'enqueue-format-image' },
                { id: 'story', label: 'Story', testId: 'enqueue-format-story' },
                { id: 'text', label: 'Text', testId: 'enqueue-format-text' },
              ].map((f) => {
                const isCurrent = selectedFormat === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    data-testid={f.testId}
                    onClick={() => handleSelectFormat(f.id as PostFormat)}
                    style={{
                      padding: `${SPACING.xs} ${SPACING.md}`,
                      borderRadius: RADII.xs,
                      fontSize: '0.8125rem',
                      fontWeight: isCurrent ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.medium,
                      border: `1px solid ${
                        isCurrent ? PALETTE.primary : `var(--border-subtle, ${THEME.default.borders.hairline})`
                      }`,
                      backgroundColor: isCurrent
                        ? `var(--bg-active, ${THEME.default.surfaces.active})`
                        : 'transparent',
                      color: isCurrent
                        ? PALETTE.text
                        : `var(--text-sub, ${THEME.default.text.secondary})`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media Selection Grid */}
          {selectedFormat !== 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                Select Asset
              </span>

              {renderMediaList()}
            </div>
          )}

          {/* Slot Target Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label
              htmlFor="enqueue-slot-select"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Publishing Schedule Slot
            </label>
            <select
              id="enqueue-slot-select"
              data-testid="enqueue-slot-select"
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              style={{
                padding: SPACING.sm,
                borderRadius: RADII.sm,
                backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
              }}
            >
              <option value="">Next Available Recurring Slot (Automatic)</option>
              {activeSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.slotTime} ({slot.timezone})
                </option>
              ))}
            </select>
          </div>

          {/* Caption Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label
              htmlFor="enqueue-caption-field"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Caption
            </label>
            <textarea
              id="enqueue-caption-field"
              data-testid="enqueue-caption-field"
              rows={3}
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                setIsCaptionDirty(true);
              }}
              placeholder="Write a caption for this post..."
              style={{
                width: '100%',
                padding: SPACING.sm,
                borderRadius: RADII.sm,
                backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Link URL Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label
              htmlFor="enqueue-link-url-input"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Link URL (Optional)
            </label>
            <input
              id="enqueue-link-url-input"
              data-testid="enqueue-link-url-input"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/..."
              style={{
                width: '100%',
                padding: SPACING.sm,
                borderRadius: RADII.sm,
                backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* First Comment Field / Story Notice */}
          {selectedFormat === 'story' ? (
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
            <div
              data-testid="enqueue-first-comment-field"
              style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}
            >
              <label
                htmlFor="enqueue-first-comment-input"
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                Automated First Comment (Optional)
              </label>
              <textarea
                id="enqueue-first-comment-input"
                data-testid="enqueue-first-comment-input"
                rows={2}
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                placeholder="Links, hashtags, or supplementary notes..."
                style={{
                  width: '100%',
                  padding: SPACING.sm,
                  borderRadius: RADII.sm,
                  backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm }}>
            <button
              type="button"
              data-testid="cancel-enqueue-btn"
              onClick={onClose}
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
              type="submit"
              data-testid="submit-enqueue-btn"
              disabled={
                isSubmitting ||
                (selectedFormat === 'text' ? !caption.trim() : !selectedMediaId)
              }
              style={{
                ...COMPONENT_STYLES.primaryButton,
                padding: `${SPACING.xs} ${SPACING.lg}`,
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor:
                  isSubmitting ||
                  (selectedFormat === 'text' ? !caption.trim() : !selectedMediaId)
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  isSubmitting ||
                  (selectedFormat === 'text' ? !caption.trim() : !selectedMediaId)
                    ? 0.7
                    : 1,
              }}
            >
              {isSubmitting ? 'Scheduling...' : 'Enqueue Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
