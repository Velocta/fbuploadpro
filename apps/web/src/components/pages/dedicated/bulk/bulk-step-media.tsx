'use client';

import React, { useRef, useState } from 'react';
import {
  BULK_MAX_ITEMS,
  type MediaFolder,
  type MediaItemResponse,
} from '@fbuploadpro/contracts';
import { MediaImportModal } from '@/components/media/media-import-modal';
import {
  composerLabelStyle,
  composerHintStyle,
  composerErrorStyle,
  composerFieldStyle,
  composerSecondaryButtonStyle,
} from '../composer/composer-styles';
import { type ComposerMediaItem } from '../composer/composer-media-area';
import { SPACING, RADII, PALETTE, TYPOGRAPHY } from '@/lib/theme';

export interface BulkStepMediaProps {
  subdomain: string;
  selected: ComposerMediaItem[];
  onSelectedChange: (assets: ComposerMediaItem[]) => void;
}

const LIBRARY_FETCH_LIMIT = 200;

function toBulkAsset(item: MediaItemResponse): ComposerMediaItem {
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

export function BulkStepMedia({ subdomain, selected, onSelectedChange }: Readonly<BulkStepMediaProps>) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<ComposerMediaItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [capNotice, setCapNotice] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openLibraryPicker = async () => {
    setIsPickerOpen(true);
    setLibraryError(null);
    setIsLoadingLibrary(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media?limit=${LIBRARY_FETCH_LIMIT}`);
      if (!res.ok) throw new Error("Couldn't load your media. Please try again.");
      const data = await res.json();
      setLibraryItems(((data.items || []) as MediaItemResponse[]).map(toBulkAsset));
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : "Couldn't load your media. Please try again.");
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const addAssets = (incoming: ComposerMediaItem[]) => {
    const existingIds = new Set(selected.map((a) => a.id));
    const fresh = incoming.filter((a) => !existingIds.has(a.id));
    if (fresh.length === 0) return;
    const room = BULK_MAX_ITEMS - selected.length;
    if (room <= 0) {
      setCapNotice(true);
      return;
    }
    if (fresh.length > room) setCapNotice(true);
    onSelectedChange([...selected, ...fresh.slice(0, room)]);
  };

  const toggleFromLibrary = (item: ComposerMediaItem) => {
    if (selected.some((a) => a.id === item.id)) {
      onSelectedChange(selected.filter((a) => a.id !== item.id));
      setCapNotice(false);
    } else {
      addAssets([item]);
    }
  };

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setPendingFiles(files);
    setIsImportOpen(true);
  };

  const handleUploadSuccess = (item: MediaItemResponse) => {
    addAssets([toBulkAsset(item)]);
  };

  const handleImportClose = () => {
    setIsImportOpen(false);
    setPendingFiles([]);
  };

  const selectedCountLabel = `${selected.length} selected`;
  const capLabel = `Up to ${BULK_MAX_ITEMS} posts per run.`;

  return (
    <div data-testid="bulk-step-media" style={composerFieldStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACING.sm }}>
        <span style={composerLabelStyle}>Choose media</span>
        <span data-testid="bulk-selected-counter" style={{ ...composerHintStyle, fontWeight: TYPOGRAPHY.weights.semibold }}>
          {selectedCountLabel} · {capLabel}
        </span>
      </div>

      <div style={{ display: 'flex', gap: SPACING.sm, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="bulk-choose-library-btn"
          onClick={() => void openLibraryPicker()}
          style={composerSecondaryButtonStyle()}
        >
          Choose from library
        </button>
        <button
          type="button"
          data-testid="bulk-upload-new-btn"
          onClick={() => fileInputRef.current?.click()}
          style={composerSecondaryButtonStyle()}
        >
          Upload new
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          onChange={handleFilesChosen}
          style={{ display: 'none' }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {capNotice && (
        <p data-testid="bulk-cap-notice" style={{ ...composerHintStyle, margin: 0 }}>
          That would take you over {BULK_MAX_ITEMS} — keeping the first {BULK_MAX_ITEMS}.
        </p>
      )}

      {selected.length > 0 && (
        <div
          data-testid="bulk-selected-media"
          style={{ display: 'flex', gap: SPACING.xs, flexWrap: 'wrap' }}
        >
          {selected.map((item) => {
            const thumb = item.thumbnailUrl || item.url;
            return (
              <div key={item.id} style={{ position: 'relative', width: '88px', aspectRatio: '1', borderRadius: RADII.xs, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                {thumb ? (
                  <img src={thumb} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', color: 'var(--text-sub)' }}>
                    {item.mediaType}
                  </div>
                )}
                <button
                  type="button"
                  data-testid={`bulk-remove-media-${item.id}`}
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onSelectedChange(selected.filter((a) => a.id !== item.id))}
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
              </div>
            );
          })}
        </div>
      )}

      {isPickerOpen && (
        <div data-testid="bulk-library-picker" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={composerLabelStyle}>Your media</span>
            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              Done
            </button>
          </div>
          {isLoadingLibrary && <p style={{ ...composerHintStyle, margin: 0 }}>Loading media…</p>}
          {libraryError && <p style={composerErrorStyle}>{libraryError}</p>}
          {!isLoadingLibrary && !libraryError && libraryItems.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs, alignItems: 'flex-start' }}>
              <p style={{ ...composerHintStyle, margin: 0 }}>No media yet.</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={composerSecondaryButtonStyle()}>
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
                maxHeight: '240px',
                overflowY: 'auto',
                padding: '2px',
              }}
            >
              {libraryItems.map((media) => {
                const isSelected = selected.some((a) => a.id === media.id);
                const thumb = media.thumbnailUrl || media.url;
                return (
                  <button
                    key={media.id}
                    type="button"
                    data-testid={`bulk-library-pick-${media.id}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleFromLibrary(media)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: RADII.xs,
                      overflow: 'hidden',
                      border: isSelected
                        ? `2px solid ${PALETTE.primary}`
                        : '1px solid var(--border-subtle)',
                      backgroundColor: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {thumb ? (
                      <img src={thumb} alt={media.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', color: 'var(--text-sub)' }}>
                        {media.mediaType}
                      </div>
                    )}
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: '4px',
                          left: '4px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: PALETTE.primary,
                          color: '#fff',
                          fontSize: '0.75rem',
                          lineHeight: '20px',
                          textAlign: 'center',
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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
