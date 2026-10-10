import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Media Library DDL Migration & Schema Suite', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../migrations/0003_media_library.sql'
  );
  const purgeMigrationPath = path.resolve(
    __dirname,
    '../../../supabase/migrations/20261010182000_purge_media_library_bloat.sql'
  );

  it('0003_media_library.sql exists and creates baseline media tables', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);

    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS media_folders');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS media_items');
  });

  it('enforces multi-tenant composite foreign keys for media_folders', () => {
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    // Composite foreign key ensuring folder belongs to user, with ON DELETE SET NULL
    expect(ddl).toContain(
      'CONSTRAINT fk_media_items_user_folder FOREIGN KEY (user_id, folder_id)'
    );
    expect(ddl).toContain(
      'REFERENCES media_folders(user_id, id) ON DELETE SET NULL'
    );
  });

  it('20261010182000_purge_media_library_bloat.sql drops caption_templates, user_storage_quotas, tags, and folder color', () => {
    expect(fs.existsSync(purgeMigrationPath)).toBe(true);

    const purgeDdl = fs.readFileSync(purgeMigrationPath, 'utf8');

    expect(purgeDdl).toContain('DROP CONSTRAINT IF EXISTS fk_media_items_user_caption');
    expect(purgeDdl).toContain('DROP COLUMN IF EXISTS caption_template_id');
    expect(purgeDdl).toContain('DROP INDEX IF EXISTS idx_media_items_tags');
    expect(purgeDdl).toContain('DROP COLUMN IF EXISTS tags');
    expect(purgeDdl).toContain('ALTER TABLE media_folders');
    expect(purgeDdl).toContain('DROP COLUMN IF EXISTS color');
    expect(purgeDdl).toContain('DROP TABLE IF EXISTS caption_templates CASCADE');
    expect(purgeDdl).toContain('DROP TABLE IF EXISTS user_storage_quotas CASCADE');
  });
});
