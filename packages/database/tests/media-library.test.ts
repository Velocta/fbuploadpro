import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Media Library DDL Migration & Schema Suite', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../migrations/0003_media_library.sql'
  );

  it('0003_media_library.sql exists and creates required tables', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);

    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS user_storage_quotas');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS media_folders');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS caption_templates');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS media_items');
  });

  it('enforces multi-tenant composite foreign keys and non-destructive deletion', () => {
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    // Composite foreign key ensuring folder belongs to user, with ON DELETE SET NULL
    expect(ddl).toContain(
      'CONSTRAINT fk_media_items_user_folder FOREIGN KEY (user_id, folder_id)'
    );
    expect(ddl).toContain(
      'REFERENCES media_folders(user_id, id) ON DELETE SET NULL'
    );

    // Composite foreign key ensuring caption belongs to user, with ON DELETE SET NULL
    expect(ddl).toContain(
      'CONSTRAINT fk_media_items_user_caption FOREIGN KEY (user_id, caption_template_id)'
    );
    expect(ddl).toContain(
      'REFERENCES caption_templates(user_id, id) ON DELETE SET NULL'
    );
  });

  it('enforces uniqueness per user workspace for folders and captions', () => {
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain(
      'CONSTRAINT uq_media_folders_user_name UNIQUE (user_id, name)'
    );
    expect(ddl).toContain(
      'CONSTRAINT uq_caption_templates_user_title UNIQUE (user_id, title)'
    );
    expect(ddl).toContain(
      'storage_key VARCHAR(500) NOT NULL UNIQUE'
    );
  });

  it('enforces non-negative storage check constraints', () => {
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('total_bytes BIGINT NOT NULL DEFAULT 5368709120 CHECK (total_bytes >= 0)');
    expect(ddl).toContain('used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0)');
    expect(ddl).toContain('file_size BIGINT NOT NULL CHECK (file_size > 0)');
  });

  it('configures GIN indexing for multi-tag querying', () => {
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain(
      'CREATE INDEX IF NOT EXISTS idx_media_items_tags ON media_items USING GIN (tags)'
    );
  });
});
