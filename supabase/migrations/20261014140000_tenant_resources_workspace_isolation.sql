-- Migration: 20261014140000_tenant_resources_workspace_isolation.sql
-- Description: Add workspace_id foreign keys to facebook_accounts, facebook_pages, media_folders, and media_items, backfill from workspaces, enforce NOT NULL, update unique constraints, and establish compound RLS isolation.

-- ============================================================================
-- 1. ADD workspace_id AND BACKFILL EXISTING DATA
-- ============================================================================

-- 1.1 facebook_accounts
ALTER TABLE "public"."facebook_accounts"
  ADD COLUMN IF NOT EXISTS "workspace_id" UUID REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;

-- Backfill from workspaces matching owner_id
UPDATE "public"."facebook_accounts" fa
SET "workspace_id" = (
  SELECT w.id FROM "public"."workspaces" w
  WHERE w.owner_id = fa.user_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE fa."workspace_id" IS NULL;

-- 1.2 facebook_pages
ALTER TABLE "public"."facebook_pages"
  ADD COLUMN IF NOT EXISTS "workspace_id" UUID REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;

-- Backfill from linked facebook_accounts or workspaces
UPDATE "public"."facebook_pages" fp
SET "workspace_id" = COALESCE(
  (SELECT fa.workspace_id FROM "public"."facebook_accounts" fa WHERE fa.id = fp.facebook_account_id),
  (SELECT w.id FROM "public"."workspaces" w WHERE w.owner_id = fp.user_id ORDER BY w.created_at ASC LIMIT 1)
)
WHERE fp."workspace_id" IS NULL;

-- 1.3 media_folders
ALTER TABLE "public"."media_folders"
  ADD COLUMN IF NOT EXISTS "workspace_id" UUID REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;

-- Backfill from workspaces matching owner_id
UPDATE "public"."media_folders" mf
SET "workspace_id" = (
  SELECT w.id FROM "public"."workspaces" w
  WHERE w.owner_id = mf.user_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE mf."workspace_id" IS NULL;

-- 1.4 media_items
ALTER TABLE "public"."media_items"
  ADD COLUMN IF NOT EXISTS "workspace_id" UUID REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;

-- Backfill from linked media_folders or workspaces
UPDATE "public"."media_items" mi
SET "workspace_id" = COALESCE(
  (SELECT mf.workspace_id FROM "public"."media_folders" mf WHERE mf.id = mi.folder_id),
  (SELECT w.id FROM "public"."workspaces" w WHERE w.owner_id = mi.user_id ORDER BY w.created_at ASC LIMIT 1)
)
WHERE mi."workspace_id" IS NULL;

-- ============================================================================
-- 2. CREATE DEFAULT WORKSPACES FOR ANY ORPHANED ROWS BEFORE NOT NULL
-- ============================================================================

-- Ensure any user with records has at least one workspace before setting NOT NULL
INSERT INTO "public"."workspaces" (id, owner_id, name, subdomain, created_at, updated_at)
SELECT gen_random_uuid(), u.id, 'Default Workspace', SUBSTRING(REPLACE(u.email, '@', '-') FROM 1 FOR 40) || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6), now(), now()
FROM "public"."users" u
WHERE NOT EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.owner_id = u.id)
  AND (
    EXISTS (SELECT 1 FROM "public"."facebook_accounts" fa WHERE fa.user_id = u.id AND fa.workspace_id IS NULL) OR
    EXISTS (SELECT 1 FROM "public"."facebook_pages" fp WHERE fp.user_id = u.id AND fp.workspace_id IS NULL) OR
    EXISTS (SELECT 1 FROM "public"."media_folders" mf WHERE mf.user_id = u.id AND mf.workspace_id IS NULL) OR
    EXISTS (SELECT 1 FROM "public"."media_items" mi WHERE mi.user_id = u.id AND mi.workspace_id IS NULL)
  )
ON CONFLICT DO NOTHING;

