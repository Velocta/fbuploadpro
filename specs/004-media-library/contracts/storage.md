# Contract: Cloudflare R2 Storage & Quota Accounting

This document defines the storage service abstraction interface, Cloudflare R2 presigned URL parameters, and storage quota inspection API.

---

## 1. Storage Quota Inspection

### Endpoint
`GET /api/tenant/[subdomain]/media/quota`

### Response Schema (`StorageQuotaResponseSchema`)
```typescript
import { z } from 'zod';

export const StorageQuotaResponseSchema = z.object({
  userId: z.string().uuid(),
  totalBytes: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  remainingBytes: z.number().int().nonnegative(),
  utilizationPercentage: z.number().min(0).max(100),
  totalItems: z.number().int().nonnegative(),
  videoItems: z.number().int().nonnegative(),
  imageItems: z.number().int().nonnegative(),
});

export type StorageQuotaResponse = z.infer<typeof StorageQuotaResponseSchema>;
```

---

## 2. Storage Service Abstraction (`IStorageService`)

Defined in `@fbuploadpro/contracts`:

```typescript
export interface PresignedUploadParams {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export interface IStorageService {
  /**
   * Generates an S3/R2 presigned PUT URL for direct browser uploads.
   */
  getPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>;

  /**
   * Permanently deletes an object from R2 object storage.
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Computes the public or CDN URL for a stored object key.
   */
  getPublicUrl(key: string): string;
}
```

---

## 3. Storage Key Hierarchy & Isolation

To enforce multi-tenant cryptographic partitioning across Cloudflare R2 buckets, all keys MUST conform to:

```text
users/{userId}/media/{mediaId}/{sanitizedFileName}
users/{userId}/thumbnails/{mediaId}.webp
```

1. **`userId` Scope**: Guarantees that even if two users upload files with identical names (e.g. `video.mp4`), they reside in strictly separate prefixes.
2. **`mediaId` Scope**: Guarantees that multiple uploads by the same user never overwrite each other.
3. **No Direct Delete Authorization**: Client browsers NEVER possess S3 delete credentials; deletions must always route through the authenticated control plane route `DELETE /api/tenant/[subdomain]/media/[mediaId]`.
