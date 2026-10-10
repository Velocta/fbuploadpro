-- Migration: 20261010190000_nested_media_folders.sql
-- Description: Support recursive nested subfolders in media_folders, sibling-scoped unique names, and cascading folder deletion

-- 1. Add parent_id column to media_folders
ALTER TABLE media_folders
    ADD COLUMN IF NOT EXISTS parent_id UUID NULL;

-- 2. Drop flat folder name unique constraint
ALTER TABLE media_folders
    DROP CONSTRAINT IF EXISTS uq_media_folders_user_name;

-- 3. Add self-parenting check constraint and composite multi-tenant parent foreign key
ALTER TABLE media_folders
    ADD CONSTRAINT chk_media_folders_no_self_parent
        CHECK (id <> parent_id),
    ADD CONSTRAINT fk_media_folders_user_parent
        FOREIGN KEY (user_id, parent_id)
        REFERENCES media_folders(user_id, id)
        ON DELETE CASCADE;

-- 4. Create sibling-scoped case-insensitive unique indexes and parent lookup index
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_folders_root_name
    ON media_folders (user_id, LOWER(name))
    WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_folders_child_name
    ON media_folders (user_id, parent_id, LOWER(name))
    WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_folders_user_parent
    ON media_folders (user_id, parent_id);

-- 5. Update media_items folder foreign key to ON DELETE CASCADE
ALTER TABLE media_items
    DROP CONSTRAINT IF EXISTS fk_media_items_user_folder,
    ADD CONSTRAINT fk_media_items_user_folder
        FOREIGN KEY (user_id, folder_id)
        REFERENCES media_folders(user_id, id)
        ON DELETE CASCADE;
