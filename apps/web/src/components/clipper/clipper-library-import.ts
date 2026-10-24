/**
 * Clipper → Media Library import adapter (spec OD-148-7, variance V-IMPORT).
 *
 * This runs the EXISTING upload flow exactly — upload-url → R2 PUT →
 * thumbnail PUT → confirm — with the existing media schemas. No new API
 * route, no new upload path, no media file edited. Two deliberate
 * deviations from OD-148-7, forced by frozen bridge v1.0 having no
 * binary-read command (see plan §10, V-IMPORT):
 * - the clip bytes arrive as a user-picked File (a browser file input
 *   reads bytes natively in the webview), not via a bridge chunked read;
 * - the thumbnail comes from the existing browser thumbnail util, not
 *   the ffmpeg thumbnail frame (which still ships alongside the export
 *   on disk for a future one-click import).
 * `captionText` is always null: a transcript excerpt is not a caption,
 * and auto-filling it would pollute the library. Importing the same clip
 * twice deliberately creates two library items (no dedupe key exists).
 */
import type { MediaItemResponse } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { MediaItemSchema, UploadUrlResponseSchema } from '@/lib/api/schemas/media';
import { classifyAspectRatio, generateThumbnailBlob } from '@/components/media/media-import-utils';
import { toMediaItemResponse } from '@/components/media/media-data';
import { clipFileName } from './clipper-captions';
import type { ClipSelection } from '@fbuploadpro/contracts';

export interface ClipperImportInput {
  subdomain: string;
  clip: ClipSelection;
  clipIndex: number;
  file: File;
  folderId: string | null;
}

export async function importClipToLibrary(input: ClipperImportInput): Promise<MediaItemResponse> {
  const { subdomain, clip, clipIndex, file, folderId } = input;
  const name = clipFileName(clipIndex, clip.excerpt);
  let thumb: { blob: Blob | null; width: number | null; height: number | null; duration: number | null };
  try {
    thumb = await generateThumbnailBlob(file, 'video');
  } catch {
    thumb = { blob: null, width: null, height: null, duration: null };
  }
  const presigned = await api.post(buildTenantApiPath(subdomain, '/media/upload-url'), {
    fileName: name,
    fileSize: file.size,
    mimeType: file.type || 'video/mp4',
  }, { schema: UploadUrlResponseSchema });
  const putMedia = await fetch(presigned.mediaUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'video/mp4' },
    body: file,
  });
  if (!putMedia.ok) throw new Error('The clip upload failed. Your exported files are untouched — try again.');
  let thumbnailUploaded = false;
  if (thumb.blob && presigned.thumbnailUploadUrl) {
    const putThumb = await fetch(presigned.thumbnailUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: thumb.blob,
    });
    thumbnailUploaded = putThumb.ok;
  }
  const confirmed = await api.post(
    buildTenantApiPath(subdomain, '/media/confirm'),
    {
      mediaId: presigned.mediaId,
      name,
      fileSize: file.size,
      mimeType: file.type || 'video/mp4',
      mediaType: 'video',
      storageKey: presigned.mediaKey,
      folderId,
      url: presigned.publicMediaUrl,
      thumbnailKey: thumbnailUploaded ? presigned.thumbnailKey : null,
      thumbnailUrl: thumbnailUploaded ? presigned.publicThumbnailUrl : null,
      durationSeconds: thumb.duration ?? Math.round(clip.durationSeconds),
      aspectRatio: classifyAspectRatio(thumb.width ?? 0, thumb.height ?? 0),
      width: thumb.width,
      height: thumb.height,
      captionText: null,
    },
    { schema: MediaItemSchema },
  );
  return toMediaItemResponse(confirmed);
}