-- Re-run backfill after default workspace insertion
UPDATE "public"."facebook_accounts" fa
SET "workspace_id" = (SELECT w.id FROM "public"."workspaces" w WHERE w.owner_id = fa.user_id ORDER BY w.created_at ASC LIMIT 1)
WHERE fa."workspace_id" IS NULL;

UPDATE "public"."facebook_pages" fp
SET "workspace_id" = COALESCE(
  (SELECT fa.workspace_id FROM "public"."facebook_accounts" fa WHERE fa.id = fp.facebook_account_id),
  (SELECT w.id FROM "public"."workspaces" w WHERE w.owner_id = fp.user_id ORDER BY w.created_at ASC LIMIT 1)
)
WHERE fp."workspace_id" IS NULL;

UPDATE "public"."media_folders" mf
SET "workspace_id" = (SELECT w.id FROM "public"."workspaces" w WHERE w.owner_id = mf.user_id ORDER BY w.created_at ASC LIMIT 1)
WHERE mf."workspace_id" IS NULL;

UPDATE "public"."media_items" mi
SET "workspace_id" = COALESCE(
  (SELECT mf.workspace_id FROM "public"."media_folders" mf WHERE mf.id = mi.folder_id),
  (SELECT w.id FROM "public"."workspaces" w WHERE w.owner_id = mi.user_id ORDER BY w.created_at ASC LIMIT 1)
)
WHERE mi."workspace_id" IS NULL;

-- ============================================================================
-- 3. ENFORCE NOT NULL CONSTRAINTS
-- ============================================================================

ALTER TABLE "public"."facebook_accounts" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "public"."facebook_pages" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "public"."media_folders" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "public"."media_items" ALTER COLUMN "workspace_id" SET NOT NULL;

-- ============================================================================
-- 4. CREATE INDEXES AND COMPOSITE CONSTRAINTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_facebook_accounts_workspace_id ON "public"."facebook_accounts"("workspace_id");
CREATE INDEX IF NOT EXISTS idx_facebook_pages_workspace_id ON "public"."facebook_pages"("workspace_id");
CREATE INDEX IF NOT EXISTS idx_media_folders_workspace_id ON "public"."media_folders"("workspace_id");
CREATE INDEX IF NOT EXISTS idx_media_items_workspace_id ON "public"."media_items"("workspace_id");

-- Unique compound constraints per workspace
ALTER TABLE "public"."facebook_accounts"
  DROP CONSTRAINT IF EXISTS uq_fb_accounts_workspace_account,
  ADD CONSTRAINT uq_fb_accounts_workspace_account UNIQUE ("workspace_id", "fb_account_id");

ALTER TABLE "public"."facebook_pages"
  DROP CONSTRAINT IF EXISTS uq_fb_pages_workspace_page,
  ADD CONSTRAINT uq_fb_pages_workspace_page UNIQUE ("workspace_id", "fb_page_id");

ALTER TABLE "public"."media_folders"
  DROP CONSTRAINT IF EXISTS uq_media_folders_workspace_name,
  ADD CONSTRAINT uq_media_folders_workspace_name UNIQUE ("workspace_id", "name");

-- ============================================================================
-- 5. UPDATE ROW LEVEL SECURITY (RLS) POLICIES FOR WORKSPACE ISOLATION
-- ============================================================================

DROP POLICY IF EXISTS "facebook_accounts_user_access" ON "public"."facebook_accounts";
CREATE POLICY "facebook_accounts_user_access" ON "public"."facebook_accounts"
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "facebook_pages_user_access" ON "public"."facebook_pages";
CREATE POLICY "facebook_pages_user_access" ON "public"."facebook_pages"
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "media_folders_user_access" ON "public"."media_folders";
CREATE POLICY "media_folders_user_access" ON "public"."media_folders"
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "media_items_user_access" ON "public"."media_items";
CREATE POLICY "media_items_user_access" ON "public"."media_items"
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM "public"."workspaces" w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );
