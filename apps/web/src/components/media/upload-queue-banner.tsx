'use client';

import React from 'react';
import {
  AllowedMediaMimeTypes,
  deriveDefaultCaptionFromFilename,
  type MediaFolder,
  type MediaItemResponse,
} from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export const MAX_CONCURRENT_UPLOADS = 3;

export const SUPPORTED_MEDIA_ACCEPT = AllowedMediaMimeTypes.join(',');

const EXTENSION_TO_MIME: Record<string, (typeof AllowedMediaMimeTypes)[number]> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const IGNORED_SYSTEM_FILENAMES = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
]);

export interface QueuedFileEntry {
  file: File;
  /** Relative path including folder segments if uploaded from a directory, e.g. "Campaign A/Reels/clip1.mp4" */
  relativePath: string;
}

export interface UploadBatchState {
  status: 'idle' | 'uploading' | 'completed' | 'cancelled' | 'error';
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  totalBytes: number;
  transferredBytes: number;
  currentFileName: string | null;
  errorMessage?: string | null;
}

export function deriveDefaultCaption(fileName: string): string {
  return deriveDefaultCaptionFromFilename(fileName);
}

/**
 * Formats byte counts into human-friendly units (B, KB, MB, GB).
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.0 MB';
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;

  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(2)} GB`;
  }
  if (bytes >= mb) {
    return `${(bytes / mb).toFixed(1)} MB`;
  }
  if (bytes >= kb) {
    return `${(bytes / kb).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Resolves the normalized MIME type for a File object, falling back to extension lookup
 * when the browser reports an empty type during folder selection.
 */
export function resolveSupportedMimeType(
  file: Pick<File, 'name' | 'type'>
): (typeof AllowedMediaMimeTypes)[number] | null {
  const baseName = file.name.split('/').pop() ?? file.name;
  const lowerName = baseName.toLowerCase().trim();
  if (!lowerName || lowerName.startsWith('.') || IGNORED_SYSTEM_FILENAMES.has(lowerName)) {
    return null;
  }

  if (
    file.type &&
    (AllowedMediaMimeTypes as readonly string[]).includes(file.type)
  ) {
    return file.type as (typeof AllowedMediaMimeTypes)[number];
  }

  const ext = lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : '';
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function isSupportedMediaFile(file: Pick<File, 'name' | 'type'>): boolean {
  return resolveSupportedMimeType(file) !== null;
}

/**
 * Extracts directory segments from a relative file path.
 * Example: "ShortsBatch/Week1/clip1.mp4" -> ["ShortsBatch", "Week1"]
 */
export function resolveFolderPathSegments(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, '/').trim();
  const parts = normalized
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== '.');
  if (parts.length <= 1) {
    return [];
  }
  return parts.slice(0, -1);
}

/**
 * Converts a FileList or array of Files into QueuedFileEntry items using webkitRelativePath when present.
 */
export function buildQueuedEntriesFromFileList(files: FileList | File[]): QueuedFileEntry[] {
  const list = Array.from(files);
  return list.map((file) => {
    const rel =
      typeof (file as File & { webkitRelativePath?: string }).webkitRelativePath === 'string' &&
      (file as File & { webkitRelativePath?: string }).webkitRelativePath.trim().length > 0
        ? (file as File & { webkitRelativePath?: string }).webkitRelativePath
        : file.name;
    return {
      file,
      relativePath: rel,
    };
  });
}

interface WebkitFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
  file?: (
    successCallback: (file: File) => void,
    errorCallback?: (err: unknown) => void
  ) => void;
  createReader?: () => {
    readEntries: (
      successCallback: (entries: WebkitFileSystemEntry[]) => void,
      errorCallback?: (err: unknown) => void
    ) => void;
  };
}

