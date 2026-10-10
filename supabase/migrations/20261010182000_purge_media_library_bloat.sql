-- Migration: 20261010182000_purge_media_library_bloat.sql
-- Description: Purge over-built Media Library columns and tables (caption_templates, tags, media_folders.color, user_storage_quotas)

-- 1. Drop caption_template_id foreign key and column, plus tags index and column from media_items
ALTER TABLE media_items
    DROP CONSTRAINT IF EXISTS fk_media_items_user_caption;

DROP INDEX IF EXISTS idx_media_items_tags;

ALTER TABLE media_items
    DROP COLUMN IF EXISTS caption_template_id,
    DROP COLUMN IF EXISTS tags;

-- 2. Drop color column from media_folders
ALTER TABLE media_folders
    DROP COLUMN IF EXISTS color;

-- 3. Drop caption_templates and user_storage_quotas tables
DROP TABLE IF EXISTS caption_templates CASCADE;
DROP TABLE IF EXISTS user_storage_quotas CASCADE;
