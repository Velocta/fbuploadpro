'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { type MediaFolder } from '@fbuploadpro/contracts';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { DownloaderSavedItemRow } from './media-downloader-saved-item-row';
import { DownloaderNewFolderDialog } from './media-downloader-new-folder-dialog';
import {
  buildMediaFolderHref,
  validateDownloaderBatchInput,
  resolveInitialDownloaderFolderId,
  sortFoldersForDownloader,
  getProgressTextColor,
} from './media-downloader-helpers';
import {
  useCreateDownloaderFolder,
  useDownloaderBatch,
  useDownloaderFolders,
  useRecentDownloaderJobs,
  type DownloaderBatchProgressState,
  type DownloaderFailedEntry,
  type DownloaderSavedEntry,
} from './downloader-data';

export interface MediaDownloaderProps {
  subdomain: string;
  initialFolders?: MediaFolder[];
  initialSelectedFolderId?: string | null;
  initialUrlInput?: string;
  initialUrlError?: string | null;
  initialBatchProgress?: DownloaderBatchProgressState | null;
  initialSavedEntries?: DownloaderSavedEntry[];
  initialFailedEntries?: DownloaderFailedEntry[];
  initialNewFolderDialogOpen?: boolean;
  initialNewFolderName?: string;
  initialDeduplicationCount?: number;
}

