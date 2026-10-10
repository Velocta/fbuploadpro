# Implementation Plan: Purge Over-Built Media Library Bloat & Enforce Default Filename Captions

**Branch**: `feat/028-purge-media-library-bloat` | **Date**: 2026-10-10 | **Spec**: [specs/028-purge-media-library-bloat/spec.md](spec.md)

## Summary

Remove over-built features from the Media Library data substrate, domain contracts, and API routes:
1. Drop `caption_templates` table, `media_items.caption_template_id`, and `/api/tenant/[subdomain]/media/captions` endpoints; default `media_items.caption_text` on upload confirmation to the filename with its extension stripped (`deriveDefaultCaptionFromFilename`).
2. Drop `media_items.tags` and `idx_media_items_tags`, and remove `tags`/`tag` filtering from contracts and media endpoints.
3. Drop `media_folders.color` and remove `AllowedFolderColors` and `color` from folder contracts and endpoints.
4. Drop `user_storage_quotas` table, delete `/api/tenant/[subdomain]/media/quota`, and remove all storage quota checks and broken `user_storage_quotas` upserts across `upload-url`, `confirm`, `[mediaId]`, `storage.ts`, and `supabase-auth.ts`.

## Technical Context

- **Database**: Forward SQL migration `supabase/migrations/20261010182000_purge_media_library_bloat.sql`.
- **Contracts**: `@fbuploadpro/contracts` (`media.ts`, `folder.ts`, `storage.ts`, remove `caption.ts`).
- **Web Control Plane**: `apps/web/src/lib/storage.ts`, `apps/web/src/lib/supabase-auth.ts`, and `apps/web/src/app/api/tenant/[subdomain]/media/**`.
- **Testing**: Vitest suites across `@fbuploadpro/contracts`, `@fbuploadpro/database`, and `@fbuploadpro/web`.
