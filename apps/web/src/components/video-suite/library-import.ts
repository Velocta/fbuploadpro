/**
 * Media Library import adapter (spec §5.3). Orchestrates the EXISTING
 * library endpoints — POST /media/upload-url → bridge PUT → POST
 * /media/confirm — using the same typed client, timeouts (30 s
 * presign/confirm via AbortSignal) and response schemas as the browser
 * import engine. It does NOT modify components/media/** and does NOT
 * duplicate the browser File/Blob upload path (there is no browser
 * File for a disk path). Shared helpers (aspect-ratio classification,
 * filename-caption derivation) are IMPORTED from components/media/**,
 * never copied or forked.
 *
 * v1.0 LIMITATION (honest, structural): the frozen bridge contract has
 * no disk→presigned-URL upload command, so step 3 cannot execute. The
 * adapter therefore stops after eligibility and reports
 * `upload_unavailable` BEFORE any presign call — it never claims a
 * successful import, never sends media bytes through the JS bridge,
 * and never invents a library row. When a §12 amendment adds the upload
 * primitive, only `uploadViaBridge` changes; the endpoint
 * orchestration below is final.
 */
import {
  ConfirmUploadRequestSchema,
  UploadUrlRequestSchema,
  UploadUrlResponseSchema,
  libraryImportEligibility,
  type LocalFile,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { classifyAspectRatio } from '@/components/media/media-import-utils';
import { deriveDefaultCaption } from '@/components/media/media-types';
import { supportsLibraryUpload } from './bridge-client';

export class BridgeUploadUnavailableError extends Error {
  constructor() {
    super('This desktop app version cannot upload local files to the Media Library yet: the bridge has no file-upload command. A bridge update is required.');
    this.name = 'BridgeUploadUnavailableError';
  }
}

export interface ImportDialogDefaults {
  caption: string;
  aspectRatio: string;
}

export function importDialogDefaults(file: LocalFile): ImportDialogDefaults {
  return {
    caption: deriveDefaultCaption(file.name),
    aspectRatio: classifyAspectRatio(file.width ?? 0, file.height ?? 0),
  };
}

export type ImportEligibilityView =
  | { state: 'eligible'; mimeType: string }
  | { state: 'audio' }
  | { state: 'convert_first' }
  | { state: 'too_large' }
  | { state: 'upload_unavailable' };

/**
 * Full eligibility gate (§5.2) including the structural v1.0 gate:
 * when the bridge cannot upload, every file reports upload_unavailable
 * BEFORE any presign call (no wasted request, no fake progress).
 */
export function importEligibility(file: LocalFile): ImportEligibilityView {
  if (!supportsLibraryUpload()) return { state: 'upload_unavailable' };
  const result = libraryImportEligibility(file.name, file.sizeBytes);
  if (result.eligible) return { state: 'eligible', mimeType: result.mimeType };
  if (result.reason === 'audio') return { state: 'audio' };
  if (result.reason === 'too_large') return { state: 'too_large' };
  return { state: 'convert_first' };
}

export interface PresignResult {
  mediaId: string;
  mediaKey: string;
  thumbnailKey: string;
  mediaUploadUrl: string;
  thumbnailUploadUrl: string;
  publicMediaUrl: string;
  publicThumbnailUrl: string;
}

/** Step 2 of §5.1: presign via the existing endpoint (30 s, same as the browser engine). */
export async function presignLibraryImport(
  subdomain: string,
  file: LocalFile,
  mimeType: string,
): Promise<PresignResult> {
  const body = UploadUrlRequestSchema.parse({
    fileName: file.name,
    fileSize: file.sizeBytes,
    mimeType,
    thumbnailMimeType: 'image/webp',
  });
  const presign = await api.post(buildTenantApiPath(subdomain, '/media/upload-url'), body, {
    schema: UploadUrlResponseSchema,
    signal: AbortSignal.timeout(30_000),
  });
  return {
    mediaId: presign.mediaId,
    mediaKey: presign.mediaKey,
    thumbnailKey: presign.thumbnailKey,
    mediaUploadUrl: presign.mediaUploadUrl,
    thumbnailUploadUrl: presign.thumbnailUploadUrl,
    publicMediaUrl: presign.publicMediaUrl,
    publicThumbnailUrl: presign.publicThumbnailUrl,
  };
}

/**
 * Step 3 of §5.1 — the bridge disk→R2 PUT plus first-frame thumbnail
 * PUT. v1.0: throws BridgeUploadUnavailableError. This is the single
 * function a §12 amendment replaces.
 */
export async function uploadViaBridge(_localFile: LocalFile, _presign: PresignResult): Promise<{ thumbnailDone: boolean }> {
  throw new BridgeUploadUnavailableError();
}

/** Step 4 of §5.1: confirm via the existing endpoint (30 s). Returns the created library item id. */
export async function confirmLibraryImport(
  subdomain: string,
  file: LocalFile,
  mimeType: string,
  presign: PresignResult,
  options: { caption: string; folderId: string | null; thumbnailDone: boolean },
): Promise<string> {
  const body = ConfirmUploadRequestSchema.parse({
    mediaId: presign.mediaId,
    name: file.name,
    fileSize: file.sizeBytes,
    mimeType,
    mediaType: 'video',
    storageKey: presign.mediaKey,
    url: presign.publicMediaUrl,
    thumbnailKey: options.thumbnailDone ? presign.thumbnailKey : null,
    thumbnailUrl: options.thumbnailDone ? presign.publicThumbnailUrl : null,
    durationSeconds: file.durationSeconds,
    aspectRatio: classifyAspectRatio(file.width ?? 0, file.height ?? 0),
    folderId: options.folderId,
    captionText: options.caption,
    width: file.width,
    height: file.height,
  });
  const data = (await api.post(buildTenantApiPath(subdomain, '/media/confirm'), body, {
    signal: AbortSignal.timeout(30_000),
  })) as { id?: unknown };
  if (typeof data.id !== 'string') throw new Error('The Media Library returned an unexpected confirm response.');
  return data.id;
}
