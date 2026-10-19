'use client';

import { useCallback, useEffect } from 'react';
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import type { ImportQueueItem } from './media-types';
import { deriveDefaultCaption } from './media-types';
import {
  generateThumbnailBlob,
  classifyAspectRatio,
  isBatchCompleted,
  MAX_CONCURRENT_UPLOADS,
} from './media-import-utils';

interface UseImportUploadParams {
  subdomain: string;
  selectedFolderId: string | null;
  queue: ImportQueueItem[];
  step: string;
  setQueue: React.Dispatch<React.SetStateAction<ImportQueueItem[]>>;
  setStep: (step: 'staging' | 'progress' | 'complete') => void;
  updateItemProgress: (id: string, pct: number) => void;
  onUploadSuccess?: (item: MediaItemResponse) => void;
}

/** Base delay for upload retry backoff (doubles with each retry). */
const UPLOAD_RETRY_BASE_DELAY_MS = 1000;
/** Max automatic retries after a failed attempt (manual Retry is always available). */
const UPLOAD_MAX_AUTO_RETRIES = 3;

/** Network timeouts: a stalled request must surface an error, never hang at 95%. */
const PRESIGN_TIMEOUT_MS = 30_000;
const CONFIRM_TIMEOUT_MS = 30_000;
const THUMBNAIL_UPLOAD_TIMEOUT_MS = 60_000;
/** Abort the R2 PUT when no bytes move for this long (stall detection). */
const UPLOAD_INACTIVITY_TIMEOUT_MS = 60_000;

/** Progress stages past the 95% XHR cap so the bar keeps moving honestly. */
const PROGRESS_XHR_DONE = 96;
const PROGRESS_THUMBNAIL_DONE = 98;

const TIMEOUT_MESSAGE = 'Upload timed out. Check your connection and try again.';
const NETWORK_MESSAGE = 'Network error during upload. Check your connection and try again.';
const GENERIC_MESSAGE = 'Upload failed. Please try again.';

/** Internal marker for step timeouts (mapped to plain language before display). */
export class StepTimeoutError extends Error {
  constructor(step: string) {
    super(`StepTimeout:${step}`);
    this.name = 'StepTimeoutError';
  }
}

/**
 * Map any caught error to plain-language copy safe for the progress row.
 * Technical detail stays in the console; the user sees what to do next.
 */
export function resolveUploadErrorMessage(err: unknown): string {
  if (err instanceof StepTimeoutError) return TIMEOUT_MESSAGE;
  if (err instanceof DOMException && err.name === 'AbortError') return TIMEOUT_MESSAGE;
  if (err instanceof Error) {
    if (err.message === TIMEOUT_MESSAGE || err.message === NETWORK_MESSAGE) return err.message;
    if (/failed to fetch|networkerror|load failed/i.test(err.message)) return NETWORK_MESSAGE;
    // Messages we already wrote in plain language pass through untouched.
    return err.message;
  }
  return GENERIC_MESSAGE;
}

/**
 * fetch with an explicit timeout. The caller's own AbortSignal (pause/cancel)
 * takes precedence: when it fires, the abort is the user's, not a timeout.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  userSignal?: AbortSignal
): Promise<Response> {
  const combined = new AbortController();
  const timer = setTimeout(() => {
    combined.abort(new StepTimeoutError('request'));
  }, timeoutMs);
  const onUserAbort = () => combined.abort(userSignal?.reason ?? new DOMException('Aborted', 'AbortError'));
  userSignal?.addEventListener('abort', onUserAbort);
  try {
    return await fetch(url, { ...init, signal: combined.signal });
  } catch (err) {
    if (userSignal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }
    if (combined.signal.reason instanceof StepTimeoutError) {
      throw combined.signal.reason;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    userSignal?.removeEventListener('abort', onUserAbort);
  }
}

/**
 * PUT a file to R2 with real progress events and an inactivity watchdog.
 * Progress is capped at 95 while bytes are in flight; the caller advances it
 * through the thumbnail/confirm stages so the bar never freezes at 95%.
 */
