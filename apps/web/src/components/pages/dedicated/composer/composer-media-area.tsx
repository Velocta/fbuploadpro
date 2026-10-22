'use client';

import React, { useRef, useState } from 'react';
import {
  type PostFormat,
  type MediaItemResponse,
  type MediaFolder,
} from '@fbuploadpro/contracts';
import { MediaImportModal } from '@/components/media/media-import-modal';
import {
  composerLabelStyle,
  composerHintStyle,
  composerErrorStyle,
  composerFieldStyle,
  composerSecondaryButtonStyle,
} from './composer-styles';
import { SPACING, RADII, PALETTE, THEME, TYPOGRAPHY } from '@/lib/theme';

export interface ComposerMediaItem {
  id: string;
  name: string;
  mediaType: 'video' | 'image';
  url: string;
  thumbnailUrl?: string | null | undefined;
  captionText?: string | null | undefined;
  durationSeconds?: number | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
}

export interface ComposerMediaAreaProps {
  pageId: string;
  subdomain: string;
  format: PostFormat;
  items: ComposerMediaItem[];
  onItemsChange: (items: ComposerMediaItem[]) => void;
  /** Edit mode: pre-filled media cannot be changed. */
  readOnly?: boolean;
}

const MEDIA_LIST_LIMIT = 50;

function mediaItemFromResponse(item: MediaItemResponse): ComposerMediaItem {
  return {
    id: item.id,
    name: item.name,
    mediaType: item.mediaType,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    captionText: item.captionText,
    durationSeconds: item.durationSeconds,
    width: item.width,
    height: item.height,
  };
}

/** Blocking per-item type errors for the current format. Never rewrites silently. */
export function getMediaItemError(item: ComposerMediaItem, format: PostFormat): string | null {
  switch (format) {
    case 'reel':
      return item.mediaType === 'video'
        ? null
        : 'Reels need a video file — this is an image.';
    case 'video':
      return item.mediaType === 'video'
        ? null
        : 'Videos need a video file — this is an image.';
    case 'image':
      return item.mediaType === 'image'
        ? null
        : 'Photos need image files — this is a video.';
    case 'story':
      return null;
    case 'text':
      return 'Text posts do not use media.';
    default:
      return null;
  }
}

/**
 * Single-media cap: every format takes at most one media item.
 * 2026-10-19 decision — Shahzeb capped Photo at 1 image (was "one or more");
 * multi-photo/carousel is future work.
 * Returns the plain-language notice to show when the cap blocks an add,
 * or null when the add is allowed. Never silently drops.
 */
export function getMediaCapNotice(format: PostFormat, currentCount: number): string | null {
  if (currentCount === 0) return null;
  switch (format) {
    case 'image':
      return 'Photo posts take 1 image. Remove the current one to pick another.';
    case 'video':
      return 'Video posts take 1 video. Remove the current one to pick another.';
    case 'reel':
      return 'Reels take 1 video. Remove the current one to pick another.';
    case 'story':
      return 'Stories take 1 file. Remove the current one to pick another.';
    default:
      return null;
  }
}

/** A cap notice together with the format it was raised under. */
export interface CapNoticeState {
  format: PostFormat;
  message: string;
}

/**
 * The notice to show for the CURRENT format. A notice raised under a
 * previous format (e.g. Photo) must never stay visible after switching to
 * another format (e.g. Video) where it does not apply.
 */
export function capNoticeForFormat(notice: CapNoticeState | null, format: PostFormat): string | null {
  if (!notice || notice.format !== format) return null;
  return notice.message;
}

export interface MediaSelectionResult {
  items: ComposerMediaItem[];
  /** Cap notice to surface when the add was blocked, otherwise null. */
  capNotice: string | null;
  /** True when the single-media cap blocked the add (nothing was dropped silently). */
  blocked: boolean;
}

/**
 * Selection after adding media — used both for library picks and for
 * in-composer imports, so an imported file becomes the selected media just
 * like a manual pick. Every format takes at most one item: when one is
 * already selected the add is blocked and the cap notice explains why,
 * instead of the new file being silently dropped.
 */
export function resolveSelectionAfterAdd(
  current: ComposerMediaItem[],
  incoming: ComposerMediaItem[],
  format: PostFormat
): MediaSelectionResult {
  if (incoming.length === 0) return { items: current, capNotice: null, blocked: false };
  const blockedNotice = getMediaCapNotice(format, current.length);
  if (blockedNotice) return { items: current, capNotice: blockedNotice, blocked: true };
  const newest = incoming.at(-1);
  return { items: newest ? [newest] : current, capNotice: null, blocked: false };
}

