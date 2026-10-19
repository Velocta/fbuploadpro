'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AllowedMediaMimeTypes } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  type ImportQueueItem,
} from './media-types';
import {
  computeOverallProgress,
  computeFurthestAlong,
  handleModalKeyDown,
  buildImportQueueItems,
  isItemReadyToImport,
} from './media-import-utils';
import { useImportUpload } from './media-import-upload-engine';
import {
  ImportStagingHeader,
  ImportStagingRow,
  ImportStagingFooter,
} from './media-import-staging';
import {
  ImportProgressHeader,
  ImportProgressFooter,
  type MediaImportModalProps,
  MinimizedUploadPill,
} from './media-import-progress';
import { ImportProgressRow } from './media-import-progress-row';

export const MAX_CONCURRENT_UPLOADS = 3;
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

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
  const [isDestinationDropdownOpen, setIsDestinationDropdownOpen] = useState(false);
  const [queue, setQueue] = useState<ImportQueueItem[]>(() =>
    isOpen && initialFiles && initialFiles.length > 0
      ? buildImportQueueItems(initialFiles, currentFolderId)
      : []
  );
  const [userInitiatedCancel, setUserInitiatedCancel] = useState(false);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync destination folder default when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(currentFolderId);
      setIsDestinationDropdownOpen(false);
    } else {
      setIsStartingImport(false);
    }
  }, [isOpen, currentFolderId]);

  // Synchronize initial files into staging queue with 46px preview object URLs
  useEffect(() => {
    if (!isOpen || initialFiles.length === 0 || step !== 'staging') return;

    setQueue((prevQueue) => {
      const newItems = buildImportQueueItems(initialFiles, selectedFolderId, prevQueue);
      if (newItems.length === 0) return prevQueue;
      return [...prevQueue, ...newItems];
    });
  }, [isOpen, initialFiles, selectedFolderId, step]);

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
  const validStagedItems = queue.filter(isItemReadyToImport);
  const activeUploadingItems = queue.filter((item) => item.status === 'uploading');
  const queuedItems = queue.filter((item) => item.status === 'queued');
  const completedItems = queue.filter((item) => item.status === 'completed');
  const nonCancelledItems = queue.filter((item) => item.status !== 'cancelled');

  // Furthest along progress
  const furthestAlong = computeFurthestAlong(activeUploadingItems);

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

  const uploadFile = useImportUpload({
    subdomain,
    selectedFolderId,
    queue,
    step,
    setQueue,
    setStep,
    updateItemProgress,
    onUploadSuccess,
  });

  // Upload Engine Execution

  // Actions
  const handleStartImport = () => {
    if (isStartingImport || validStagedItems.length === 0) return;
    setIsStartingImport(true);
    setUserInitiatedCancel(false);
    setQueue((prev) =>
      prev.map((it) => (isItemReadyToImport(it) ? { ...it, status: 'queued' } : it))
    );
    setStep('progress');
  };

  const handleRemoveStagedItem = (id: string) => {
    setQueue((prev) => prev.filter((it) => it.id !== id));
  };

  const handleKeepDuplicate = (id: string) => {
    setQueue((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, isDuplicate: false, duplicateResolution: 'keep' } : it
      )
    );
  };

  const handleSkipAllDuplicates = () => {
    setQueue((prev) => prev.filter((it) => !it.isDuplicate));
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
    setUserInitiatedCancel(true);
    setQueue((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          it.abortController?.abort();
          return { ...it, status: 'cancelled' };
        }
        return it;
      })
    );
  };

  const handleRetryUpload = (id: string) => {
    setQueue((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, status: 'queued', retryCount: 0, validationError: null } : it
      )
    );
  };

  const handleCancelRemaining = () => {
    setUserInitiatedCancel(true);
    // Cancels queued only, never in-flight
    setQueue((prev) =>
      prev.map((it) => (it.status === 'queued' ? { ...it, status: 'cancelled' } : it))
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
    const totalCount = nonCancelledItems.length;
    const completedCount = completedItems.length;
    const overallPct =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <MinimizedUploadPill
        completedCount={completedCount}
        totalCount={totalCount}
        overallPercent={overallPct}
        onRestore={() => setIsMinimized(false)}
      />
    );
  }

  const destinationFolderName =
    (selectedFolderId ? folders.find((f) => f.id === selectedFolderId)?.name : null) || 'Library';

  const overallProgressPercent = computeOverallProgress(nonCancelledItems);

  const duplicatesCount = queue.filter((it) => it.isDuplicate).length;
  const isAllCancelled =
    completedItems.length === 0 && (userInitiatedCancel || queue.every((it) => it.status === 'cancelled'));

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="import-media-title"
      data-testid="media-import-modal"
      onPointerDown={(e) => {
        if (step === 'staging' && e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => handleModalKeyDown(e.key, step, onClose, handleDone)}
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
          maxWidth: '580px',
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
        {step === 'staging' ? (
          <ImportStagingHeader
            totalCount={queue.length}
            destinationFolderName={destinationFolderName}
            selectedFolderId={selectedFolderId}
            folders={folders}
            isDropdownOpen={isDestinationDropdownOpen}
            onToggleDropdown={() => setIsDestinationDropdownOpen((prev) => !prev)}
            onSelectFolder={(fId) => {
              setSelectedFolderId(fId);
              setIsDestinationDropdownOpen(false);
            }}
          />
        ) : (
          <ImportProgressHeader
            step={step}
            destinationFolderName={destinationFolderName}
            completedCount={completedItems.length}
            totalCount={queue.length}
            isAllCancelled={isAllCancelled}
            overallProgressPercent={overallProgressPercent}
          />
        )}

        {/* Scrollable File List */}
        <div
          data-testid="import-files-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `${SPACING.sm} ${SPACING.lg}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Duplicate Banner (staging mode only) */}
          {step === 'staging' && duplicatesCount > 0 && (
            <div
              data-testid="duplicate-banner"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACING.xs} ${SPACING.sm}`,
                backgroundColor: 'rgba(250, 215, 52, 0.1)',
                border: '1px solid rgba(250, 215, 52, 0.25)',
                borderRadius: RADII.xs,
                fontSize: '0.8125rem',
                color: PALETTE.primary,
              }}
            >
              <span>
                {duplicatesCount} possible duplicate{duplicatesCount === 1 ? '' : 's'} found
              </span>
              <button
                type="button"
                data-testid="skip-all-duplicates-btn"
                onClick={handleSkipAllDuplicates}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: PALETTE.primary,
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Skip all
              </button>
            </div>
          )}

          {queue.map((item) =>
            step === 'staging' ? (
              <ImportStagingRow
                key={item.id}
                item={item}
                onRemove={handleRemoveStagedItem}
                onKeepDuplicate={handleKeepDuplicate}
              />
            ) : (
              <ImportProgressRow
                key={item.id}
                item={item}
                destinationFolderName={destinationFolderName}
                onPause={handlePauseUpload}
                onResume={handleResumeUpload}
                onCancel={handleCancelUpload}
                onRetry={handleRetryUpload}
              />
            )
          )}
        </div>

        {/* Footer */}
        {step === 'staging' ? (
          <ImportStagingFooter
            validCount={validStagedItems.length}
            isStarting={isStartingImport}
            onAddMore={() => fileInputRef.current?.click()}
            onCancel={onClose}
            onStart={handleStartImport}
          />
        ) : (
          <ImportProgressFooter
            step={step}
            isUploading={activeUploadingItems.length > 0}
            canCancelRemaining={queuedItems.length > activeUploadingItems.length}
            onCancelRemaining={handleCancelRemaining}
            onKeepWorking={() => setIsMinimized(true)}
            onDone={handleDone}
          />
        )}

        {/* Hidden File Input for "+ Add more" */}
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
              setQueue((prev) => [
                ...prev,
                ...buildImportQueueItems(newFiles, selectedFolderId, prev),
              ]);
            }
          }}
        />
      </div>
    </dialog>
  );
}
