# Data Model: Automated Queue Slots Publishing Engine

**Branch**: `feat/005-publishing-engine-plan` | **Date**: 2026-10-07 | **Spec**: [specs/005-publishing-engine/spec.md](spec.md)

This document defines the relational database entities, constraints, foreign key cascades, lifecycle states, and SQL DDL migration for Spec 005.

---

## 1. Domain Entities & Database Schema

### 1.1 `page_queue_slots` (Recurring Publishing Windows)
Defines recurring daily publishing windows per Facebook Page with timezone awareness.

| Field | Type | Nullable | Constraints / Defaults | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique slot identifier |
| `user_id` | `UUID` | No | `REFERENCES users(id) ON DELETE CASCADE` | Tenant owner identifier |
| `fb_page_id` | `UUID` | No | | Connected Facebook Page reference |
| `slot_time` | `TIME` | No | | Daily recurring time (e.g. `09:30:00`) |
| `timezone` | `VARCHAR(50)` | No | `DEFAULT 'UTC'` | IANA timezone (e.g. `America/New_York`) |
| `is_active` | `BOOLEAN` | No | `DEFAULT true` | Slot active status toggle |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Record update timestamp |

**Indexes & Constraints**:
- `CONSTRAINT fk_page_queue_slots_page FOREIGN KEY (user_id, fb_page_id) REFERENCES facebook_pages(user_id, id) ON DELETE CASCADE`
- `CONSTRAINT uq_page_queue_slots_user_page_time UNIQUE (user_id, fb_page_id, slot_time)`
- `CONSTRAINT uq_page_queue_slots_user_id UNIQUE (user_id, id)`
- `CREATE INDEX idx_page_queue_slots_user_page ON page_queue_slots(user_id, fb_page_id);`

---

### 1.2 `queue_items` (Scheduled Post Instances)
Represents media assets enqueued for automated publication into target slots.

| Field | Type | Nullable | Constraints / Defaults | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique queue item identifier |
| `user_id` | `UUID` | No | `REFERENCES users(id) ON DELETE CASCADE` | Tenant owner identifier |
| `fb_page_id` | `UUID` | No | | Target Facebook Page reference |
| `slot_id` | `UUID` | Yes | `ON DELETE SET NULL` | Reference to recurring slot (if slot-driven) |
| `media_id` | `UUID` | No | `ON DELETE CASCADE` | Media Library asset to publish |
| `scheduled_time`| `TIMESTAMPTZ`| No | | Exact target publication time in UTC |
| `caption` | `TEXT` | No | `DEFAULT ''` | Publishing post caption / copy |
| `first_comment`| `TEXT` | Yes | `NULL` | Optional automated first comment text |
| `status` | `VARCHAR(20)` | No | `DEFAULT 'queued' CHECK (status IN ('queued', 'publishing', 'published', 'failed', 'skipped'))` | Current publication state |
| `retry_count` | `INT` | No | `DEFAULT 0 CHECK (retry_count >= 0)` | Number of execution retries |
| `max_retries` | `INT` | No | `DEFAULT 3 CHECK (max_retries >= 0)` | Maximum allowed retries |
| `fb_post_id` | `VARCHAR(100)`| Yes | `NULL` | External Facebook post identifier |
| `fb_comment_id`| `VARCHAR(100)`| Yes | `NULL` | External Facebook comment identifier |
| `published_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp post confirmed on Facebook |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Update timestamp |

**Indexes & Constraints**:
- `CONSTRAINT fk_queue_items_page FOREIGN KEY (user_id, fb_page_id) REFERENCES facebook_pages(user_id, id) ON DELETE CASCADE`
- `CONSTRAINT fk_queue_items_slot FOREIGN KEY (user_id, slot_id) REFERENCES page_queue_slots(user_id, id) ON DELETE SET NULL`
- `CONSTRAINT fk_queue_items_media FOREIGN KEY (user_id, media_id) REFERENCES media_items(user_id, id) ON DELETE CASCADE`
- `CONSTRAINT uq_queue_items_user_id UNIQUE (user_id, id)`
- `CREATE INDEX idx_queue_items_dispatch ON queue_items(status, scheduled_time ASC) WHERE status = 'queued';`
- `CREATE INDEX idx_queue_items_user_page ON queue_items(user_id, fb_page_id, scheduled_time ASC);`
- `CREATE INDEX idx_queue_items_media ON queue_items(user_id, media_id);`

---

### 1.3 `publish_logs` (Execution Audit & Diagnostics)
Records every dispatch attempt, external Facebook response codes, and token deductions.

| Field | Type | Nullable | Constraints / Defaults | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique log identifier |
| `user_id` | `UUID` | No | `REFERENCES users(id) ON DELETE CASCADE` | Tenant owner identifier |
| `queue_item_id` | `UUID` | No | | Reference to scheduled queue item |
| `fb_page_id` | `UUID` | No | | Target Facebook Page reference |
| `status` | `VARCHAR(20)` | No | `CHECK (status IN ('success', 'failure', 'retry'))` | Outcome of this attempt |
| `attempt_number`| `INT` | No | `DEFAULT 1 CHECK (attempt_number >= 1)` | Sequence number of attempt |
| `fb_response_code`| `INT` | Yes | `NULL` | HTTP status code from Graph API |
| `error_message` | `TEXT` | Yes | `NULL` | Error summary or message |
| `error_details` | `JSONB` | Yes | `NULL` | Full Graph API error response object |
| `tokens_deducted`| `INT` | No | `DEFAULT 0 CHECK (tokens_deducted >= 0)` | Tokens deducted (1 on success, 0 otherwise) |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Attempt execution timestamp |

**Indexes & Constraints**:
- `CONSTRAINT fk_publish_logs_page FOREIGN KEY (user_id, fb_page_id) REFERENCES facebook_pages(user_id, id) ON DELETE CASCADE`
- `CONSTRAINT fk_publish_logs_queue_item FOREIGN KEY (user_id, queue_item_id) REFERENCES queue_items(user_id, id) ON DELETE CASCADE`
- `CREATE INDEX idx_publish_logs_queue_item ON publish_logs(queue_item_id);`
- `CREATE INDEX idx_publish_logs_user_page ON publish_logs(user_id, fb_page_id, created_at DESC);`

---

## 2. Complete DDL Migration: `0004_publishing_engine.sql`

```sql
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
    tokens_deducted INT NOT NULL DEFAULT 0 CHECK (tokens_deducted >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_publish_logs_page FOREIGN KEY (user_id, fb_page_id)
        REFERENCES facebook_pages(user_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_publish_logs_queue_item FOREIGN KEY (user_id, queue_item_id)
        REFERENCES queue_items(user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_publish_logs_queue_item ON publish_logs(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_publish_logs_user_page ON publish_logs(user_id, fb_page_id, created_at DESC);
```
