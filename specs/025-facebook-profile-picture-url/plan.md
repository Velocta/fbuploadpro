# Implementation Plan: Spec 025 — Facebook Account & Page Profile Metadata Ingestion & Persistence (`profile_picture_url`, `gender`, `account_link`)

**Branch**: `feat/025-facebook-profile-picture-url` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

---

## 1. Summary

Add nullable `profile_picture_url TEXT`, `gender VARCHAR(50)`, and `account_link TEXT` columns to `public.facebook_accounts` and nullable `profile_picture_url TEXT` to `public.facebook_pages`, extend `@fbuploadpro/contracts` OAuth and Facebook domain/view Zod schemas with `profilePictureUrl`, `gender`, and `accountLink`, and update the Facebook Graph API v26.0 integration routes (`/api/auth/facebook/callback`, `/api/tenant/[subdomain]/accounts`, `/api/tenant/[subdomain]/accounts/[accountId]/pages/discover`, `/api/tenant/[subdomain]/pages/import`, and `/api/tenant/[subdomain]/pages`) to automatically fetch `fields=id,name,gender,link,picture{url}`, persist metadata, and expose sanitized fields on view responses.

---

## 2. Data Model & Contract Changes

### 2.1 Database Migration (`supabase/migrations/20261010073500_facebook_profile_picture_url.sql`)
```sql
ALTER TABLE facebook_accounts
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
    ADD COLUMN IF NOT EXISTS account_link TEXT;

ALTER TABLE facebook_pages
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
```

### 2.2 Domain Contracts (`packages/contracts/src/domain/`)
1. **`oauth.ts` (`FacebookUserProfileResponseSchema`)**:
   - Add optional `gender: z.string().max(50).nullable().optional()`, `link: z.string().url().nullable().optional()`, and `picture: { data: { url?: string } }`.
2. **`facebook.ts`**:
   - Add `profilePictureUrl: z.string().url().nullable().optional().default(null)`, `gender: z.string().max(50).nullable().optional().default(null)`, and `accountLink: z.string().url().nullable().optional().default(null)` to `FacebookAccountSchema` and `FacebookAccountViewSchema`.
   - Add `profilePictureUrl: z.string().url().nullable().optional().default(null)` to `FacebookPageSchema`, `FacebookPageViewSchema`, and `DiscoveredPageSchema`.

### 2.3 API Routes (`apps/web/src/app/api/`)
1. **`/api/auth/facebook/callback/route.ts`**:
   - Request `fields=id,name,gender,link,picture{url}` on `/v26.0/me`.
   - Extract `profilePictureUrl`, `gender`, and `accountLink`.
   - Upsert `profile_picture_url`, `gender`, and `account_link` into `facebook_accounts`.
2. **`/api/tenant/[subdomain]/accounts/route.ts`**:
   - Select `a.profile_picture_url, a.gender, a.account_link` and include in `GROUP BY`.
   - Map `profilePictureUrl`, `gender`, and `accountLink` on each returned account view object.
