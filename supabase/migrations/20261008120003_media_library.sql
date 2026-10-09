-- Migration: 0003_media_library.sql
-- Description: Dedicated user media library, custom folders, caption templates, and storage quotas

CREATE TABLE IF NOT EXISTS user_storage_quotas (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_bytes BIGINT NOT NULL DEFAULT 5368709120 CHECK (total_bytes >= 0),
    used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT 'slate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_media_folders_user_name UNIQUE (user_id, name),
    CONSTRAINT uq_media_folders_user_id UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_media_folders_user_id ON media_folders(user_id);

CREATE TABLE IF NOT EXISTS caption_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_caption_templates_user_title UNIQUE (user_id, title),
    CONSTRAINT uq_caption_templates_user_id UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_caption_templates_user_id ON caption_templates(user_id);

CREATE TABLE IF NOT EXISTS media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID NULL,
    name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    mime_type VARCHAR(100) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('video', 'image')),
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    thumbnail_key VARCHAR(500) NULL,
    thumbnail_url TEXT NULL,
    duration_seconds NUMERIC(10, 2) NULL,
    aspect_ratio VARCHAR(20) NOT NULL DEFAULT 'unknown',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    caption_template_id UUID NULL,
    caption_text TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_media_items_user_folder FOREIGN KEY (user_id, folder_id)
        REFERENCES media_folders(user_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_media_items_user_caption FOREIGN KEY (user_id, caption_template_id)
        REFERENCES caption_templates(user_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_media_items_user_id ON media_items(user_id);
CREATE INDEX IF NOT EXISTS idx_media_items_user_folder ON media_items(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_media_items_user_created ON media_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_items_user_type ON media_items(user_id, media_type);
CREATE INDEX IF NOT EXISTS idx_media_items_tags ON media_items USING GIN (tags);

-- Initialize storage quotas for existing users
INSERT INTO user_storage_quotas (user_id, total_bytes, used_bytes)
SELECT id, 5368709120, 0
FROM users
ON CONFLICT (user_id) DO NOTHING;