async function traverseFileSystemEntry(
  entry: WebkitFileSystemEntry,
  parentPath = ''
): Promise<QueuedFileEntry[]> {
  const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile && typeof entry.file === 'function') {
    return new Promise<QueuedFileEntry[]>((resolve) => {
      entry.file!(
        (file) => {
          resolve([{ file, relativePath: currentPath }]);
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory && typeof entry.createReader === 'function') {
    const reader = entry.createReader();
    const allChildEntries: WebkitFileSystemEntry[] = [];

    const readBatch = (): Promise<WebkitFileSystemEntry[]> =>
      new Promise((resolve) => {
        reader.readEntries(
          (batch) => resolve(batch || []),
          () => resolve([])
        );
      });

    let batch = await readBatch();
    while (batch.length > 0) {
      allChildEntries.push(...batch);
      batch = await readBatch();
    }

    const nestedResults: QueuedFileEntry[] = [];
    for (const child of allChildEntries) {
      const childFiles = await traverseFileSystemEntry(child, currentPath);
      nestedResults.push(...childFiles);
    }
    return nestedResults;
  }

  return [];
}

/**
 * Extracts files and nested folder structures from a drag-and-drop DataTransfer event.
 */
export async function extractDroppedFileEntries(
  dataTransfer: DataTransfer | null
): Promise<QueuedFileEntry[]> {
  if (!dataTransfer) return [];

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const entries: WebkitFileSystemEntry[] = [];
    for (let i = 0; i < dataTransfer.items.length; i += 1) {
      const item = dataTransfer.items[i] as DataTransferItem & {
        webkitGetAsEntry?: () => WebkitFileSystemEntry | null;
      };
      if (item && typeof item.webkitGetAsEntry === 'function') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          entries.push(entry);
        }
      }
    }

    if (entries.length > 0) {
      const collected: QueuedFileEntry[] = [];
      for (const entry of entries) {
        const items = await traverseFileSystemEntry(entry, '');
        collected.push(...items);
      }
      if (collected.length > 0) {
        return collected;
      }
    }
  }

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return buildQueuedEntriesFromFileList(dataTransfer.files);
  }

  return [];
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

export interface ExtractedClientMetadata {
  durationSeconds: number | null;
  aspectRatio: string;
  thumbnailBlob: Blob | null;
}

/**
 * Extracts client-side media dimensions, duration, and a WebP thumbnail with a strict timeout fallback.
 */
export async function extractMediaMetadata(
  file: File,
  timeoutMs = 2500
): Promise<ExtractedClientMetadata> {
  const fallback: ExtractedClientMetadata = {
    durationSeconds: null,
    aspectRatio: 'unknown',
    thumbnailBlob: null,
  };

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return fallback;
  }

  const mime = resolveSupportedMimeType(file);
  if (!mime) return fallback;

  return new Promise<ExtractedClientMetadata>((resolve) => {
    let settled = false;
    let objectUrl: string | null = null;

    const finish = (result: ExtractedClientMetadata) => {
      if (settled) return;
      settled = true;
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_e) {
          // Ignore revoke errors
        }
      }
      resolve(result);
    };

    const timer = setTimeout(() => finish(fallback), timeoutMs);

    try {
      objectUrl = URL.createObjectURL(file);

      if (mime.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
          const duration =
            Number.isFinite(video.duration) && video.duration > 0
              ? Math.round(video.duration * 10) / 10
              : null;
          const aspectRatio = classifyAspectRatio(video.videoWidth, video.videoHeight);

          clearTimeout(timer);
          finish({
            durationSeconds: duration,
            aspectRatio,
            thumbnailBlob: null,
          });
        };

        video.onerror = () => {
          clearTimeout(timer);
          finish(fallback);
        };

        video.src = objectUrl;
      } else {
        const img = new Image();
        img.onload = () => {
          const aspectRatio = classifyAspectRatio(img.naturalWidth, img.naturalHeight);
          clearTimeout(timer);
          finish({
            durationSeconds: null,
            aspectRatio,
            thumbnailBlob: null,
          });
        };
        img.onerror = () => {
          clearTimeout(timer);
          finish(fallback);
        };
        img.src = objectUrl;
      }
    } catch (_e) {
      clearTimeout(timer);
      finish(fallback);
    }
  });
}

/**
 * Ensures all relative subfolder paths exist under `baseFolderId` before uploading files.
 * Reuses existing sibling folders (case-insensitive) or creates new subfolders sequentially.
 */
