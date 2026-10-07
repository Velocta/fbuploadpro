import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabaseClient } from '../src/client.js';
import type { Pool } from 'pg';

describe('Publishing Engine DDL Migration & Schema Suite', () => {
  const migrationPath = path.resolve(__dirname, '../migrations/0004_publishing_engine.sql');

  it('0004_publishing_engine.sql exists and alters referenced tables with composite uniqueness', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('ALTER TABLE facebook_pages');
    expect(ddl).toContain('ADD CONSTRAINT uq_fb_pages_user_id UNIQUE (user_id, id);');
    expect(ddl).toContain('ALTER TABLE media_items');
    expect(ddl).toContain('ADD CONSTRAINT uq_media_items_user_id UNIQUE (user_id, id);');
  });

  it('creates page_queue_slots with multi-tenant foreign keys, composite uniqueness, and indexes', () => {
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS page_queue_slots');
    expect(ddl).toContain('slot_time TIME NOT NULL');
    expect(ddl).toContain("timezone VARCHAR(50) NOT NULL DEFAULT 'UTC'");
    expect(ddl).toContain('is_active BOOLEAN NOT NULL DEFAULT true');
    expect(ddl).toContain('CONSTRAINT fk_page_queue_slots_page FOREIGN KEY (user_id, fb_page_id)');
    expect(ddl).toContain('REFERENCES facebook_pages(user_id, id) ON DELETE CASCADE');
    expect(ddl).toContain('CONSTRAINT uq_page_queue_slots_user_page_time UNIQUE (user_id, fb_page_id, slot_time)');
    expect(ddl).toContain('CONSTRAINT uq_page_queue_slots_user_id UNIQUE (user_id, id)');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_page_queue_slots_user_page ON page_queue_slots(user_id, fb_page_id);');
  });

  it('creates queue_items with compound cascades, status checks, and partial dispatch index', () => {
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS queue_items');
    expect(ddl).toContain('CONSTRAINT fk_queue_items_page FOREIGN KEY (user_id, fb_page_id)');
    expect(ddl).toContain('CONSTRAINT fk_queue_items_slot FOREIGN KEY (user_id, slot_id)');
    expect(ddl).toContain('REFERENCES page_queue_slots(user_id, id) ON DELETE SET NULL');
    expect(ddl).toContain('CONSTRAINT fk_queue_items_media FOREIGN KEY (user_id, media_id)');
    expect(ddl).toContain('REFERENCES media_items(user_id, id) ON DELETE CASCADE');
    expect(ddl).toContain('CONSTRAINT uq_queue_items_user_id UNIQUE (user_id, id)');
    expect(ddl).toContain("CHECK (status IN ('queued', 'publishing', 'published', 'failed', 'skipped'))");
    expect(ddl).toContain("CREATE INDEX IF NOT EXISTS idx_queue_items_dispatch ON queue_items(status, scheduled_time ASC) WHERE status = 'queued';");
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_queue_items_user_page ON queue_items(user_id, fb_page_id, scheduled_time ASC);');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_queue_items_media ON queue_items(user_id, media_id);');
  });

  it('creates publish_logs with audit diagnostics, cascades, and indexes', () => {
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS publish_logs');
    expect(ddl).toContain('CONSTRAINT fk_publish_logs_page FOREIGN KEY (user_id, fb_page_id)');
    expect(ddl).toContain('CONSTRAINT fk_publish_logs_queue_item FOREIGN KEY (user_id, queue_item_id)');
    expect(ddl).toContain('REFERENCES queue_items(user_id, id) ON DELETE CASCADE');
    expect(ddl).toContain("CHECK (status IN ('success', 'failure', 'retry'))");
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_publish_logs_queue_item ON publish_logs(queue_item_id);');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_publish_logs_user_page ON publish_logs(user_id, fb_page_id, created_at DESC);');
  });

  it('executes FOR UPDATE SKIP LOCKED query pattern safely through database client', async () => {
    const mockRows = [{ id: '11111111-1111-1111-1111-111111111111', user_id: '22222222-2222-2222-2222-222222222222' }];
    const mockPool = { query: vi.fn().mockResolvedValue({ rows: mockRows }) } as unknown as Pool;
    const client = createDatabaseClient(mockPool);

    const claimQuery = `
      SELECT id, user_id, fb_page_id, media_id, caption, first_comment, retry_count, max_retries
      FROM queue_items
      WHERE status = 'queued' AND scheduled_time <= $1
      ORDER BY scheduled_time ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED;
    `;
    const now = new Date();
    const claimed = await client.query(claimQuery, [now, 10]);

    expect(claimed).toEqual(mockRows);
    expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE SKIP LOCKED'), [now, 10]);
  });
});
