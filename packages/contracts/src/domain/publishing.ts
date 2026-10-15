import { z } from 'zod';

export const PostFormatValues = ['text', 'image', 'reel', 'video', 'story'] as const;
export const PostFormatSchema = z.enum(PostFormatValues);
export type PostFormat = z.infer<typeof PostFormatSchema>;

export interface GraphRateLimitTelemetry {
  appUsageMaxPct?: number | undefined;
  bucUsageMaxPct?: number | undefined;
  estimatedTimeToRegainAccessMinutes?: number | undefined;
}

export interface PublishResult {
  postId: string;
  telemetry?: GraphRateLimitTelemetry | undefined;
}

export interface MediaEligibilityInput {
  mediaType: 'video' | 'image';
  fileSize?: number | null | undefined;
  durationSeconds?: number | null | undefined;
  aspectRatio?: string | null | undefined;
}

export interface ValidatePostFormatInput {
  postFormat: PostFormat;
  caption?: string | null | undefined;
  firstComment?: string | null | undefined;
  linkUrl?: string | null | undefined;
  media?: MediaEligibilityInput | null | undefined;
}

export interface FormatValidationResult {
  valid: boolean;
  error?: string | undefined;
  warnings?: string[] | undefined;
}

/**
 * Validates whether the supplied post parameters and media attributes satisfy the constraints
 * of the chosen Facebook publishing format ('text', 'image', 'reel', 'video', 'story').
 */
export function validatePostFormatEligibility(input: ValidatePostFormatInput): FormatValidationResult {
  const { postFormat, caption, firstComment, linkUrl, media } = input;
  const warnings: string[] = [];

  switch (postFormat) {
    case 'text': {
      if (media) {
        return { valid: false, error: 'Text posts cannot have attached media files.' };
      }
      const hasCaption = Boolean(caption && caption.trim().length > 0);
      const hasLinkUrl = Boolean(linkUrl && linkUrl.trim().length > 0);
      if (!hasCaption && !hasLinkUrl) {
        return { valid: false, error: 'Text posts require a non-empty caption or link URL.' };
      }
      return { valid: true };
    }

    case 'image': {
      if (!media) {
        return { valid: false, error: 'Image posts require an attached image file.' };
      }
      if (media.mediaType !== 'image') {
        return { valid: false, error: 'Image posts require an image asset, not a video.' };
      }
      return { valid: true };
    }

    case 'reel': {
      if (!media) {
        return { valid: false, error: 'Reels require an attached video file.' };
      }
      if (media.mediaType !== 'video') {
        return { valid: false, error: 'Reels require a video asset, not an image.' };
      }
      if (media.durationSeconds !== null && media.durationSeconds !== undefined && media.durationSeconds > 90) {
        return { valid: false, error: 'Reels cannot exceed 90 seconds. Choose Feed Video instead.' };
      }
      if (media.aspectRatio && media.aspectRatio !== '9:16') {
        warnings.push('Reels perform best in 9:16 vertical aspect ratio.');
      }
      return { valid: true, ...(warnings.length > 0 ? { warnings } : {}) };
    }

    case 'video': {
      if (!media) {
        return { valid: false, error: 'Feed Videos require an attached video file.' };
      }
      if (media.mediaType !== 'video') {
        return { valid: false, error: 'Feed Videos require a video asset, not an image.' };
      }
      return { valid: true };
    }

    case 'story': {
      if (!media) {
        return { valid: false, error: 'Facebook Stories require an attached media file.' };
      }
      if (firstComment && firstComment.trim().length > 0) {
        return { valid: false, error: 'Facebook Stories do not support comments.' };
      }
      if (media.mediaType === 'image') {
        if (media.fileSize !== null && media.fileSize !== undefined && media.fileSize > 10 * 1024 * 1024) {
          return { valid: false, error: 'Photo Stories cannot exceed 10 MB.' };
        }
      } else if (media.mediaType === 'video') {
        if (media.durationSeconds !== null && media.durationSeconds !== undefined && media.durationSeconds > 60) {
          return { valid: false, error: 'Video Stories cannot exceed 60 seconds.' };
        }
      }
      return { valid: true };
    }

    default: {
      return { valid: false, error: `Unsupported post format: ${String(postFormat)}` };
    }
  }
}

/**
 * Returns all post formats compatible with a given media asset.
 */
export function getEligiblePostFormatsForMedia(media: MediaEligibilityInput): PostFormat[] {
  if (media.mediaType === 'image') {
    if (media.fileSize !== null && media.fileSize !== undefined && media.fileSize > 10 * 1024 * 1024) {
      return ['image'];
    }
    return ['image', 'story'];
  }

  const formats: PostFormat[] = [];
  const duration = media.durationSeconds;

  // Reels: 3-90 seconds (or unspecified duration)
  if (duration === null || duration === undefined || (duration >= 3 && duration <= 90)) {
    formats.push('reel');
  }

  // Video: all durations supported
  formats.push('video');

  // Story: <= 60 seconds (or unspecified duration)
  if (duration === null || duration === undefined || duration <= 60) {
    formats.push('story');
  }

  return formats;
}