export function MediaDownloader({
  subdomain,
  initialFolders,
  initialSelectedFolderId,
  initialUrlInput = '',
  initialUrlError = null,
  initialBatchProgress = null,
  initialSavedEntries = [],
  initialFailedEntries = [],
  initialNewFolderDialogOpen = false,
  initialNewFolderName = '',
  initialDeduplicationCount = 0,
}: Readonly<MediaDownloaderProps>) {
  const router = useRouter();

  const { folders, autoSelectedFolderId } = useDownloaderFolders(subdomain, {
    initialFolders,
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() =>
    resolveInitialDownloaderFolderId(initialSelectedFolderId, initialFolders)
  );

  useEffect(() => {
    if (autoSelectedFolderId !== null && selectedFolderId === null) {
      setSelectedFolderId(autoSelectedFolderId);
    }
  }, [autoSelectedFolderId, selectedFolderId]);

  const [urlInput, setUrlInput] = useState(initialUrlInput);
  const [urlError, setUrlError] = useState<string | null>(initialUrlError);
  const [batchProgress, setBatchProgress] = useState<DownloaderBatchProgressState | null>(
    initialBatchProgress
  );
  const [deduplicationCount, setDeduplicationCount] = useState<number>(
    initialDeduplicationCount
  );

  const [savedEntries, setSavedEntries] = useState<DownloaderSavedEntry[]>(
    initialSavedEntries
  );
  const [failedEntries, setFailedEntries] = useState<DownloaderFailedEntry[]>(
    initialFailedEntries
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const downloaderBatch = useDownloaderBatch(subdomain);
  const createFolderMutation = useCreateDownloaderFolder(subdomain);
  const recentJobsQuery = useRecentDownloaderJobs(subdomain);
  const mergedRecentIdsRef = useRef<Set<string>>(new Set());

  // OD-140-2: hydrate the Recent list from stored jobs on mount (latest 50)
  useEffect(() => {
    const data = recentJobsQuery.data;
    if (!data) return;
    const mergedIds = mergedRecentIdsRef.current;
    const newSaved = data.savedEntries.filter(
      (entry) => !mergedIds.has(entry.item.id)
    );
    const newFailed = data.failedEntries.filter(
      (entry) => !mergedIds.has(entry.id)
    );
    if (newSaved.length === 0 && newFailed.length === 0) return;
    for (const entry of newSaved) mergedIds.add(entry.item.id);
    for (const entry of newFailed) mergedIds.add(entry.id);
    if (newSaved.length > 0) {
      setSavedEntries((prev) => [
        ...prev,
        ...newSaved.filter(
          (entry) => !prev.some((p) => p.item.id === entry.item.id)
        ),
      ]);
    }
    if (newFailed.length > 0) {
      setFailedEntries((prev) => [
        ...prev,
        ...newFailed.filter((entry) => !prev.some((p) => p.id === entry.id)),
      ]);
    }
  }, [recentJobsQuery.data]);

  const handleAbortDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setBatchProgress((prev) =>
      prev ? { ...prev, status: 'cancelled' } : null
    );
  };

  // Inline New Folder Modal state
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(
    initialNewFolderDialogOpen
  );
  const [newFolderName, setNewFolderName] = useState(initialNewFolderName);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const isDownloading = batchProgress?.status === 'downloading';

  const sortedFolderOptions = React.useMemo(() => sortFoldersForDownloader(folders), [folders]);

  const handleOpenNewFolderDialog = useCallback(() => {
    setNewFolderName('');
    setNewFolderParentId(selectedFolderId);
    setNewFolderError(null);
    setIsNewFolderDialogOpen(true);
  }, [selectedFolderId]);

  const handleCreateNewFolder = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setNewFolderError('Please enter a folder name.');
      return;
    }

    setIsCreatingFolder(true);
    setNewFolderError(null);
    try {
      const created = await createFolderMutation.mutateAsync({
        name: trimmed,
        parentId: newFolderParentId,
        existingFolders: folders,
      });
      setSelectedFolderId(created.selectedFolderId);
      setIsNewFolderDialogOpen(false);
      setNewFolderName('');
    } catch (err) {
      setNewFolderError(
        err instanceof Error ? err.message : 'Could not create folder.'
      );
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setUrlInput(nextValue);
    if (urlError) {
      setUrlError(null);
    }
  };

  const handleSubmitDownload = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isDownloading) return;

    const validation = validateDownloaderBatchInput(urlInput);
    if (!validation.valid) {
      setUrlError(validation.errorMessage);
      return;
    }

    setUrlError(null);
    setDeduplicationCount(validation.duplicateCount);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await downloaderBatch.execute({
        rawInput: urlInput,
        folderId: selectedFolderId,
        signal: controller.signal,
        onProgress: (state) => {
          setBatchProgress(state);
        },
      });

      if (result.savedEntries.length > 0) {
        setSavedEntries((prev) => [...result.savedEntries, ...prev]);
      }
      if (result.failedEntries.length > 0) {
        setFailedEntries((prev) => [...result.failedEntries, ...prev]);
      }
      if (result.failedEntries.length === 0) {
        setUrlInput('');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleRetryFailedEntry = async (entry: DownloaderFailedEntry) => {
    setRetryingId(entry.id);
    const retryResult = await downloaderBatch.retry({
      entry,
      targetFolderId: entry.folderId ?? selectedFolderId,
    });
    setRetryingId(null);

    if (retryResult.ok) {
      setFailedEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setSavedEntries((prev) => [...retryResult.savedEntries, ...prev]);
    } else if (retryResult.errorMessage) {
      setFailedEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? { ...item, errorMessage: retryResult.errorMessage! }
            : item
        )
      );
    }
  };

  const handleOpenInFolder = (folderId: string | null) => {
    router.push(buildMediaFolderHref(subdomain, folderId));
  };

  const progressPercent =
    batchProgress && batchProgress.totalLinks > 0
      ? Math.min(
          100,
          Math.round((batchProgress.completedLinks / batchProgress.totalLinks) * 100)
        )
      : 0;

  const activeDuplicateNoticeCount =
    batchProgress && batchProgress.duplicateCount > 0
      ? batchProgress.duplicateCount
      : deduplicationCount;

  const hasRecentActivity = savedEntries.length > 0 || failedEntries.length > 0;

  return (
    <div
      data-testid="media-downloader-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xl,
        padding: SPACING.xl,
        maxWidth: '1040px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Page Header */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.xs,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            letterSpacing: TYPOGRAPHY.tracking.h1,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Media Downloader
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            maxWidth: '68ch',
          }}
        >
          Paste video or image links from social platforms, cloud drives, or direct web links to save them directly into your Media Library.
        </p>
      </header>

      {/* Main Downloader Input Card */}
      <section
        data-testid="downloader-input-card"
        style={{
          ...COMPONENT_STYLES.card(THEME.default),
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          padding: SPACING.xl,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.lg,
        }}
      >
        <form
          onSubmit={handleSubmitDownload}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.lg,
          }}
        >
          {/* Destination Folder Selector Row */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.xs,
            }}
          >
            <label
              htmlFor="downloader-folder-select"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Destination folder
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                flexWrap: 'wrap',
              }}
            >
              <select
                id="downloader-folder-select"
                data-testid="downloader-folder-select"
                value={selectedFolderId ?? ''}
                onChange={(e) =>
                  setSelectedFolderId(e.target.value ? e.target.value : null)
                }
                disabled={isDownloading}
                style={{
                  ...COMPONENT_STYLES.input(THEME.default),
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  flex: '1 1 260px',
                  minWidth: '220px',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Media (Root)</option>
                {sortedFolderOptions.map(({ folder, pathLabel }) => (
                  <option key={folder.id} value={folder.id}>
                    {pathLabel}
                  </option>
                ))}
              </select>

              <button
                type="button"
                data-testid="downloader-new-folder-button"
                onClick={handleOpenNewFolderDialog}
                disabled={isDownloading}
                style={{
                  ...COMPONENT_STYLES.secondaryButton(THEME.default),
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: SPACING.xs,
                  whiteSpace: 'nowrap',
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
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                New Folder
              </button>
            </div>
          </div>

          {/* Single & Multi-Line URL Input */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.xs,
            }}
          >
            <label
              htmlFor="downloader-url-input"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Media links
            </label>
            <textarea
              id="downloader-url-input"
              data-testid="downloader-url-input"
              rows={5}
              value={urlInput}
              onChange={handleUrlInputChange}
              disabled={isDownloading}
              placeholder={
                'https://www.tiktok.com/@creator/video/1234567890\nhttps://www.instagram.com/reel/ABC123xyz/\nhttps://drive.google.com/file/d/1A2B3C/view'
              }
              style={{
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                border: `1px solid ${
                  urlError
                    ? PALETTE.accent3
                    : `var(--border-subtle, ${THEME.default.borders.hairline})`
                }`,
                borderRadius: RADII.sm,
                padding: SPACING.md,
                fontSize: '0.875rem',
                fontFamily: TYPOGRAPHY.fontFamily,
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              Paste one link or multiple links (one per line). Original post captions are automatically saved with each video or image.
            </span>

            {urlError && (
              <div
                role="alert"
                data-testid="downloader-url-error"
                style={{
                  marginTop: SPACING.xs,
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  border: `1px solid ${PALETTE.accent3}`,
                  borderRadius: RADII.sm,
                  color: PALETTE.accent3,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                }}
              >
                {urlError}
              </div>
            )}
          </div>

          {/* Submit Row & Deduplication Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SPACING.md,
              flexWrap: 'wrap',
            }}
          >
            <div>
              {activeDuplicateNoticeCount > 0 && (
                <span
                  data-testid="downloader-dedup-notice"
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    fontVariantNumeric: TYPOGRAPHY.tabularNums,
                  }}
                >
                  Skipped {activeDuplicateNoticeCount} duplicate{' '}
                  {activeDuplicateNoticeCount === 1 ? 'link' : 'links'} in batch
                </span>
              )}
            </div>

            <button
              type="submit"
              data-testid="downloader-submit-button"
              disabled={isDownloading}
              style={{
                ...COMPONENT_STYLES.primaryButton,
                opacity: isDownloading ? 0.75 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACING.sm,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              {isDownloading ? 'Saving to Media Library...' : 'Save to Media Library'}
            </button>
          </div>
        </form>
      </section>

      {/* Unified Windows Copy-Style Batch Progress Banner */}
      {batchProgress && batchProgress.status !== 'idle' && (
        <section
          data-testid="downloader-batch-progress"
          aria-label="Batch download progress"
          style={{
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid ${
              batchProgress.status === 'completed'
                ? PALETTE.accent4
                : `var(--border-subtle, ${THEME.default.borders.hairline})`
            }`,
            borderRadius: RADII.md,
            boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
            padding: SPACING.md,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.sm,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SPACING.md,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                minWidth: 0,
              }}
            >
              <span
                data-testid="downloader-progress-label"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                Saving {batchProgress.completedLinks} of {batchProgress.totalLinks}{' '}
                {batchProgress.totalLinks === 1 ? 'link' : 'links'} to Media Library...
              </span>
              {batchProgress.stage && isDownloading && (
                <span
                  data-testid="downloader-stage-label"
                  style={{
                    fontSize: '0.75rem',
                    color: PALETTE.primary,
                    fontWeight: TYPOGRAPHY.weights.medium,
                  }}
                >
                  [{batchProgress.stage === 'streaming' ? 'Streaming media bytes...' : 'Resolving media link...'}]
                </span>
              )}
              {batchProgress.currentUrl && isDownloading && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '280px',
                  }}
                >
                  {batchProgress.currentUrl}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
              <span
                data-testid="downloader-progress-percent"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  color: getProgressTextColor(batchProgress.status),
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {batchProgress.status === 'cancelled' ? 'Cancelled' : `${progressPercent}%`}
              </span>

              {isDownloading && (
                <button
                  type="button"
                  data-testid="abort-download-btn"
                  onClick={handleAbortDownload}
                  style={{
                    height: '28px',
                    padding: `0 ${SPACING.sm}`,
                    backgroundColor: 'transparent',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    borderRadius: RADII.xs,
                    fontSize: '0.75rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    cursor: 'pointer',
                  }}
                >
                  Abort Download
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '8px',
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              borderRadius: RADII.xs,
              overflow: 'hidden',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            <progress
              value={progressPercent}
              max={100}
              aria-label="Overall batch download progress"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                pointerEvents: 'none',
              }}
            />
            <div
              data-testid="downloader-progress-bar-fill"
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor:
                  batchProgress.status === 'completed'
                    ? PALETTE.accent4
                    : PALETTE.primary,
                transition: 'width 0.15s ease',
              }}
            />
          </div>
        </section>
      )}

      {/* Recent Downloads List */}
      <section
        data-testid="downloader-recent-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              letterSpacing: TYPOGRAPHY.tracking.h2,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Recent Downloads
          </h2>
          {hasRecentActivity && (
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {savedEntries.length} saved
              {failedEntries.length > 0 ? ` · ${failedEntries.length} failed` : ''}
            </span>
          )}
        </div>

        {!hasRecentActivity ? (
          <div
            data-testid="downloader-empty-state"
            style={{
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.md,
              padding: SPACING.xxl,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <span
              style={{
                fontSize: '0.9375rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Nothing downloaded yet
            </span>
            <span
              style={{
                fontSize: '0.8125rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                maxWidth: '48ch',
              }}
            >
              Paste a link above and it will appear here, ready for your library.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.sm,
            }}
          >
            {/* Failed Links (with Retry button) */}
            {failedEntries.map((entry) => {
              const isRetrying = retryingId === entry.id;
              return (
                <article
                  key={entry.id}
                  data-testid="downloader-failed-item"
                  style={{
                    backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                    border: `1px solid ${PALETTE.accent3}`,
                    borderRadius: RADII.md,
                    padding: SPACING.md,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACING.md,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACING.xs,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: TYPOGRAPHY.weights.semibold,
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.url}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: PALETTE.accent3,
                      }}
                    >
                      {entry.errorMessage}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid="downloader-retry-btn"
                    disabled={isRetrying}
                    onClick={() => handleRetryFailedEntry(entry)}
                    style={{
                      ...COMPONENT_STYLES.secondaryButton(THEME.default),
                      border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      height: '34px',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </button>
                </article>
              );
            })}

            {/* Saved Media Items */}
            {savedEntries.map((entry) => (
              <DownloaderSavedItemRow
                key={entry.item.id}
                entry={entry}
                folders={folders}
                onOpenInFolder={handleOpenInFolder}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inline New Folder Creation Modal */}
      <DownloaderNewFolderDialog
        isOpen={isNewFolderDialogOpen}
        onOpenChange={setIsNewFolderDialogOpen}
        onSubmit={handleCreateNewFolder}
        folderName={newFolderName}
        onFolderNameChange={(val) => {
          setNewFolderName(val);
          if (newFolderError) setNewFolderError(null);
        }}
        folderParentId={newFolderParentId}
        onFolderParentIdChange={setNewFolderParentId}
        folderError={newFolderError}
        sortedFolderOptions={sortedFolderOptions}
        isCreatingFolder={isCreatingFolder}
      />
    </div>
  );
}
