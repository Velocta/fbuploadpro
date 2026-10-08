-- Migration: 0004_publishing_engine.sql
-- Description: Page queue slots, queue items, and publish audit logs

-- 1. Ensure composite unique constraints on existing referenced tables
ALTER TABLE facebook_pages
    ADD CONSTRAINT uq_fb_pages_user_id UNIQUE (user_id, id);

ALTER TABLE media_items
    ADD CONSTRAINT uq_media_items_user_id UNIQUE (user_id, id);

-- 2. Create page_queue_slots table
CREATE TABLE IF NOT EXISTS page_queue_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fb_page_id UUID NOT NULL,
    slot_time TIME NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_page_queue_slots_page FOREIGN KEY (user_id, fb_page_id)
        REFERENCES facebook_pages(user_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_page_queue_slots_user_page_time UNIQUE (user_id, fb_page_id, slot_time),
    CONSTRAINT uq_page_queue_slots_user_id UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_page_queue_slots_user_page ON page_queue_slots(user_id, fb_page_id);

-- 3. Create queue_items table
CREATE TABLE IF NOT EXISTS queue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fb_page_id UUID NOT NULL,
    slot_id UUID NULL,
    media_id UUID NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    first_comment TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'publishing', 'published', 'failed', 'skipped')),
    retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INT NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
    fb_post_id VARCHAR(100) NULL,
    fb_comment_id VARCHAR(100) NULL,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_queue_items_page FOREIGN KEY (user_id, fb_page_id)
        REFERENCES facebook_pages(user_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_queue_items_slot FOREIGN KEY (user_id, slot_id)
        REFERENCES page_queue_slots(user_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_queue_items_media FOREIGN KEY (user_id, media_id)
        REFERENCES media_items(user_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_queue_items_user_id UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_queue_items_dispatch ON queue_items(status, scheduled_time ASC) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_queue_items_user_page ON queue_items(user_id, fb_page_id, scheduled_time ASC);
CREATE INDEX IF NOT EXISTS idx_queue_items_media ON queue_items(user_id, media_id);

-- 4. Create publish_logs table
CREATE TABLE IF NOT EXISTS publish_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    queue_item_id UUID NOT NULL,
    fb_page_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'retry')),
    attempt_number INT NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
    fb_response_code INT NULL,
    error_message TEXT NULL,
    error_details JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_publish_logs_page FOREIGN KEY (user_id, fb_page_id)
        REFERENCES facebook_pages(user_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_publish_logs_queue_item FOREIGN KEY (user_id, queue_item_id)
        REFERENCES queue_items(user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_publish_logs_queue_item ON publish_logs(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_publish_logs_user_page ON publish_logs(user_id, fb_page_id, created_at DESC);
