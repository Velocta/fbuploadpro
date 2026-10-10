# Implementation Plan: Spec 025 — Facebook Account & Page Profile Picture URL Ingestion & Persistence

**Branch**: `feat/025-facebook-profile-picture-url` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

---

## 1. Summary

Add nullable `profile_picture_url TEXT` columns to both `public.facebook_accounts` and `public.facebook_pages`, extend `@fbuploadpro/contracts` OAuth and Facebook domain/view Zod schemas with `profilePictureUrl`, and update the Facebook Graph API v26.0 integration routes (`/api/auth/facebook/callback`, `/api/tenant/[subdomain]/accounts`, `/api/tenant/[subdomain]/accounts/[accountId]/pages/discover`, `/api/tenant/[subdomain]/pages/import`, and `/api/tenant/[subdomain]/pages`) to automatically fetch `picture{url}`, persist `profile_picture_url`, and expose `profilePictureUrl` on sanitized view responses.

---

## 2. Technical Context

- **Language / Runtime**: TypeScript 5.x (Strict mode), Node.js 22+, Next.js 16 App Router
- **Contracts**: `@fbuploadpro/contracts` (Zod runtime validation schemas)
- **Database**: Supabase PostgreSQL (`supabase/migrations/20261010073500_facebook_profile_picture_url.sql`)
- **External API**: Facebook Graph API v26.0 (`/me?fields=id,name,picture{url}` and `/me/accounts?fields=id,name,category,tasks,access_token,followers_count,picture{url}`)
- **Testing**: Vitest unit and integration test suites across `packages/database`, `packages/contracts`, and `apps/web`

---

## 3. Constitution Check

- **Principle I (SDD & TDD)**: Spec 025 artifacts (`spec.md`, `plan.md`, `tasks.md`, `checklists/requirements.md`) authored before code; tests written/updated alongside implementation.
- **Principle III (Multi-Tenant Isolation)**: All `facebook_accounts` and `facebook_pages` queries preserve compound `user_id` isolation.
- **Principle IV (Zero-Trust Boundary Validation & Sanitization)**: `FacebookAccountViewSchema` and `FacebookPageViewSchema` expose `profilePictureUrl` while strictly stripping `encrypted_access_token`.
- **Principle V (Atomic PRs & Linear Git Hygiene)**: Delivered on `feat/025-facebook-profile-picture-url` with compact diff (<150–200 LoC) and combined docs update.
- **Technology Constraint 3 (Supabase Migrations)**: Forward SQL migration written to `supabase/migrations/20261010073500_facebook_profile_picture_url.sql` (never executed via Supabase MCP).

---

## 4. Data Model & Contract Changes

### 4.1 Database Migration (`supabase/migrations/20261010073500_facebook_profile_picture_url.sql`)
```sql
ALTER TABLE facebook_accounts
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

ALTER TABLE facebook_pages
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
```

### 4.2 Domain Contracts (`packages/contracts/src/domain/`)
1. **`oauth.ts` (`FacebookUserProfileResponseSchema`)**:
   - Add optional `picture`:
     ```ts
     picture: z
       .object({
         data: z.object({
           url: z.string().url().optional(),
         }).optional(),
       })
       .optional(),
     ```
2. **`facebook.ts`**:
   - Add `profilePictureUrl: z.string().url().nullable().optional().default(null)` (or `.nullable().optional()`) to:
     - `FacebookAccountSchema`
     - `FacebookAccountViewSchema`
     - `FacebookPageSchema`
     - `FacebookPageViewSchema`
     - `DiscoveredPageSchema`

### 4.3 API Routes (`apps/web/src/app/api/`)
1. **`/api/auth/facebook/callback/route.ts`**:
   - Request `fields=id,name,picture{url}` on `/v26.0/me`.
   - Extract `const profilePictureUrl = meProfile.picture?.data?.url ?? null;`.
   - Include `profile_picture_url` in `INSERT INTO facebook_accounts ... ON CONFLICT (user_id, fb_account_id) DO UPDATE SET ..., profile_picture_url = EXCLUDED.profile_picture_url`.
2. **`/api/tenant/[subdomain]/accounts/route.ts`**:
   - Select `a.profile_picture_url` and include in `GROUP BY`.
   - Map `profilePictureUrl: row.profile_picture_url ?? row.profilePictureUrl ?? null`.
3. **`/api/tenant/[subdomain]/accounts/[accountId]/pages/discover/route.ts`**:
   - Request `fields=id,name,category,tasks,access_token,followers_count,picture{url}` on `/v26.0/me/accounts`.
   - Map `profilePictureUrl: item.picture?.data?.url ?? null` on each discovered page.
4. **`/api/tenant/[subdomain]/pages/import/route.ts`**:
   - Request `fields=id,name,category,tasks,access_token,followers_count,picture{url}` on `/v26.0/me/accounts`.
   - Extract `const profilePictureUrl = pageItem.picture?.data?.url ?? null;`.
   - Include `profile_picture_url` in `INSERT INTO facebook_pages ... ON CONFLICT (user_id, fb_page_id) DO UPDATE SET ..., profile_picture_url = EXCLUDED.profile_picture_url`.
5. **`/api/tenant/[subdomain]/pages/route.ts`**:
   - Select `p.profile_picture_url`.
   - Map `profilePictureUrl: row.profile_picture_url ?? row.profilePictureUrl ?? null`.
