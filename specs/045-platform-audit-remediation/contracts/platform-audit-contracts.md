# Contracts & API Specifications: Platform Audit Remediation (Spec 045)

**Feature Branch**: `fix/045-platform-audit-remediation`  
**Date**: 2026-10-15  

This document defines the TypeScript schemas, Zod validators, and API contracts located in `@fbuploadpro/contracts`.

---

## 1. Domain Types & Zod Schemas

### 1.1 Post Formats & Queue Item Schemas
```typescript
import { z } from 'zod';

export const PostFormatSchema = z.enum(['text', 'image', 'reel', 'video', 'story']);
export type PostFormat = z.infer<typeof PostFormatSchema>;

export const EnqueueItemRequestSchema = z.object({
  pageId: z.string().uuid(),
  postFormat: PostFormatSchema.default('reel'),
  mediaId: z.string().uuid().nullable().optional(),
  caption: z.string().max(5000).default(''),
  firstComment: z.string().max(2000).nullable().optional(),
  linkUrl: z.string().url().nullable().optional(),
  scheduledTime: z.string().datetime().refine((val) => !Number.isNaN(new Date(val).getTime()), {
    message: 'Invalid scheduledTime timestamp'
  }),
}).refine((data) => {
  if (data.postFormat === 'text') {
    return !data.mediaId;
  }
  return !!data.mediaId;
}, {
  message: 'Media ID must be omitted for text posts and provided for media posts',
  path: ['mediaId'],
}).refine((data) => {
  if (data.postFormat === 'story') {
    return !data.firstComment;
  }
  return true;
}, {
  message: 'First comment is prohibited on Story format posts',
  path: ['firstComment'],
});
```

### 1.2 Format Eligibility Validator
```typescript
export interface FormatEligibilityInput {
  mediaType: 'video' | 'image';
  aspectRatio?: '9:16' | '16:9' | '1:1';
  durationSeconds?: number;
  fileSizeBytes: number;
  width?: number;
  height?: number;
}

export function validatePostFormatEligibility(
  input: FormatEligibilityInput,
  targetFormat: PostFormat
): { eligible: boolean; reason?: string } {
  if (targetFormat === 'text') {
    return { eligible: true };
  }

  if (targetFormat === 'reel') {
    if (input.mediaType !== 'video') return { eligible: false, reason: 'Reels require a video file' };
    if (input.aspectRatio !== '9:16') return { eligible: false, reason: 'Reels must be vertical (9:16)' };
    if (input.durationSeconds && (input.durationSeconds < 3 || input.durationSeconds > 90)) {
      return { eligible: false, reason: 'Reel duration must be between 3 and 90 seconds' };
    }
    if (input.width && input.height && (input.width < 540 || input.height < 960)) {
      return { eligible: false, reason: 'Minimum reel resolution is 540x960' };
    }
    return { eligible: true };
  }

  if (targetFormat === 'story') {
    if (input.fileSizeBytes > 10 * 1024 * 1024 && input.mediaType === 'image') {
      return { eligible: false, reason: 'Image stories cannot exceed 10 MB' };
    }
    if (input.mediaType === 'video' && input.durationSeconds && input.durationSeconds > 60) {
      return { eligible: false, reason: 'Video stories cannot exceed 60 seconds' };
    }
    return { eligible: true };
  }

  if (targetFormat === 'video') {
    if (input.mediaType !== 'video') return { eligible: false, reason: 'Feed Video requires a video asset' };
    if (input.fileSizeBytes > 524_288_000) return { eligible: false, reason: 'Video file exceeds 500 MB limit' };
    return { eligible: true };
  }

  if (targetFormat === 'image') {
    if (input.mediaType !== 'image') return { eligible: false, reason: 'Image post requires an image asset' };
    return { eligible: true };
  }

  return { eligible: false, reason: 'Unknown post format' };
}
```

### 1.3 Keyset Pagination Schema
```typescript
export const MediaListQuerySchema = z.object({
  folderId: z.string().uuid().nullable().optional(),
  cursor: z.string().regex(/^.+_.+$/).optional(), // createdAt_id
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
});
```

### 1.4 Folder Duplicate Check Schema
```typescript
export const CheckDuplicatesRequestSchema = z.object({
  folderId: z.string().uuid().nullable().optional(),
  entries: z.array(z.object({
    name: z.string(),
    fileSize: z.number().int().positive(),
  })).max(500),
});

export const CheckDuplicatesResponseSchema = z.object({
  duplicates: z.array(z.object({
    name: z.string(),
    fileSize: z.number(),
    existingId: z.string().uuid(),
  })),
});
```

### 1.5 Canonical Graph API Error Classifier
```typescript
export interface GraphApiEvaluation {
  isTransient: boolean;
  isRateLimit: boolean;
  pageStatus?: 'rate_limited' | 'invalid_token' | 'page_checkpoint';
  accountStatus?: 'expired';
  reason: string;
}

export function evaluateGraphApiError(code: number, subcode?: number): GraphApiEvaluation {
  // OAuth Token Revocation / Expiration
  if (code === 190 || code === 102 || code === 10 || (code >= 200 && code <= 299)) {
    return {
      isTransient: false,
      isRateLimit: false,
      pageStatus: 'invalid_token',
      accountStatus: 'expired',
      reason: 'Facebook OAuth token expired or revoked',
    };
  }

  // Page Checkpoint / Mobile verification required
  if (code === 368 && subcode === 4854002) {
    return {
      isTransient: false,
      isRateLimit: false,
      pageStatus: 'page_checkpoint',
      reason: 'Facebook security checkpoint requires mobile verification',
    };
  }

  // Duplicate post (non-transient)
  if (code === 506 || (code === 368 && subcode === 1404082)) {
    return {
      isTransient: false,
      isRateLimit: false,
      reason: 'Duplicate post detected by Facebook',
    };
  }

  // Bad Link URL (non-transient)
  if (code === 1609005) {
    return {
      isTransient: false,
      isRateLimit: false,
      reason: 'Facebook rejected link URL',
    };
  }

  // Rate Limits (BUC or App)
  if ([4, 17, 32, 341, 613].includes(code) || (code >= 80000 && code <= 80014)) {
    return {
      isTransient: true,
      isRateLimit: true,
      pageStatus: 'rate_limited',
      reason: 'Facebook Graph API rate limit reached',
    };
  }

  // Default server error
  return {
    isTransient: code >= 500,
    isRateLimit: false,
    reason: `Graph API error code ${code}`,
  };
}
```