function putFileToR2(
  uploadUrl: string,
  file: File,
  mimeType: string,
  userSignal: AbortSignal,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      userSignal.removeEventListener('abort', onUserAbort);
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const armInactivityWatchdog = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        xhr.abort();
        settle(() => reject(new StepTimeoutError('upload')));
      }, UPLOAD_INACTIVITY_TIMEOUT_MS);
    };
    const onUserAbort = () => {
      xhr.abort();
      settle(() => reject(new DOMException('Upload aborted', 'AbortError')));
    };

    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', mimeType);

    xhr.upload.onprogress = (e) => {
      armInactivityWatchdog();
      if (e.lengthComputable) {
        const pct = Math.min(95, Math.round((e.loaded / e.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      settle(() => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed (server responded ${xhr.status}). Please try again.`));
        }
      });
    };

    xhr.onerror = () => {
      settle(() => reject(new Error(NETWORK_MESSAGE)));
    };

    xhr.onabort = () => {
      // The watchdog and user-abort paths already rejected with the right
      // error; this is only a backstop for unexpected aborts.
      settle(() => reject(new DOMException('Upload aborted', 'AbortError')));
    };

    userSignal.addEventListener('abort', onUserAbort);
    armInactivityWatchdog();
    xhr.send(file);
  });
}

export function useImportUpload({
  subdomain,
  selectedFolderId,
  queue,
  step,
  setQueue,
  setStep,
  updateItemProgress,
  onUploadSuccess,
}: UseImportUploadParams) {
const uploadFile = useCallback(
  async (item: ImportQueueItem) => {
    const abortCtrl = new AbortController();
    // Captured so a stale retry timer can never resurrect a paused,
    // cancelled, or already-retried attempt.
    const attemptController = abortCtrl;

    setQueue((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              status: 'uploading',
              abortController: abortCtrl,
              progressPercent: 1,
              validationError: null,
            }
          : it
      )
    );

    const userSignal = abortCtrl.signal;

    try {
      // 1. Request presigned upload URL
      const presignRes = await fetchWithTimeout(
        `/api/tenant/${subdomain}/media/upload-url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: item.name,
            fileSize: item.size,
            mimeType: item.mimeType,
          }),
        },
        PRESIGN_TIMEOUT_MS,
        userSignal
      );

      if (!presignRes.ok) {
        throw new Error("Couldn't start the upload. Please try again.");
      }

      const presignData = await presignRes.json();
      const mediaUploadUrl = presignData.mediaUploadUrl || presignData.uploadUrl;
      const mediaKey = presignData.mediaKey || presignData.storageKey;
      const mediaId = presignData.mediaId;
      const thumbnailUploadUrl = presignData.thumbnailUploadUrl;
      const thumbnailKey = presignData.thumbnailKey;
      const publicMediaUrl = presignData.publicMediaUrl || presignData.url || '';
      const publicThumbnailUrl = presignData.publicThumbnailUrl || presignData.thumbnailUrl || null;

      if (!mediaUploadUrl) {
        throw new Error('Upload URL missing from presign response');
      }

      // 2. Direct R2 upload via XHR for real progress events (watchdog aborts stalls)
      await putFileToR2(mediaUploadUrl, item.file, item.mimeType, userSignal, (pct) =>
        updateItemProgress(item.id, pct)
      );
      updateItemProgress(item.id, PROGRESS_XHR_DONE);

      // 3. Client-side thumbnail generation (already self-times-out in 3s)
      const thumbData = await generateThumbnailBlob(item.file, item.mediaType);
      let uploadedThumbnailUrl: string | null = null;

      if (thumbData.blob && thumbnailUploadUrl) {
        try {
          const thumbRes = await fetchWithTimeout(
            thumbnailUploadUrl,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'image/webp' },
              body: thumbData.blob,
            },
            THUMBNAIL_UPLOAD_TIMEOUT_MS,
            userSignal
          );
          if (thumbRes.ok) uploadedThumbnailUrl = publicThumbnailUrl;
        } catch {
          // Ignore thumbnail upload error; fall back to type icon
        }
        if (userSignal.aborted) throw new DOMException('Upload aborted', 'AbortError');
      }
      updateItemProgress(item.id, PROGRESS_THUMBNAIL_DONE);

      // 4. Confirm upload to Supabase DB
      const confirmRes = await fetchWithTimeout(
        `/api/tenant/${subdomain}/media/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            name: item.name,
            fileSize: item.size,
            mimeType: item.mimeType,
            mediaType: item.mediaType,
            storageKey: mediaKey,
            folderId: selectedFolderId,
            url: publicMediaUrl,
            thumbnailKey: uploadedThumbnailUrl ? thumbnailKey : null,
            thumbnailUrl: uploadedThumbnailUrl,
            durationSeconds: thumbData.duration,
            aspectRatio: classifyAspectRatio(thumbData.width || 0, thumbData.height || 0),
            width: thumbData.width,
            height: thumbData.height,
            captionText: deriveDefaultCaption(item.name),
          }),
        },
        CONFIRM_TIMEOUT_MS,
        userSignal
      );

      if (!confirmRes.ok) {
        throw new Error("Upload finished but we couldn't save it to your library. Please try again.");
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
        onUploadSuccess?.(uploadedItem);
      }
    } catch (err: any) {
      // Pause/cancel: the user stopped this attempt — stay silent, no retry.
      if (userSignal.aborted) {
        return;
      }

      const message = resolveUploadErrorMessage(err);

      // Auto-retry up to N times with exponential backoff. The timer only
      // requeues when this exact attempt is still the live one; a pause,
      // cancel, or manual retry in the meantime cancels the retry.
      if (item.retryCount < UPLOAD_MAX_AUTO_RETRIES) {
        setTimeout(() => {
          setQueue((prev) => {
            const current = prev.find((it) => it.id === item.id);
            if (
              !current ||
              current.status !== 'uploading' ||
              current.abortController !== attemptController
            ) {
              return prev;
            }
            return prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'queued', retryCount: it.retryCount + 1 }
                : it
            );
          });
        }, UPLOAD_RETRY_BASE_DELAY_MS * Math.pow(2, item.retryCount));
      } else {
        setQueue((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'failed', validationError: message } : it
          )
        );
      }
    }
  },
  [subdomain, selectedFolderId, onUploadSuccess, updateItemProgress]
);

// Concurrency Engine Loop (Cap = MAX_CONCURRENT_UPLOADS)
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

  if (isBatchCompleted(queue, step)) {
    setStep('complete');
  }
  }, [subdomain, selectedFolderId, queue, step, setQueue, setStep, updateItemProgress, onUploadSuccess]);

  return uploadFile;
}
