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

      // 2. Direct R2 upload via XHR for real progress events
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', mediaUploadUrl, true);
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
          uploadedThumbnailUrl = publicThumbnailUrl;
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
      });

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
      if (err.message === 'Upload aborted') {
        return;
      }

      // Auto-retry up to 3 times with exponential backoff
      if (item.retryCount < 3) {
        setTimeout(() => {
          setQueue((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'queued', retryCount: it.retryCount + 1 }
                : it
            )
          );
        }, UPLOAD_RETRY_BASE_DELAY_MS * Math.pow(2, item.retryCount));
      } else {
        setQueue((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'failed', validationError: 'failed — retry' } : it
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
