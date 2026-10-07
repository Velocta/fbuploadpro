# Quickstart & Validation Guide: Dedicated User Media Library & Cloudflare R2 Uploads

This document provides runnable validation procedures and testing instructions to verify the implementation of Spec 004.

---

## 1. Prerequisites & Environment Setup

Ensure the following environment variables are configured in `.env.local` or testing environments:

```bash
# Cloudflare R2 Object Storage
R2_ACCOUNT_ID="mock_r2_account_id"
R2_ACCESS_KEY_ID="mock_r2_access_key_id"
R2_SECRET_ACCESS_KEY="mock_r2_secret_access_key"
R2_BUCKET_NAME="fbuploadpro-media"
R2_PUBLIC_URL="https://media.fbuploadpro.com"

# Baseline Storage Quota (Bytes - 5 GB default)
DEFAULT_STORAGE_QUOTA_BYTES="5368709120"

# Application & Auth (Spec 002)
SESSION_SIGNING_SECRET="dev_session_signing_secret_minimum_32_characters_long"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# PostgreSQL Database (Spec 001)
DATABASE_URL="postgres://postgres:postgres@localhost:5432/fbuploadpro_dev"
```

---

## 2. Test Execution Commands

Run targeted test suites across all packages:

### 2.1 Contracts & Validation Tests
```bash
pnpm --filter @fbuploadpro/contracts test
```
**Expected Outcome**: All unit tests pass, asserting:
- `UploadUrlRequestSchema` validates MIME whitelist (`video/mp4`, `image/jpeg`, etc.) and caps file size at 500 MB.
- `ConfirmUploadRequestSchema` validates UUIDs, MIME types, duration, and aspect ratio strings.
- `CreateFolderRequestSchema` validates folder names and badge color tokens.
- `CreateCaptionTemplateRequestSchema` validates character lengths and tags array.
- `StorageQuotaResponseSchema` validates byte calculations and utilization percentages.

### 2.2 Database Migration & Schema Isolation Tests
```bash
pnpm --filter @fbuploadpro/database test
```
**Expected Outcome**: Migration `0003_media_library.sql` executes cleanly; tests assert:
- `user_storage_quotas` enforces non-negative constraints (`used_bytes >= 0`, `total_bytes >= 0`).
- `media_folders` enforces unique `(user_id, name)` per tenant workspace.
- `media_items` composite foreign key `(user_id, folder_id)` enforces tenant isolation.
- Non-destructive folder deletion: deleting a folder sets `media_items.folder_id` to `NULL` (`ON DELETE SET NULL`) with 0% asset loss.
- `caption_templates` deletion sets `media_items.caption_template_id` to `NULL` without losing snapshotted `caption_text`.

### 2.3 Storage Provider, API Route Handlers & Quota Tests
```bash
pnpm --filter @fbuploadpro/web test
```
**Expected Outcome**: Next.js route handlers pass integration tests with `MockStorageProvider`:
- `POST /api/tenant/[subdomain]/media/upload-url` generates presigned URLs for media and thumbnail; returns 403 when file size exceeds remaining quota.
- `POST /api/tenant/[subdomain]/media/confirm` atomically inserts media item and increments `user_storage_quotas.used_bytes`.
- `GET /api/tenant/[subdomain]/media` filters items by folder, media type, and tags with pagination.
- `DELETE /api/tenant/[subdomain]/media/[mediaId]` purges object from storage provider, deletes DB record, and refunds exact `file_size` back to `used_bytes`.
- Folder CRUD and Caption Template CRUD handlers operate with strict tenant isolation.

---

## 3. Monorepo Quality Gate Validation

Verify the entire repository against Turborepo quality gates:

```bash
pnpm turbo run build lint typecheck test
```

**Quality Acceptance**:
- Zero TypeScript errors (`strict: true`).
- Zero ESLint warnings.
- 100% test pass rate across all packages (`@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/web`, `@fbuploadpro/worker`).
