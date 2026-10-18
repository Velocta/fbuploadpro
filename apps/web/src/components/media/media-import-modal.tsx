'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { AllowedMediaMimeTypes } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  type ImportQueueItem,
  formatBytes,
  deriveDefaultCaption,
} from './media-types';

export const MAX_CONCURRENT_UPLOADS = 3;
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

const EXTENSION_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function resolveMimeType(file: File): string {
  if (file.type && AllowedMediaMimeTypes.includes(file.type as any)) {
    return file.type;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_TO_MIME[ext] || '';
}

function resolveMediaType(mimeType: string): 'video' | 'image' {
  return mimeType.startsWith('video/') ? 'video' : 'image';
}

function classifyAspectRatio(width: number, height: number): string {
  if (!width || !height) return 'unknown';
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  if (Math.abs(ratio - 4 / 5) < 0.08) return '4:5';
  return `${width}:${height}`;
}

async function generateThumbnailBlob(
  file: File,
  mediaType: 'video' | 'image'
): Promise<{ blob: Blob | null; width: number | null; height: number | null; duration: number | null }> {
  const fallback = { blob: null, width: null, height: null, duration: null };
  if (typeof window === 'undefined') return fallback;

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(fallback);
      }
    }, 3000);

    const finish = (result: { blob: Blob | null; width: number | null; height: number | null; duration: number | null }) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    try {
      const url = URL.createObjectURL(file);

      if (mediaType === 'image') {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 480;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(url);
                finish({ blob, width: img.width, height: img.height, duration: null });
              },
              'image/webp',
              0.82
            );
          } catch {
            URL.revokeObjectURL(url);
            finish(fallback);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          finish(fallback);
        };
        img.src = url;
      } else {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1.0, (video.duration || 1) / 2);
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 480;
            let w = video.videoWidth;
            let h = video.videoHeight;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w || 320;
            canvas.height = h || 240;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(url);
                finish({
                  blob,
                  width: video.videoWidth || null,
                  height: video.videoHeight || null,
                  duration: Number.isFinite(video.duration) ? video.duration : null,
                });
              },
              'image/webp',
              0.82
            );
          } catch {
            URL.revokeObjectURL(url);
            finish(fallback);
          }
        };

        video.onerror = () => {
          URL.revokeObjectURL(url);
          finish(fallback);
        };
        video.src = url;
      }
    } catch {
      finish(fallback);
    }
  });
}

export interface MediaImportModalProps {
  subdomain: string;
  isOpen: boolean;
  initialFiles: File[];
  currentFolderId: string | null;
  folders: MediaFolder[];
  onClose: () => void;
  onUploadSuccess: (item: MediaItemResponse) => void;
  onActiveUploadsChange?: (count: number, furthestAlong: { name: string; progressPercent: number } | null) => void;
}

