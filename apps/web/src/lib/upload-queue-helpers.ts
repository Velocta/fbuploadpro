import { deriveDefaultCaptionFromFilename } from '@fbuploadpro/contracts';

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
