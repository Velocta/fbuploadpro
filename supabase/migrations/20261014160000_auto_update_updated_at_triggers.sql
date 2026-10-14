-- Migration: 20261014160000_auto_update_updated_at_triggers.sql
-- Description: Implement set_updated_at() trigger function and attach BEFORE UPDATE triggers across all core tables (ISSUE-43)

-- 1. Create or replace shared trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach BEFORE UPDATE triggers across core tables having updated_at column

-- users
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- facebook_accounts
DROP TRIGGER IF EXISTS trg_facebook_accounts_updated_at ON public.facebook_accounts;
CREATE TRIGGER trg_facebook_accounts_updated_at
    BEFORE UPDATE ON public.facebook_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- facebook_pages
DROP TRIGGER IF EXISTS trg_facebook_pages_updated_at ON public.facebook_pages;
CREATE TRIGGER trg_facebook_pages_updated_at
    BEFORE UPDATE ON public.facebook_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- user_storage_quotas (guarded if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_storage_quotas') THEN
        DROP TRIGGER IF EXISTS trg_user_storage_quotas_updated_at ON public.user_storage_quotas;
        CREATE TRIGGER trg_user_storage_quotas_updated_at
            BEFORE UPDATE ON public.user_storage_quotas
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- media_folders
DROP TRIGGER IF EXISTS trg_media_folders_updated_at ON public.media_folders;
CREATE TRIGGER trg_media_folders_updated_at
    BEFORE UPDATE ON public.media_folders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- caption_templates (guarded if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'caption_templates') THEN
        DROP TRIGGER IF EXISTS trg_caption_templates_updated_at ON public.caption_templates;
        CREATE TRIGGER trg_caption_templates_updated_at
            BEFORE UPDATE ON public.caption_templates
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- media_items
DROP TRIGGER IF EXISTS trg_media_items_updated_at ON public.media_items;
CREATE TRIGGER trg_media_items_updated_at
    BEFORE UPDATE ON public.media_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- page_queue_slots
DROP TRIGGER IF EXISTS trg_page_queue_slots_updated_at ON public.page_queue_slots;
CREATE TRIGGER trg_page_queue_slots_updated_at
    BEFORE UPDATE ON public.page_queue_slots
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- queue_items
DROP TRIGGER IF EXISTS trg_queue_items_updated_at ON public.queue_items;
CREATE TRIGGER trg_queue_items_updated_at
    BEFORE UPDATE ON public.queue_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- page_insights_daily_snapshots
DROP TRIGGER IF EXISTS trg_page_insights_daily_snapshots_updated_at ON public.page_insights_daily_snapshots;
CREATE TRIGGER trg_page_insights_daily_snapshots_updated_at
    BEFORE UPDATE ON public.page_insights_daily_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- workspaces
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- workspace_byoc_credentials
DROP TRIGGER IF EXISTS trg_workspace_byoc_credentials_updated_at ON public.workspace_byoc_credentials;
CREATE TRIGGER trg_workspace_byoc_credentials_updated_at
    BEFORE UPDATE ON public.workspace_byoc_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
