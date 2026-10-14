-- Migration: 20261014180000_global_user_media_library.sql
-- Description: Transition Media Library and Downloader storage from per-workspace to global per-user.
-- Make workspace_id nullable on media_folders and media_items, drop uq_media_folders_workspace_name,
-- recreate user-level sibling unique index for root and nested folders, and establish global user RLS.

-- ============================================================================
-- 1. MAKE workspace_id NULLABLE ON media_folders AND media_items
-- ============================================================================

ALTER TABLE "public"."media_folders" ALTER COLUMN "workspace_id" DROP NOT NULL;
ALTER TABLE "public"."media_items" ALTER COLUMN "workspace_id" DROP NOT NULL;

-- ============================================================================
-- 2. UPDATE UNIQUE CONSTRAINTS ON media_folders
-- ============================================================================

-- Drop workspace-scoped folder unique constraint
ALTER TABLE "public"."media_folders"
  DROP CONSTRAINT IF EXISTS uq_media_folders_workspace_name;

-- Ensure sibling folder uniqueness globally per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_folders_user_root_name
  ON "public"."media_folders" ("user_id", "name")
  WHERE "parent_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_folders_user_sibling_name
  ON "public"."media_folders" ("user_id", "parent_id", "name")
  WHERE "parent_id" IS NOT NULL;

-- ============================================================================
-- 3. RESET ROW LEVEL SECURITY (RLS) POLICIES FOR GLOBAL USER ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "media_folders_user_access" ON "public"."media_folders";
CREATE POLICY "media_folders_user_access" ON "public"."media_folders"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "media_items_user_access" ON "public"."media_items";
CREATE POLICY "media_items_user_access" ON "public"."media_items"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
