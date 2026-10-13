-- Migration: 20261013140000_pure_supabase_rls_and_rpc.sql
-- Description: Enable Row Level Security (RLS) on all public tables, configure compound tenant isolation policies, and establish atomic queue claiming RPC function.

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY (RLS) ACROSS ALL 11 PUBLIC TABLES
-- ============================================================================

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_byoc_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."facebook_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."facebook_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."media_folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."media_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."page_queue_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."queue_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."publish_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."page_insights_daily_snapshots" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. CREATE COMPOUND TENANT POLICIES (AUTHENTICATED ROLE)
-- ============================================================================

-- Users: Users can read and update their own record
DROP POLICY IF EXISTS "users_self_access" ON "public"."users";
CREATE POLICY "users_self_access" ON "public"."users"
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Workspaces: Owners can access and manage their own workspaces
DROP POLICY IF EXISTS "workspaces_owner_access" ON "public"."workspaces";
CREATE POLICY "workspaces_owner_access" ON "public"."workspaces"
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Workspace BYOC Credentials: Scoped strictly to the owning user
DROP POLICY IF EXISTS "workspace_byoc_user_access" ON "public"."workspace_byoc_credentials";
CREATE POLICY "workspace_byoc_user_access" ON "public"."workspace_byoc_credentials"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Facebook Accounts: Scoped to owning user
DROP POLICY IF EXISTS "facebook_accounts_user_access" ON "public"."facebook_accounts";
CREATE POLICY "facebook_accounts_user_access" ON "public"."facebook_accounts"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Facebook Pages: Scoped to owning user
DROP POLICY IF EXISTS "facebook_pages_user_access" ON "public"."facebook_pages";
CREATE POLICY "facebook_pages_user_access" ON "public"."facebook_pages"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Media Folders: Scoped to owning user
DROP POLICY IF EXISTS "media_folders_user_access" ON "public"."media_folders";
CREATE POLICY "media_folders_user_access" ON "public"."media_folders"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Media Items: Scoped to owning user
DROP POLICY IF EXISTS "media_items_user_access" ON "public"."media_items";
CREATE POLICY "media_items_user_access" ON "public"."media_items"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Page Queue Slots: Scoped to owning user
DROP POLICY IF EXISTS "page_queue_slots_user_access" ON "public"."page_queue_slots";
CREATE POLICY "page_queue_slots_user_access" ON "public"."page_queue_slots"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Queue Items: Scoped to owning user
DROP POLICY IF EXISTS "queue_items_user_access" ON "public"."queue_items";
CREATE POLICY "queue_items_user_access" ON "public"."queue_items"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Publish Logs: Scoped to owning user
DROP POLICY IF EXISTS "publish_logs_user_access" ON "public"."publish_logs";
CREATE POLICY "publish_logs_user_access" ON "public"."publish_logs"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Page Insights Daily Snapshots: Scoped to owning user
DROP POLICY IF EXISTS "page_insights_user_access" ON "public"."page_insights_daily_snapshots";
CREATE POLICY "page_insights_user_access" ON "public"."page_insights_daily_snapshots"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. ATOMIC QUEUE CLAIMING RPC FUNCTION (FOR UPDATE SKIP LOCKED)
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_due_queue_items(p_limit INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  fb_page_id UUID,
  media_id UUID,
  caption TEXT,
  first_comment TEXT,
  retry_count INT,
  max_retries INT,
  media_type VARCHAR,
  media_url TEXT,
  storage_key VARCHAR,
  external_page_id VARCHAR,
  encrypted_access_token TEXT,
  page_name VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH selected_items AS (
    SELECT qi.id
    FROM queue_items qi
    WHERE qi.status = 'queued'
      AND qi.scheduled_time <= now()
    ORDER BY qi.scheduled_time ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated_items AS (
    UPDATE queue_items qi
    SET status = 'publishing',
        updated_at = now()
    FROM selected_items
    WHERE qi.id = selected_items.id
    RETURNING qi.id, qi.user_id, qi.fb_page_id, qi.media_id, qi.caption, qi.first_comment, qi.retry_count, qi.max_retries
  )
  SELECT
    ui.id,
    ui.user_id,
    ui.fb_page_id,
    ui.media_id,
    ui.caption,
    ui.first_comment,
    ui.retry_count,
    ui.max_retries,
    m.media_type,
    m.url AS media_url,
    m.storage_key,
    fp.fb_page_id AS external_page_id,
    fp.encrypted_access_token,
    fp.page_name
  FROM updated_items ui
  JOIN media_items m ON m.id = ui.media_id AND m.user_id = ui.user_id
  JOIN facebook_pages fp ON fp.id = ui.fb_page_id AND fp.user_id = ui.user_id;
END;
$$;
