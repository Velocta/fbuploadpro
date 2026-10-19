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
  SPACING,
  RADII,
  PALETTE,
  THEME,
  TYPOGRAPHY,
} from './composer-styles';

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

function formatAcceptsMultiple(format: PostFormat): boolean {
  return format === 'image';
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
    if (incoming.length === 0) return;
    if (formatAcceptsMultiple(format)) {
      const existingIds = new Set(items.map((i) => i.id));
      onItemsChange([...items, ...incoming.filter((i) => !existingIds.has(i.id))]);
    } else {
      // Single-media formats: the newest pick replaces the previous one.
      onItemsChange([incoming[incoming.length - 1]!]);
    }
  };

  const handlePickFromLibrary = (item: ComposerMediaItem) => {
    const alreadySelected = items.some((i) => i.id === item.id);
    if (alreadySelected) {
      onItemsChange(items.filter((i) => i.id !== item.id));
      return;
    }
    addItems([item]);
    if (!formatAcceptsMultiple(format)) setIsPickerOpen(false);
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
  };

  const acceptAttr =
    format === 'image' ? 'image/*' : format === 'text' ? 'image/*,video/*' : 'video/*,image/*';

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
            multiple={formatAcceptsMultiple(format)}
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