export function ComposerMediaArea({
  subdomain,
  format,
  items,
  onItemsChange,
  readOnly = false,
}: Readonly<ComposerMediaAreaProps>) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<ComposerMediaItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [capNotice, setCapNotice] = useState<CapNoticeState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openLibraryPicker = async () => {
    setIsPickerOpen(true);
    setLibraryError(null);
    setIsLoadingLibrary(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media?limit=${MEDIA_LIST_LIMIT}`);
      if (!res.ok) throw new Error("Couldn't load your media. Please try again.");
      const data = await res.json();
      const mapped: ComposerMediaItem[] = (data.items || []).map((m: MediaItemResponse) => ({
        id: m.id,
        name: m.name,
        mediaType: m.mediaType,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        captionText: m.captionText,
        durationSeconds: m.durationSeconds,
        width: m.width,
        height: m.height,
      }));
      setLibraryItems(mapped);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : "Couldn't load your media. Please try again.");
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const addItems = (incoming: ComposerMediaItem[]) => {
    const result = resolveSelectionAfterAdd(items, incoming, format);
    if (result.blocked) {
      // Tag the notice with the format that raised it so it can never leak
      // into another format's view after a format switch.
      setCapNotice(result.capNotice ? { format, message: result.capNotice } : null);
      return;
    }
    setCapNotice(null);
    if (incoming.length > 0) onItemsChange(result.items);
  };

  const visibleCapNotice = capNoticeForFormat(capNotice, format);

  const handlePickFromLibrary = (item: ComposerMediaItem) => {
    const alreadySelected = items.some((i) => i.id === item.id);
    if (alreadySelected) {
      onItemsChange(items.filter((i) => i.id !== item.id));
      setCapNotice(null);
      return;
    }
    addItems([item]);
    setIsPickerOpen(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setPendingFiles(files);
    setIsImportOpen(true);
  };

  const handleUploadSuccess = (item: MediaItemResponse) => {
    // Completed uploads are saved to the media library by the import dialog
    // itself and auto-selected here — one flow, no detour through the library.
    addItems([mediaItemFromResponse(item)]);
  };

  const handleImportClose = () => {
    setIsImportOpen(false);
    setPendingFiles([]);
  };

  const handleRemove = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
    setCapNotice(null);
  };

  const acceptAttr = format === 'image' ? 'image/*' : 'video/*,image/*';

  return (
    <div data-testid="composer-media-area" style={composerFieldStyle}>
      <span style={composerLabelStyle}>Media</span>

      {/* Selected thumbnails */}
      {items.length > 0 && (
        <div
          data-testid="composer-selected-media"
          style={{ display: 'flex', gap: SPACING.sm, flexWrap: 'wrap' }}
        >
          {items.map((item) => {
            const itemError = getMediaItemError(item, format);
            const thumb = item.thumbnailUrl || item.url;
            return (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs, maxWidth: '140px' }}>
                <div style={{ position: 'relative', width: '120px', aspectRatio: '1', borderRadius: RADII.xs, overflow: 'hidden', border: `1px solid var(--border-subtle)` }}>
                  {thumb ? (
                    <img src={thumb} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', color: `var(--text-sub)` }}>
                      {item.mediaType}
                    </div>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      data-testid={`composer-remove-media-${item.id}`}
                      aria-label={`Remove ${item.name}`}
                      onClick={() => handleRemove(item.id)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        border: 'none',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                {itemError && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span data-testid={`composer-media-error-${item.id}`} style={composerErrorStyle}>
                      {itemError}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          fontWeight: TYPOGRAPHY.weights.semibold,
                          color: PALETTE.accent3,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state + actions */}
      {items.length === 0 && !readOnly && (
        <p data-testid="composer-media-empty" style={{ ...composerHintStyle, margin: 0 }}>
          No media selected yet.
        </p>
      )}
      {visibleCapNotice && !readOnly && (
        <p data-testid="composer-media-cap-notice" style={{ ...composerHintStyle, margin: 0 }}>
          {visibleCapNotice}
        </p>
      )}
      {!readOnly && (
        <div style={{ display: 'flex', gap: SPACING.sm, flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="composer-choose-library-btn"
            onClick={() => void openLibraryPicker()}
            style={composerSecondaryButtonStyle()}
          >
            Choose from library
          </button>
          <button
            type="button"
            data-testid="composer-upload-new-btn"
            onClick={handleUploadClick}
            style={composerSecondaryButtonStyle()}
          >
            Upload new
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            data-testid="composer-file-input"
            onChange={handleFilesChosen}
            style={{ display: 'none' }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}
      {readOnly && (
        <p style={{ ...composerHintStyle, margin: 0 }}>
          Media can&apos;t be changed when editing.
        </p>
      )}

      {/* Library picker */}
      {isPickerOpen && (
        <div data-testid="composer-library-picker" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={composerLabelStyle}>Your media</span>
            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              style={{ background: 'none', border: 'none', color: `var(--text-sub)`, cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              Done
            </button>
          </div>
          {isLoadingLibrary && <p style={{ ...composerHintStyle, margin: 0 }}>Loading media…</p>}
          {libraryError && <p style={composerErrorStyle}>{libraryError}</p>}
          {!isLoadingLibrary && !libraryError && libraryItems.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs, alignItems: 'flex-start' }}>
              <p style={{ ...composerHintStyle, margin: 0 }}>No media yet.</p>
              <button type="button" onClick={handleUploadClick} style={composerSecondaryButtonStyle()}>
                Upload files to get started
              </button>
            </div>
          )}
          {!isLoadingLibrary && libraryItems.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                gap: SPACING.xs,
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '2px',
              }}
            >
              {libraryItems.map((media) => {
                const isSelected = items.some((i) => i.id === media.id);
                const thumb = media.thumbnailUrl || media.url;
                return (
                  <button
                    key={media.id}
                    type="button"
                    data-testid={`composer-library-pick-${media.id}`}
                    aria-pressed={isSelected}
                    onClick={() => handlePickFromLibrary(media)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: RADII.xs,
                      overflow: 'hidden',
                      border: isSelected
                        ? `2px solid ${PALETTE.primary}`
                        : '1px solid var(--border-subtle)',
                      backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {thumb ? (
                      <img src={thumb} alt={media.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', color: `var(--text-sub)` }}>
                        {media.mediaType}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Direct upload via the existing media-library import dialog */}
      <MediaImportModal
        subdomain={subdomain}
        isOpen={isImportOpen}
        initialFiles={pendingFiles}
        currentFolderId={null}
        folders={[] as MediaFolder[]}
        onClose={handleImportClose}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