export function MediaImportModal({
  subdomain,
  isOpen,
  initialFiles,
  currentFolderId,
  folders,
  onClose,
  onUploadSuccess,
  onActiveUploadsChange,
}: Readonly<MediaImportModalProps>) {
  const [step, setStep] = useState<'staging' | 'progress' | 'complete'>('staging');
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize initial files into staging queue
  useEffect(() => {
    if (!isOpen || initialFiles.length === 0) return;

    setQueue((prevQueue) => {
      // Avoid re-adding existing files
      const existingNames = new Set(prevQueue.map((item) => `${item.name}-${item.size}`));
      const newItems: ImportQueueItem[] = [];

      for (const file of initialFiles) {
        const key = `${file.name}-${file.size}`;
        if (existingNames.has(key)) continue;

        const mime = resolveMimeType(file);
        let valError: string | null = null;

        if (file.size === 0) {
          valError = "can't upload — empty file";
        } else if (file.size > MAX_FILE_SIZE_BYTES) {
          valError = 'too large — 500 MB max';
        } else if (!mime || !AllowedMediaMimeTypes.includes(mime as any)) {
          valError = "can't upload — not a supported format";
        }

        // Intra-batch duplicate check
        const isDuplicateName =
          existingNames.has(file.name) ||
          newItems.some((it) => it.name === file.name);

        newItems.push({
          id: `item-${Date.now()}-${crypto.randomUUID()}`,
          file,
          name: file.name,
          size: file.size,
          mimeType: mime,
          mediaType: resolveMediaType(mime),
          destinationFolderId: selectedFolderId,
          status: 'staged',
          progressPercent: 0,
          isDuplicate: isDuplicateName,
          validationError: valError,
          retryCount: 0,
        });
      }

      return [...prevQueue, ...newItems];
    });
  }, [isOpen, initialFiles, selectedFolderId]);

  // Server-side duplicate detection check
  useEffect(() => {
    if (step !== 'staging' || queue.length === 0) return;

    const checkDuplicates = async () => {
      try {
        const entries = queue.map((item) => ({
          clientKey: item.id,
          name: item.name,
          fileSize: item.size,
          folderId: selectedFolderId,
        }));

        const res = await fetch(`/api/tenant/${subdomain}/media/check-duplicates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries, folderId: selectedFolderId }),
        });

        if (!res.ok) return;
        const data = await res.json();
        const duplicateIds = new Set(
          (data.duplicates || []).map((d: any) => d.clientKey)
        );

        if (duplicateIds.size > 0) {
          setQueue((prev) =>
            prev.map((item) =>
              duplicateIds.has(item.id)
                ? { ...item, isDuplicate: true }
                : item
            )
          );
        }
      } catch {
        // Ignore check-duplicates network errors
      }
    };

    void checkDuplicates();
  }, [step, subdomain, selectedFolderId, queue.length]);

  // Derived counts
  const validStagedItems = queue.filter(
    (item) =>
      item.status === 'staged' &&
      !item.validationError &&
      item.duplicateResolution !== 'skip'
  );

  const activeUploadingItems = queue.filter((item) => item.status === 'uploading');
  const queuedItems = queue.filter((item) => item.status === 'queued');
  const completedItems = queue.filter((item) => item.status === 'completed');

  // Furthest along progress
  const furthestAlong = activeUploadingItems.reduce<
    { name: string; progressPercent: number } | null
  >((acc, curr) => {
    if (!acc || curr.progressPercent > acc.progressPercent) {
      return { name: curr.name, progressPercent: curr.progressPercent };
    }
    return acc;
  }, null);

  // Notify parent of active upload state for leave-page protection
  useEffect(() => {
    const totalActive = activeUploadingItems.length + queuedItems.length;
    onActiveUploadsChange?.(totalActive, furthestAlong);
  }, [activeUploadingItems.length, queuedItems.length, furthestAlong, onActiveUploadsChange]);

  const updateItemProgress = useCallback((id: string, pct: number) => {
    setQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, progressPercent: pct } : it))
    );
  }, []);

  // Concurrency Engine: Upload Worker Execution Loop
  const uploadFile = useCallback(
    async (item: ImportQueueItem) => {
      const abortCtrl = new AbortController();

      setQueue((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: 'uploading', abortController: abortCtrl, progressPercent: 1 }
            : it
        )
      );

      try {
        // 1. Request presigned upload URL
        const presignRes = await fetch(`/api/tenant/${subdomain}/media/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: item.name,
            fileSize: item.size,
            mimeType: item.mimeType,
          }),
          signal: abortCtrl.signal,
        });

        if (!presignRes.ok) {
          throw new Error('Failed to get presigned upload URL');
        }

        const presignData = await presignRes.json();
        const { uploadUrl, mediaId, storageKey, thumbnailUploadUrl, thumbnailKey } =
          presignData;

        // 2. Direct R2 upload via XHR for real progress events
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl, true);
          xhr.setRequestHeader('Content-Type', item.mimeType);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.min(95, Math.round((e.loaded / e.total) * 100));
              updateItemProgress(item.id, pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.onabort = () => reject(new Error('Upload aborted'));

          abortCtrl.signal.addEventListener('abort', () => xhr.abort());
          xhr.send(item.file);
        });

        // 3. Client-side thumbnail generation
        const thumbData = await generateThumbnailBlob(item.file, item.mediaType);
        let uploadedThumbnailUrl: string | null = null;

        if (thumbData.blob && thumbnailUploadUrl) {
          try {
            await fetch(thumbnailUploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'image/webp' },
              body: thumbData.blob,
            });
            uploadedThumbnailUrl = presignData.thumbnailUrl || null;
          } catch {
            // Ignore thumbnail upload error; fall back to type icon
          }
        }

        // 4. Confirm upload to Supabase DB
        const confirmRes = await fetch(`/api/tenant/${subdomain}/media/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            name: item.name,
            fileSize: item.size,
            mimeType: item.mimeType,
            mediaType: item.mediaType,
            storageKey,
            folderId: selectedFolderId,
            url: presignData.url || '',
            thumbnailKey: uploadedThumbnailUrl ? thumbnailKey : null,
            thumbnailUrl: uploadedThumbnailUrl,
            durationSeconds: thumbData.duration,
            aspectRatio: classifyAspectRatio(thumbData.width || 0, thumbData.height || 0),
            width: thumbData.width,
            height: thumbData.height,
            captionText: deriveDefaultCaption(item.name),
          }),
        });

        if (!confirmRes.ok) {
          throw new Error('Failed to confirm upload in library');
        }

        const confirmData = await confirmRes.json();
        const uploadedItem = confirmData.item as MediaItemResponse;

        setQueue((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'completed',
                  progressPercent: 100,
                  uploadedItem,
                }
              : it
          )
        );

        if (uploadedItem) {
          onUploadSuccess(uploadedItem);
        }
      } catch (err: any) {
        if (err.message === 'Upload aborted') {
          return;
        }

        // Auto-retry up to 3 times
        if (item.retryCount < 3) {
          setTimeout(() => {
            setQueue((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? { ...it, status: 'queued', retryCount: it.retryCount + 1 }
                  : it
              )
            );
          }, 1000 * Math.pow(2, item.retryCount));
        } else {
          setQueue((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: 'failed', validationError: 'failed — retry' } : it
            )
          );
        }
      }
    },
    [subdomain, selectedFolderId, onUploadSuccess]
  );

  // Worker tick: process next queued items up to MAX_CONCURRENT_UPLOADS
  useEffect(() => {
    if (step !== 'progress') return;

    const currentUploading = queue.filter((it) => it.status === 'uploading');
    const availableSlots = MAX_CONCURRENT_UPLOADS - currentUploading.length;

    if (availableSlots > 0) {
      const nextItems = queue
        .filter((it) => it.status === 'queued')
        .slice(0, availableSlots);

      for (const item of nextItems) {
        void uploadFile(item);
      }
    }

    // Check completion
    const inFlight = queue.filter(
      (it) => it.status === 'queued' || it.status === 'uploading'
    );
    if (inFlight.length === 0 && queue.length > 0 && step === 'progress') {
      const hasFinished = queue.some(
        (it) => it.status === 'completed' || it.status === 'failed'
      );
      if (hasFinished) {
        setStep('complete');
      }
    }
  }, [step, queue, uploadFile]);

  // Actions
  const handleStartImport = () => {
    setQueue((prev) =>
      prev.map((it) =>
        it.status === 'staged' && !it.validationError && it.duplicateResolution !== 'skip'
          ? { ...it, status: 'queued' }
          : it
      )
    );
    setStep('progress');
  };

  const handleRemoveStagedItem = (id: string) => {
    setQueue((prev) => prev.filter((it) => it.id !== id));
  };

  const handleResolveDuplicate = (id: string, resolution: 'skip' | 'upload_anyway') => {
    setQueue((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, duplicateResolution: resolution } : it
      )
    );
  };

  const handleSkipAllDuplicates = () => {
    setQueue((prev) =>
      prev.map((it) =>
        it.isDuplicate ? { ...it, duplicateResolution: 'skip' } : it
      )
    );
  };

  const handlePauseUpload = (id: string) => {
    setQueue((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          it.abortController?.abort();
          return { ...it, status: 'paused' };
        }
        return it;
      })
    );
  };

  const handleResumeUpload = (id: string) => {
    const item = queue.find((it) => it.id === id);
    if (item) {
      void uploadFile(item);
    }
  };

  const handleCancelUpload = (id: string) => {
    setQueue((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          it.abortController?.abort();
          return { ...it, status: 'failed', validationError: 'canceled' };
        }
        return it;
      })
    );
  };

  const handleRetryUpload = (id: string) => {
    const hasItem = queue.some((it) => it.id === id);
    if (hasItem) {
      setQueue((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: 'queued', retryCount: 0, validationError: null } : it
        )
      );
    }
  };

  const handleCancelRemaining = () => {
    setQueue((prev) =>
      prev.map((it) => {
        if (it.status === 'queued') {
          return { ...it, status: 'failed', validationError: 'canceled' };
        }
        if (it.status === 'uploading') {
          it.abortController?.abort();
          return { ...it, status: 'failed', validationError: 'canceled' };
        }
        return it;
      })
    );
  };

  const handleDone = () => {
    setQueue([]);
    setStep('staging');
    setIsMinimized(false);
    onClose();
  };

  if (!isOpen && queue.length === 0) return null;

  // Minimized dock
  if (isMinimized) {
    const totalCount = queue.length;
    const completedCount = completedItems.length;
    const overallPct =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <aside
        aria-label="Upload progress dock"
        style={{
          position: 'fixed',
          bottom: SPACING.md,
          right: SPACING.md,
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
          borderRadius: RADII.md,
          padding: `${SPACING.sm} ${SPACING.md}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 9000,
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Uploading {activeUploadingItems.length} at a time · {overallPct}%
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            {completedCount} of {totalCount} uploaded
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          style={{
            padding: `${SPACING.xs} ${SPACING.sm}`,
            backgroundColor: PALETTE.primary,
            border: 'none',
            borderRadius: RADII.xs,
            color: '#000000',
            fontSize: '0.75rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            cursor: 'pointer',
          }}
        >
          View
        </button>
      </aside>
    );
  }

  // Overall percentage in progress mode
  const totalInBatch = queue.length;
  const overallProgressPercent =
    totalInBatch > 0
      ? Math.round(
          queue.reduce((acc, it) => acc + (it.status === 'completed' ? 100 : it.progressPercent), 0) /
            totalInBatch
        )
      : 0;

  const renderStagingRowStatus = (item: ImportQueueItem) => {
    if (item.validationError) {
      return (
        <span
          style={{
            fontSize: '0.75rem',
            color: PALETTE.accent3,
            fontWeight: TYPOGRAPHY.weights.medium,
          }}
        >
          {item.validationError}
        </span>
      );
    }
    if (item.isDuplicate) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '0.6875rem',
              color: PALETTE.primary,
              fontWeight: TYPOGRAPHY.weights.semibold,
            }}
          >
            possible duplicate
          </span>
          <button
            type="button"
            onClick={() =>
              handleResolveDuplicate(
                item.id,
                item.duplicateResolution === 'skip' ? 'upload_anyway' : 'skip'
              )
            }
            style={{
              padding: '2px 6px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
              borderRadius: RADII.xs,
              color:
                item.duplicateResolution === 'skip'
                  ? `var(--text-dim, ${THEME.default.text.muted})`
                  : `var(--text-main, ${THEME.default.text.primary})`,
              fontSize: '0.6875rem',
              cursor: 'pointer',
            }}
          >
            {item.duplicateResolution === 'skip' ? 'Skipped' : 'Skip'}
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <dialog
      open
      aria-labelledby="import-media-title"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        border: 'none',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: SPACING.md,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
          borderRadius: RADII.md,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: `${SPACING.md} ${SPACING.lg}`,
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              id="import-media-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {step === 'staging' && 'Import media'}
              {step === 'progress' &&
                `Uploading ${Math.min(activeUploadingItems.length || 3, MAX_CONCURRENT_UPLOADS)} at a time · ${overallProgressPercent}% overall`}
              {step === 'complete' &&
                (completedItems.length > 0
                  ? `Import complete — ${completedItems.length} of ${totalInBatch} uploaded`
                  : 'Import canceled — nothing was uploaded')}
            </h2>
            {step === 'staging' && (
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                they'll be added to{' '}
                <select
                  value={selectedFolderId || ''}
                  onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  style={{
                    backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    borderRadius: RADII.xs,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    padding: '2px 6px',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">All Media</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </p>
            )}
          </div>

          {step === 'progress' && (
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Keep working
            </button>
          )}
        </div>

        {/* Scrollable File List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `${SPACING.sm} ${SPACING.lg}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {queue.map((item, index) => {
            const isQueued = item.status === 'queued';
            const isUploading = item.status === 'uploading';
            const isCompleted = item.status === 'completed';
            const isFailed = item.status === 'failed';
            const isPaused = item.status === 'paused';

            return (
              <div
                key={item.id}
                data-testid={`import-row-${item.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${SPACING.xs} ${SPACING.sm}`,
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  borderRadius: RADII.xs,
                  gap: SPACING.sm,
                }}
              >
                {/* File icon + Name & Details */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACING.sm,
                    overflow: 'hidden',
                    flex: 1,
                  }}
                >
                  {item.mediaType === 'video' ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={PALETTE.primary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <polygon points="10 8 16 12 10 16 10 8" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={PALETTE.primary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span
                      title={item.name}
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: TYPOGRAPHY.weights.medium,
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: `var(--text-dim, ${THEME.default.text.muted})`,
                        fontVariantNumeric: TYPOGRAPHY.tabularNums,
                      }}
                    >
                      {formatBytes(item.size)}
                    </span>
                  </div>
                </div>

                {/* Status / Validation / Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                  {step === 'staging' && (
                    <>
                      {renderStagingRowStatus(item)}

                      <button
                        type="button"
                        onClick={() => handleRemoveStagedItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: `var(--text-dim, ${THEME.default.text.muted})`,
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </>
                  )}

                  {step === 'progress' && (
                    <>
                      {isQueued && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: `var(--text-dim, ${THEME.default.text.muted})`,
                            }}
                          >
                            queued · #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCancelUpload(item.id)}
                            aria-label={`Cancel ${item.name}`}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: `var(--text-dim, ${THEME.default.text.muted})`,
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {isUploading && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: '120px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                width: '100%',
                                height: '4px',
                                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                                borderRadius: '2px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${item.progressPercent}%`,
                                  height: '100%',
                                  backgroundColor: PALETTE.primary,
                                  transition: 'width 0.2s ease',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                color: `var(--text-dim, ${THEME.default.text.muted})`,
                                fontVariantNumeric: TYPOGRAPHY.tabularNums,
                              }}
                            >
                              {item.progressPercent}%
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePauseUpload(item.id)}
                            aria-label={`Pause ${item.name}`}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: `var(--text-dim, ${THEME.default.text.muted})`,
                              cursor: 'pointer',
                              fontSize: '0.6875rem',
                            }}
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelUpload(item.id)}
                            aria-label={`Cancel ${item.name}`}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: `var(--text-dim, ${THEME.default.text.muted})`,
                              cursor: 'pointer',
                              fontSize: '0.6875rem',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {isPaused && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: `var(--text-dim, ${THEME.default.text.muted})`,
                            }}
                          >
                            paused
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResumeUpload(item.id)}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                              borderRadius: RADII.xs,
                              color: `var(--text-main, ${THEME.default.text.primary})`,
                              fontSize: '0.6875rem',
                              cursor: 'pointer',
                            }}
                          >
                            Resume
                          </button>
                        </div>
                      )}

                      {isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: PALETTE.accent2,
                              fontWeight: TYPOGRAPHY.weights.medium,
                            }}
                          >
                            uploaded
                          </span>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={PALETTE.accent2}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}

                      {isFailed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: PALETTE.accent3,
                            }}
                          >
                            {item.validationError || 'failed — retry'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRetryUpload(item.id)}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                              borderRadius: RADII.xs,
                              color: PALETTE.primary,
                              fontSize: '0.6875rem',
                              cursor: 'pointer',
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: `${SPACING.md} ${SPACING.lg}`,
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.sm,
          }}
        >
          {step === 'staging' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: PALETTE.primary,
                      fontSize: '0.8125rem',
                      fontWeight: TYPOGRAPHY.weights.medium,
                      cursor: 'pointer',
                    }}
                  >
                    + Add more
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={AllowedMediaMimeTypes.join(',')}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        e.target.value = '';
                        // Append to initialFiles trigger
                        const newItems = newFiles.map((f) => {
                          const mime = resolveMimeType(f);
                          let valErr: string | null = null;
                          if (f.size === 0) valErr = "can't upload — empty file";
                          else if (f.size > MAX_FILE_SIZE_BYTES) valErr = 'too large — 500 MB max';
                          else if (!mime || !AllowedMediaMimeTypes.includes(mime as any))
                            valErr = "can't upload — not a supported format";
                          return {
                            id: `item-${Date.now()}-${crypto.randomUUID()}`,
                            file: f,
                            name: f.name,
                            size: f.size,
                            mimeType: mime,
                            mediaType: resolveMediaType(mime),
                            destinationFolderId: selectedFolderId,
                            status: 'staged' as const,
                            progressPercent: 0,
                            isDuplicate: false,
                            validationError: valErr,
                            retryCount: 0,
                          };
                        });
                        setQueue((prev) => [...prev, ...newItems]);
                      }
                    }}
                  />
                  {queue.some((it) => it.isDuplicate && it.duplicateResolution !== 'skip') && (
                    <button
                      type="button"
                      onClick={handleSkipAllDuplicates}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Skip all duplicates
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: `${SPACING.xs} ${SPACING.md}`,
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: `var(--text-sub, ${THEME.default.text.secondary})`,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={validStagedItems.length === 0}
                    onClick={handleStartImport}
                    style={{
                      padding: `${SPACING.xs} ${SPACING.lg}`,
                      backgroundColor:
                        validStagedItems.length > 0 ? PALETTE.primary : 'rgba(250, 215, 52, 0.3)',
                      color: '#000000',
                      border: 'none',
                      borderRadius: RADII.xs,
                      fontSize: '0.8125rem',
                      fontWeight: TYPOGRAPHY.weights.semibold,
                      cursor: validStagedItems.length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Start import ({validStagedItems.length})
                  </button>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Uploads run 3 at a time — the rest wait in line.
              </span>
            </>
          )}

          {step === 'progress' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                type="button"
                onClick={handleCancelRemaining}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: PALETTE.accent3,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Cancel remaining
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  borderRadius: RADII.xs,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Keep working
              </button>
            </div>
          )}

          {step === 'complete' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={handleDone}
                style={{
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  backgroundColor: PALETTE.primary,
                  color: '#000000',
                  border: 'none',
                  borderRadius: RADII.xs,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
