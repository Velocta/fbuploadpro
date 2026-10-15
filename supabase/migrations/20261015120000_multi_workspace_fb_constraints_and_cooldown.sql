-- Migration: 20261015120000_multi_workspace_fb_constraints_and_cooldown.sql
-- Description: Drop legacy (user_id, fb_account_id) and (user_id, fb_page_id) constraints
-- to enable multi-workspace account/page connections, reinforce workspace-scoped unique constraints,
-- and add rate_limited_at column to facebook_pages for resilient cooldown evaluation.

-- ============================================================================
-- 1. DROP LEGACY USER-SCOPED UNIQUE CONSTRAINTS
-- ============================================================================

-- Drop legacy unique constraint on facebook_accounts(user_id, fb_account_id)
ALTER TABLE "public"."facebook_accounts"
  DROP CONSTRAINT IF EXISTS uq_fb_accounts_user_account;
DROP INDEX IF EXISTS "public"."uq_fb_accounts_user_account";

-- Drop legacy unique constraint on facebook_pages(user_id, fb_page_id)
ALTER TABLE "public"."facebook_pages"
  DROP CONSTRAINT IF EXISTS uq_fb_pages_user_page;
DROP INDEX IF EXISTS "public"."uq_fb_pages_user_page";

-- ============================================================================
-- 2. ENSURE WORKSPACE-SCOPED COMPOUND UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE "public"."facebook_accounts"
  DROP CONSTRAINT IF EXISTS uq_fb_accounts_workspace_account,
  ADD CONSTRAINT uq_fb_accounts_workspace_account UNIQUE ("workspace_id", "fb_account_id");

ALTER TABLE "public"."facebook_pages"
  DROP CONSTRAINT IF EXISTS uq_fb_pages_workspace_page,
  ADD CONSTRAINT uq_fb_pages_workspace_page UNIQUE ("workspace_id", "fb_page_id");

-- ============================================================================
-- 3. DEDICATED RATE LIMIT TIMESTAMP FOR RESILIENT COOLDOWN EVALUATION
-- ============================================================================

ALTER TABLE "public"."facebook_pages"
  ADD COLUMN IF NOT EXISTS "rate_limited_at" TIMESTAMPTZ;

-- Backfill rate_limited_at for any currently rate-limited pages
UPDATE "public"."facebook_pages"
SET "rate_limited_at" = "updated_at"
WHERE "status" = 'fb_rate_limited' AND "rate_limited_at" IS NULL;

CREATE INDEX IF NOT EXISTS idx_facebook_pages_rate_limited_at
  ON "public"."facebook_pages" ("rate_limited_at")
  WHERE "rate_limited_at" IS NOT NULL;
