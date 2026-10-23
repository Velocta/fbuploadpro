/**
 * Video frame capture (spec 133 §6.6 / PR-133-5).
 *
 * Extracted verbatim from the legacy preview monolith: captures the
 * current frame of a <video> element as a WebP image (used by "Set
 * Current Frame as Thumbnail"). The behaviour is a preserved contract
 * (PB-14): the frame is downscaled to at most 640px on its long edge,
 * encoded at 0.85 quality, and every failure path — no document, a
 * tainted/failed draw, a hanging or missing `canvas.toBlob` — falls
 * back to a 1×1 transparent WebP data URL, never a throw and never an
 * empty result. This is a pure utility: no React, no DOM beyond the
 * canvas the caller’s video element already lives in.
 */

export interface CapturedVideoFrame {
  blob: Blob | null;
  dataUrl: string;
}

const FALLBACK_WEBP_DATA_URL =
  'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

/** Safety timeout for canvas.toBlob() — resolves null if the browser hangs. */
const CANVAS_TO_BLOB_TIMEOUT_MS = 60;

export async function captureVideoFrameAsWebp(
  videoElement: HTMLVideoElement | null
): Promise<CapturedVideoFrame> {
  if (typeof document === 'undefined') {
    return { blob: null, dataUrl: FALLBACK_WEBP_DATA_URL };
  }

  try {
    const rawWidth = videoElement?.videoWidth || 640;
    const rawHeight = videoElement?.videoHeight || 360;
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(rawWidth, rawHeight, 1));
    const width = Math.max(1, Math.round(rawWidth * scale));
    const height = Math.max(1, Math.round(rawHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    let dataUrl = FALLBACK_WEBP_DATA_URL;
    try {
      const ctx = canvas.getContext('2d');
      if (ctx && videoElement) {
        ctx.drawImage(videoElement, 0, 0, width, height);
      }
      if (typeof canvas.toDataURL === 'function') {
        const encoded = canvas.toDataURL('image/webp', 0.85);
        if (encoded && encoded.startsWith('data:image/')) {
          dataUrl = encoded;
        }
      }
    } catch (_drawErr) {
      dataUrl = FALLBACK_WEBP_DATA_URL;
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      if (typeof canvas.toBlob !== 'function') {
        resolve(null);
        return;
      }
      const timer = setTimeout(() => resolve(null), CANVAS_TO_BLOB_TIMEOUT_MS);
      try {
        canvas.toBlob(
          (b) => {
            clearTimeout(timer);
            resolve(b);
          },
          'image/webp',
          0.85
        );
      } catch (_blobErr) {
        clearTimeout(timer);
        resolve(null);
      }
    });

    return { blob, dataUrl };
  } catch (_err) {
    return { blob: null, dataUrl: FALLBACK_WEBP_DATA_URL };
  }
}

export { FALLBACK_WEBP_DATA_URL };