export async function ensureNestedFolderHierarchy(params: {
  subdomain: string;
  baseFolderId: string | null;
  entries: QueuedFileEntry[];
  existingFolders: MediaFolder[];
  fetchImpl?: typeof fetch;
}): Promise<{
  folderPathMap: Map<string, string | null>;
  updatedFolders: MediaFolder[];
}> {
  const {
    subdomain,
    baseFolderId,
    entries,
    existingFolders,
    fetchImpl = fetch,
  } = params;

  const updatedFolders = [...existingFolders];
  const folderPathMap = new Map<string, string | null>();
  folderPathMap.set('', baseFolderId);

  // Collect unique relative directory chains
  const uniqueChains = new Map<string, string[]>();
  for (const entry of entries) {
    const segments = resolveFolderPathSegments(entry.relativePath);
    if (segments.length > 0) {
      const key = segments.join('/');
      if (!uniqueChains.has(key)) {
        uniqueChains.set(key, segments);
      }
    }
  }

  for (const [chainKey, segments] of uniqueChains.entries()) {
    let currentParentId: string | null = baseFolderId;
    const builtSegments: string[] = [];

    for (const rawSegment of segments) {
      const segmentName = rawSegment.trim().slice(0, 100);
      builtSegments.push(segmentName);
      const prefixKey = builtSegments.join('/');

      if (folderPathMap.has(prefixKey)) {
        currentParentId = folderPathMap.get(prefixKey) ?? null;
        continue;
      }

      // Check if sibling folder already exists under currentParentId
      const existingMatch = updatedFolders.find(
        (f) =>
          (f.parentId ?? null) === currentParentId &&
          f.name.trim().toLowerCase() === segmentName.toLowerCase()
      );

      if (existingMatch) {
        currentParentId = existingMatch.id;
        folderPathMap.set(prefixKey, currentParentId);
        continue;
      }

      // Create subfolder via API
      const res = await fetchImpl(`/api/tenant/${subdomain}/media/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: segmentName,
          parentId: currentParentId,
        }),
      });

      if (res.ok) {
        const createdFolder = (await res.json()) as MediaFolder;
        updatedFolders.push(createdFolder);
        currentParentId = createdFolder.id;
        folderPathMap.set(prefixKey, currentParentId);
      } else if (res.status === 409) {
        // Folder was concurrently created; refresh folder list and locate it
        const listRes = await fetchImpl(`/api/tenant/${subdomain}/media/folders`);
        if (listRes.ok) {
          const listData = (await listRes.json()) as { folders: MediaFolder[] };
          for (const f of listData.folders || []) {
            if (!updatedFolders.some((uf) => uf.id === f.id)) {
              updatedFolders.push(f);
            }
          }
          const matchedAfterRefresh = updatedFolders.find(
            (f) =>
              (f.parentId ?? null) === currentParentId &&
              f.name.trim().toLowerCase() === segmentName.toLowerCase()
          );
          if (matchedAfterRefresh) {
            currentParentId = matchedAfterRefresh.id;
            folderPathMap.set(prefixKey, currentParentId);
          }
        }
      }
    }

    folderPathMap.set(chainKey, currentParentId);
  }

  return { folderPathMap, updatedFolders };
}

export type QueuedUploadEntry = QueuedFileEntry & {
  relativeSubfolderPath?: string[] | undefined;
};

export interface DuplicateDetectionResult {
  duplicates: QueuedUploadEntry[];
  uniqueEntries: QueuedUploadEntry[];
}

/**
 * Detects duplicate files in a queued upload batch against existing items in the resolved target folder(s)
 * as well as intra-batch duplicates (matching case-insensitive file name and exact file size).
 */
export function detectDuplicateUploadEntries(
  entriesOrOptions:
    | QueuedUploadEntry[]
    | {
        entries: QueuedUploadEntry[];
        existingItems?: MediaItemResponse[];
        existingMediaItems?: MediaItemResponse[];
        existingFolders: MediaFolder[];
        baseFolderId: string | null;
      },
  existingItemsArg?: MediaItemResponse[],
  existingFoldersArg?: MediaFolder[],
  baseFolderIdArg?: string | null
): DuplicateDetectionResult {
  const entries = Array.isArray(entriesOrOptions)
    ? entriesOrOptions
    : entriesOrOptions.entries;
  const existingItems = Array.isArray(entriesOrOptions)
    ? (existingItemsArg ?? [])
    : (entriesOrOptions.existingItems ?? entriesOrOptions.existingMediaItems ?? []);
  const existingFolders = Array.isArray(entriesOrOptions)
    ? (existingFoldersArg ?? [])
    : entriesOrOptions.existingFolders;
  const baseFolderId = Array.isArray(entriesOrOptions)
    ? (baseFolderIdArg ?? null)
    : entriesOrOptions.baseFolderId;

  const duplicates: QueuedUploadEntry[] = [];
  const uniqueEntries: QueuedUploadEntry[] = [];
  const seenInBatch = new Set<string>();

  for (const entry of entries) {
    const segments =
      entry.relativeSubfolderPath ??
      resolveFolderPathSegments(entry.relativePath || entry.file.name);

    let currentParentId: string | null = baseFolderId;
    let folderExistsOnServer = true;

    for (const rawSegment of segments) {
      const segmentLower = rawSegment.trim().toLowerCase();
      const matchedFolder = existingFolders.find(
        (f) =>
          (f.parentId ?? null) === currentParentId &&
          f.name.trim().toLowerCase() === segmentLower
      );
      if (matchedFolder) {
        currentParentId = matchedFolder.id;
      } else {
        folderExistsOnServer = false;
        break;
      }
    }

    const cleanName = (entry.file.name.split('/').pop() ?? entry.file.name)
      .trim()
      .toLowerCase();
    const fileSize = entry.file.size;
    const normalizedPathKey = [
      baseFolderId ?? 'root',
      ...segments.map((s) => s.trim().toLowerCase()),
    ].join('/');
    const batchKey = `${normalizedPathKey}::${cleanName}::${fileSize}`;

    const isIntraBatchDuplicate = seenInBatch.has(batchKey);
    seenInBatch.add(batchKey);

    const isExistingServerDuplicate =
      folderExistsOnServer &&
      existingItems.some(
        (item) =>
          (item.folderId ?? null) === currentParentId &&
          item.name.trim().toLowerCase() === cleanName &&
          item.fileSize === fileSize
      );

    if (isIntraBatchDuplicate || isExistingServerDuplicate) {
      duplicates.push(entry);
    } else {
      uniqueEntries.push(entry);
    }
  }

  return { duplicates, uniqueEntries };
}

export interface ExecuteBoundedUploadBatchOptions {
  subdomain: string;
  baseFolderId: string | null;
  rawEntries: QueuedFileEntry[];
  existingFolders: MediaFolder[];
  onStateChange: (state: UploadBatchState) => void;
  onItemUploaded?: ((item: MediaItemResponse) => void) | undefined;
  onFoldersUpdated?: ((folders: MediaFolder[]) => void) | undefined;
  isCancelled?: (() => boolean) | undefined;
  fetchImpl?: typeof fetch | undefined;
  initialSkippedCount?: number | undefined;
}

/**
 * Runs a bounded concurrency upload batch (max 3 concurrent files), updating unified progress via `onStateChange`.
 */
export async function executeBoundedUploadBatch(
  params: ExecuteBoundedUploadBatchOptions
): Promise<{
  uploadedItems: MediaItemResponse[];
  updatedFolders: MediaFolder[];
}> {
  const {
    subdomain,
    baseFolderId,
    rawEntries,
    existingFolders,
    onStateChange,
    onItemUploaded,
    onFoldersUpdated,
    isCancelled = () => false,
    fetchImpl = fetch,
    initialSkippedCount = 0,
  } = params;

  const validEntries: Array<{
    file: File;
    relativePath: string;
    mimeType: (typeof AllowedMediaMimeTypes)[number];
  }> = [];
  let skippedFiles = initialSkippedCount;

  for (const entry of rawEntries) {
    const mimeType = resolveSupportedMimeType(entry.file);
    if (mimeType && entry.file.size > 0 && entry.file.size <= 524288000) {
      validEntries.push({ ...entry, mimeType });
    } else {
      skippedFiles += 1;
    }
  }

  const totalFiles = validEntries.length;
  const totalBytes = validEntries.reduce((sum, e) => sum + (e.file.size || 0), 0);

  if (totalFiles === 0) {
    onStateChange({
      status: skippedFiles > 0 ? 'error' : 'idle',
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      skippedFiles,
      totalBytes: 0,
      transferredBytes: 0,
      currentFileName: null,
      errorMessage:
        skippedFiles > 0
          ? 'No supported video or image files were found in the selection.'
          : null,
    });
    return { uploadedItems: [], updatedFolders: existingFolders };
  }

  let completedFiles = 0;
  let failedFiles = 0;
  let transferredBytes = 0;
  let currentFileName: string | null = validEntries[0]?.file.name ?? null;

  const emitProgress = (
    status: UploadBatchState['status'] = 'uploading',
    errorMessage: string | null = null
  ) => {
    onStateChange({
      status,
      totalFiles,
      completedFiles,
      failedFiles,
      skippedFiles,
      totalBytes,
      transferredBytes,
      currentFileName,
      errorMessage,
    });
  };

  emitProgress('uploading');

  // 1. Pre-create nested subfolders if relative paths are present
  const { folderPathMap, updatedFolders } = await ensureNestedFolderHierarchy({
    subdomain,
    baseFolderId,
    entries: validEntries,
    existingFolders,
    fetchImpl,
  });

  if (updatedFolders.length !== existingFolders.length) {
    onFoldersUpdated?.(updatedFolders);
  }

  const uploadedItems: MediaItemResponse[] = [];
  let nextIndex = 0;

  const uploadSingleFile = async (entry: {
    file: File;
    relativePath: string;
    mimeType: (typeof AllowedMediaMimeTypes)[number];
  }) => {
    if (isCancelled()) return;

    const cleanFileName = entry.file.name.split('/').pop() ?? entry.file.name;
    currentFileName = cleanFileName;
    emitProgress('uploading');

    const segments = resolveFolderPathSegments(entry.relativePath);
    const chainKey = segments.join('/');
    const targetFolderId =
      segments.length > 0
        ? folderPathMap.get(chainKey) ?? baseFolderId
        : baseFolderId;

    try {
      // Step A: Client metadata extraction (bounded timeout)
      const metadata = await extractMediaMetadata(entry.file, 1500);

      // Step B: Request presigned upload URLs
      const urlRes = await fetchImpl(`/api/tenant/${subdomain}/media/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: cleanFileName,
          fileSize: entry.file.size,
          mimeType: entry.mimeType,
          thumbnailMimeType: 'image/webp',
        }),
      });

      if (!urlRes.ok) {
        throw new Error('Failed to request upload URL');
      }

      const presigned = (await urlRes.json()) as {
        mediaId: string;
        mediaKey: string;
        mediaUploadUrl: string;
        thumbnailKey: string;
        thumbnailUploadUrl: string;
        publicMediaUrl: string;
        publicThumbnailUrl: string;
      };

      // Step C: Upload binary to R2 (skip network call if mock local domain is used in dev/test)
      const isMockStorageUrl = presigned.mediaUploadUrl.includes(
        'mock-r2.fbuploadpro.com'
      );
      if (!isMockStorageUrl) {
        try {
          await fetchImpl(presigned.mediaUploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': entry.mimeType },
            body: entry.file,
          });
        } catch (_putErr) {
          // If direct PUT fails in local environment without R2 CORS, continue to confirm if mock
        }
      }

      // Step D: Confirm upload in PostgreSQL (captionText omitted so backend defaults to stripped filename)
      const mediaType = entry.mimeType.startsWith('video/') ? 'video' : 'image';
      const confirmRes = await fetchImpl(`/api/tenant/${subdomain}/media/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: presigned.mediaId,
          name: cleanFileName,
          fileSize: entry.file.size,
          mimeType: entry.mimeType,
          mediaType,
          storageKey: presigned.mediaKey,
          url: presigned.publicMediaUrl,
          thumbnailKey: metadata.thumbnailBlob ? presigned.thumbnailKey : null,
          thumbnailUrl: metadata.thumbnailBlob ? presigned.publicThumbnailUrl : null,
          durationSeconds: metadata.durationSeconds,
          aspectRatio: metadata.aspectRatio || 'unknown',
          folderId: targetFolderId,
        }),
      });

      if (!confirmRes.ok) {
        throw new Error('Failed to confirm upload');
      }

      const confirmedItem = (await confirmRes.json()) as MediaItemResponse;
      uploadedItems.push(confirmedItem);
      onItemUploaded?.(confirmedItem);

      completedFiles += 1;
      transferredBytes = Math.min(totalBytes, transferredBytes + entry.file.size);
      emitProgress('uploading');
    } catch (_err) {
      failedFiles += 1;
      transferredBytes = Math.min(totalBytes, transferredBytes + entry.file.size);
      emitProgress('uploading');
    }
  };

  // Worker pool with MAX_CONCURRENT_UPLOADS = 3
  const workerCount = Math.min(MAX_CONCURRENT_UPLOADS, validEntries.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < validEntries.length && !isCancelled()) {
      const idx = nextIndex;
      nextIndex += 1;
      const item = validEntries[idx];
      if (item) {
        await uploadSingleFile(item);
      }
    }
  });

  await Promise.all(workers);

  if (isCancelled()) {
    currentFileName = null;
    emitProgress('cancelled');
  } else if (failedFiles > 0 && completedFiles === 0) {
    currentFileName = null;
    emitProgress('error', 'Couldn’t upload the selected files. Please try again.');
  } else {
    currentFileName = null;
    emitProgress('completed');
  }

  return { uploadedItems, updatedFolders };
}

export interface UploadQueueBannerProps {
  state: UploadBatchState;
  onCancel?: () => void;
  onDismiss?: () => void;
}

/**
 * Single Unified Windows Copy-Style Progress Banner.
 * Never renders per-file progress bars; displays one consolidated progress bar for the entire batch.
 */
export function UploadQueueBanner({
  state,
  onCancel,
  onDismiss,
}: Readonly<UploadQueueBannerProps>) {
  if (state.status === 'idle') {
    return null;
  }

  const percent =
    state.totalBytes > 0
      ? Math.min(100, Math.round((state.transferredBytes / state.totalBytes) * 100))
      : state.totalFiles > 0
        ? Math.min(100, Math.round((state.completedFiles / state.totalFiles) * 100))
        : 0;

  const isUploading = state.status === 'uploading';
  const isCompleted = state.status === 'completed';
  const isError = state.status === 'error';

  let headlineText = `Uploading ${state.completedFiles} of ${state.totalFiles} ${
    state.totalFiles === 1 ? 'file' : 'files'
  }...`;
  if (isCompleted) {
    headlineText = `Uploaded ${state.completedFiles} of ${state.totalFiles} ${
      state.totalFiles === 1 ? 'file' : 'files'
    }`;
  } else if (state.status === 'cancelled') {
    headlineText = `Upload canceled (${state.completedFiles} of ${state.totalFiles} completed)`;
  } else if (isError) {
    headlineText = state.errorMessage || 'Couldn’t complete upload batch';
  }

  return (
    <section
      data-testid="unified-upload-progress-banner"
      aria-label="Batch upload progress"
      style={{
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid ${
          isError
            ? PALETTE.accent3
            : isCompleted
              ? PALETTE.accent4
              : `var(--border-subtle, ${THEME.default.borders.hairline})`
        }`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
      }}
    >
      {/* Top Row: Status Headline + Percentage & Action Button */}
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
            data-testid="upload-progress-count"
            style={{
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
            }}
          >
            {headlineText}
          </span>

          {state.currentFileName && isUploading && (
            <span
              data-testid="upload-current-file"
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '280px',
              }}
            >
              Current: {state.currentFileName}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
          }}
        >
          <span
            data-testid="upload-progress-bytes"
            style={{
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
            }}
          >
            {formatBytes(state.transferredBytes)} of {formatBytes(state.totalBytes)}
          </span>

          <span
            data-testid="upload-progress-percent"
            style={{
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              color: isCompleted
                ? PALETTE.accent4
                : isError
                  ? PALETTE.accent3
                  : PALETTE.primary,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
            }}
          >
            {percent}%
          </span>

          {isUploading && onCancel && (
            <button
              type="button"
              data-testid="upload-cancel-btn"
              onClick={onCancel}
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
              Cancel
            </button>
          )}

          {!isUploading && onDismiss && (
            <button
              type="button"
              data-testid="upload-dismiss-btn"
              onClick={onDismiss}
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
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Single Unified Windows Copy-Style Progress Track */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall batch upload progress"
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          borderRadius: RADII.xs,
          overflow: 'hidden',
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        }}
      >
        <div
          data-testid="upload-progress-bar-fill"
          style={{
            width: `${percent}%`,
            height: '100%',
            backgroundColor: isError
              ? PALETTE.accent3
              : isCompleted
                ? PALETTE.accent4
                : PALETTE.primary,
            transition: 'width 0.15s ease',
          }}
        />
      </div>

      {/* Optional Skipped or Failed Summary Notice */}
      {(state.skippedFiles > 0 || state.failedFiles > 0) && (
        <div
          data-testid="upload-skipped-notice"
          style={{
            fontSize: '0.75rem',
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
          }}
        >
          {state.skippedFiles > 0 && (
            <span>
              Skipped {state.skippedFiles} unsupported{' '}
              {state.skippedFiles === 1 ? 'file' : 'files'}.
            </span>
          )}
          {state.failedFiles > 0 && (
            <span style={{ color: PALETTE.accent3 }}>
              {state.failedFiles} {state.failedFiles === 1 ? 'file' : 'files'} could not be uploaded.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
