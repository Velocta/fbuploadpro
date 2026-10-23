'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/shared/ui';
import {
  buildMediaFolderHref,
  resolveInitialDownloaderFolderId,
  sortFoldersForDownloader,
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
import { DownloaderForm } from './downloader-form';
import { DownloaderProgress } from './downloader-progress';
import { DownloaderRecentList } from './downloader-recent-list';
import { DownloaderNewFolderDialog } from './media-downloader-new-folder-dialog';

/**
 * Downloader surface shell (spec 140 PR-140-2, T10) — composes the
 * form, progress and recent-list sections and owns the surface-level
 * state on top of PR-140-1's frozen data contract (`downloader-data.ts`).
 *
 * Recent-list state: entries saved/failed in this session live in
 * local state; the stored-jobs hydration (OD-140-2) is merged in
 * declaratively at render, so a batch result always precedes hydrated
 * entries and duplicates collapse by id. Retrying a hydrated failure
 * records its resolution/error locally until the jobs query refreshes.
 */
export function DownloaderSurface({
  subdomain,
}: Readonly<{ subdomain: string }>) {
  const router = useRouter();

  const { folders, autoSelectedFolderId } = useDownloaderFolders(subdomain);
  const [userSelectedFolderId, setUserSelectedFolderId] = React.useState<
    string | null | undefined
  >(undefined);
  const selectedFolderId =
    userSelectedFolderId !== undefined
      ? userSelectedFolderId
      : (autoSelectedFolderId ??
        resolveInitialDownloaderFolderId(undefined, folders));

  const [batchProgress, setBatchProgress] =
    React.useState<DownloaderBatchProgressState | null>(null);
  const [deduplicationCount, setDeduplicationCount] = React.useState(0);
  const [savedEntries, setSavedEntries] = React.useState<
    DownloaderSavedEntry[]
  >([]);
  const [failedEntries, setFailedEntries] = React.useState<
    DownloaderFailedEntry[]
  >([]);
  const [resolvedRecentFailedIds, setResolvedRecentFailedIds] = React.useState<
    ReadonlySet<string>
  >(new Set());
  const [recentFailedErrorOverrides, setRecentFailedErrorOverrides] =
    React.useState<ReadonlyMap<string, string>>(new Map());
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const downloaderBatch = useDownloaderBatch(subdomain);
  const createFolderMutation = useCreateDownloaderFolder(subdomain);
  const recentJobsQuery = useRecentDownloaderJobs(subdomain);

  const displayedSavedEntries = React.useMemo(() => {
    const localIds = new Set(savedEntries.map((entry) => entry.item.id));
    const hydrated = (recentJobsQuery.data?.savedEntries ?? []).filter(
      (entry) => !localIds.has(entry.item.id)
    );
    return [...savedEntries, ...hydrated];
  }, [savedEntries, recentJobsQuery.data]);

  const displayedFailedEntries = React.useMemo(() => {
    const localIds = new Set(failedEntries.map((entry) => entry.id));
    const hydrated = (recentJobsQuery.data?.failedEntries ?? [])
      .filter(
        (entry) => !localIds.has(entry.id) && !resolvedRecentFailedIds.has(entry.id)
      )
      .map((entry) => {
        const override = recentFailedErrorOverrides.get(entry.id);
        return override ? { ...entry, errorMessage: override } : entry;
      });
    return [...failedEntries, ...hydrated];
  }, [failedEntries, recentJobsQuery.data, resolvedRecentFailedIds, recentFailedErrorOverrides]);

  const isDownloading = batchProgress?.status === 'downloading';

  const sortedFolderOptions = React.useMemo(
    () => sortFoldersForDownloader(folders),
    [folders]
  );

  const handleAbortDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setBatchProgress((prev) =>
      prev ? { ...prev, status: 'cancelled' } : null
    );
  };

  const handleSubmitBatch = async (
    rawInput: string,
    duplicateCount: number
  ): Promise<boolean> => {
    setDeduplicationCount(duplicateCount);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await downloaderBatch.execute({
        rawInput,
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
      return result.failedEntries.length === 0;
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleRetryFailedEntry = async (entry: DownloaderFailedEntry) => {
    const isLocalEntry = failedEntries.some((item) => item.id === entry.id);
    setRetryingId(entry.id);
    const retryResult = await downloaderBatch.retry({
      entry,
      targetFolderId: entry.folderId ?? selectedFolderId,
    });
    setRetryingId(null);

    if (retryResult.ok) {
      if (isLocalEntry) {
        setFailedEntries((prev) => prev.filter((item) => item.id !== entry.id));
      } else {
        setResolvedRecentFailedIds((prev) => new Set(prev).add(entry.id));
      }
      setSavedEntries((prev) => [...retryResult.savedEntries, ...prev]);
    } else if (retryResult.errorMessage) {
      const errorMessage = retryResult.errorMessage;
      if (isLocalEntry) {
        setFailedEntries((prev) =>
          prev.map((item) =>
            item.id === entry.id ? { ...item, errorMessage } : item
          )
        );
      } else {
        setRecentFailedErrorOverrides(
          (prev) => new Map(prev).set(entry.id, errorMessage)
        );
      }
    }
  };

  const handleOpenInFolder = (folderId: string | null) => {
    router.push(buildMediaFolderHref(subdomain, folderId));
  };

  // Inline New Folder dialog state
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = React.useState(false);
  const [newFolderParentId, setNewFolderParentId] = React.useState<
    string | null
  >(null);

  const handleOpenNewFolderDialog = React.useCallback(() => {
    setNewFolderParentId(selectedFolderId);
    setIsNewFolderDialogOpen(true);
  }, [selectedFolderId]);

  const handleCreateNewFolder = async (
    name: string,
    parentId: string | null
  ): Promise<void> => {
    const created = await createFolderMutation.mutateAsync({
      name,
      parentId,
      existingFolders: folders,
    });
    setUserSelectedFolderId(created.selectedFolderId);
  };

  const activeDuplicateNoticeCount =
    batchProgress && batchProgress.duplicateCount > 0
      ? batchProgress.duplicateCount
      : deduplicationCount;

  return (
    <div
      data-testid="media-downloader-root"
      className="mx-auto flex w-full max-w-260 flex-col gap-6 p-6"
    >
      {/* Page Header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Media Downloader</h1>
        <p className="max-w-170 text-body text-ink-sub">
          Paste video or image links from social platforms, cloud drives, or
          direct web links to save them directly into your Media Library.
        </p>
      </header>

      {/* Main Downloader Input Card */}
      <Card data-testid="downloader-input-card" className="gap-0 py-6">
        <DownloaderForm
          sortedFolderOptions={sortedFolderOptions}
          selectedFolderId={selectedFolderId}
          onSelectedFolderIdChange={setUserSelectedFolderId}
          isDownloading={isDownloading}
          duplicateCount={activeDuplicateNoticeCount}
          onSubmitBatch={handleSubmitBatch}
          onOpenNewFolderDialog={handleOpenNewFolderDialog}
        />
      </Card>

      {/* Unified Batch Progress Banner */}
      <DownloaderProgress
        batchProgress={batchProgress}
        onAbort={handleAbortDownload}
      />

      {/* Recent Downloads List */}
      <DownloaderRecentList
        savedEntries={displayedSavedEntries}
        failedEntries={displayedFailedEntries}
        folders={folders}
        retryingId={retryingId}
        onRetry={handleRetryFailedEntry}
        onOpenInFolder={handleOpenInFolder}
      />

      {/* Inline New Folder Creation Modal */}
      <DownloaderNewFolderDialog
        isOpen={isNewFolderDialogOpen}
        onOpenChange={setIsNewFolderDialogOpen}
        initialParentId={newFolderParentId}
        sortedFolderOptions={sortedFolderOptions}
        onCreateFolder={handleCreateNewFolder}
      />
    </div>
  );
}
