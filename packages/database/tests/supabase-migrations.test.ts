import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Supabase Migrations Convention Suite', () => {
  const supabaseMigrationsDir = path.resolve(__dirname, '../../../supabase/migrations');

  it('verifies supabase/migrations directory exists', () => {
    expect(fs.existsSync(supabaseMigrationsDir)).toBe(true);
    expect(fs.statSync(supabaseMigrationsDir).isDirectory()).toBe(true);
  });

  it('all files in supabase/migrations strictly follow YYYYMMDDHHmmss_name.sql naming convention', () => {
    const files = fs.readdirSync(supabaseMigrationsDir).filter(f => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThanOrEqual(6);

    const supabaseMigrationPattern = /^\d{14}_[a-z0-9_]+\.sql$/;

    for (const file of files) {
      expect(file).toMatch(supabaseMigrationPattern);
      const filePath = path.join(supabaseMigrationsDir, file);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(0);
    }
  });

  it('contains all required platform schema migrations in chronological timestamp sequence', () => {
    const files = fs.readdirSync(supabaseMigrationsDir).filter(f => f.endsWith('.sql')).sort();

    const expectedSlugs = [
      'initial_schema',
      'facebook_tokens',
      'media_library',
      'publishing_engine',
      'page_insights',
      'users_phone_number',
      'auth_hardening_canonical_email_e164',
      'facebook_profile_picture_url',
      'purge_media_library_bloat',
      'nested_media_folders',
      'facebook_pages_followers_tracking',
    ];

    for (const slug of expectedSlugs) {
      const match = files.find(f => f.includes(`_${slug}.sql`));
      expect(match).toBeDefined();
    }

    // Verify chronological timestamp ordering
    const timestamps = files.map(f => f.slice(0, 14));
    const sortedTimestamps = [...timestamps].sort();
    expect(timestamps).toEqual(sortedTimestamps);
  });

  it('validates auth hardening migration has trigger, unique index, and check constraints', () => {
    const files = fs.readdirSync(supabaseMigrationsDir);
    const hardeningMigration = files.find(f => f.includes('auth_hardening_canonical_email_e164.sql'));
    expect(hardeningMigration).toBeDefined();

    const content = fs.readFileSync(path.join(supabaseMigrationsDir, hardeningMigration!), 'utf8');
    expect(content).toContain('normalized_email');
    expect(content).toContain('idx_users_normalized_email');
    expect(content).toContain('trg_canonicalize_user_email');
    expect(content).toContain('check_users_gmail_only');
    expect(content).toContain('check_users_phone_e164');
  });

  it('validates facebook_profile_picture_url migration adds profile_picture_url, gender, account_link columns and status ENUM types', () => {
    const files = fs.readdirSync(supabaseMigrationsDir);
    const pictureMigration = files.find(f => f.includes('facebook_profile_picture_url.sql'));
    expect(pictureMigration).toBeDefined();

    const content = fs.readFileSync(path.join(supabaseMigrationsDir, pictureMigration!), 'utf8');
    expect(content).toContain('ALTER TABLE facebook_accounts');
    expect(content).toContain('ALTER TABLE facebook_pages');
    expect(content).toContain('ADD COLUMN IF NOT EXISTS profile_picture_url TEXT');
    expect(content).toContain('ADD COLUMN IF NOT EXISTS gender VARCHAR(50)');
    expect(content).toContain('ADD COLUMN IF NOT EXISTS account_link TEXT');
    expect(content).toContain("CREATE TYPE user_status AS ENUM ('active', 'suspended')");
    expect(content).toContain("CREATE TYPE facebook_account_status AS ENUM ('active', 'disconnected', 'expired')");
    expect(content).toContain('CREATE TYPE facebook_page_status AS ENUM');
    expect(content).toContain('ALTER COLUMN status TYPE user_status');
    expect(content).toContain('ALTER COLUMN status TYPE facebook_account_status');
    expect(content).toContain('ALTER COLUMN status TYPE facebook_page_status');
  });

  it('validates facebook_pages_followers_tracking migration renames followers_count to current_followers and adds starting_followers', () => {
    const files = fs.readdirSync(supabaseMigrationsDir);
    const followersMigration = files.find(f => f.includes('facebook_pages_followers_tracking.sql'));
    expect(followersMigration).toBeDefined();

    const content = fs.readFileSync(path.join(supabaseMigrationsDir, followersMigration!), 'utf8');
    expect(content).toContain('RENAME COLUMN followers_count TO current_followers');
    expect(content).toContain('ADD COLUMN IF NOT EXISTS starting_followers INT NOT NULL DEFAULT 0 CHECK (starting_followers >= 0)');
    expect(content).toContain('SET starting_followers = current_followers');
  });

  it('validates workspace_byoc_credentials and removal of users.subdomain migrations', () => {
    const files = fs.readdirSync(supabaseMigrationsDir);
    const byocMigration = files.find(f => f.includes('workspace_byoc_credentials.sql'));
    expect(byocMigration).toBeDefined();

    const byocContent = fs.readFileSync(path.join(supabaseMigrationsDir, byocMigration!), 'utf8');
    expect(byocContent).toContain('CREATE TABLE IF NOT EXISTS workspaces');
    expect(byocContent).toContain('CREATE TABLE IF NOT EXISTS workspace_byoc_credentials');

    const removeSubdomainMigration = files.find(f => f.includes('remove_users_subdomain_and_auto_workspaces.sql'));
    expect(removeSubdomainMigration).toBeDefined();

    const removeContent = fs.readFileSync(path.join(supabaseMigrationsDir, removeSubdomainMigration!), 'utf8');
    expect(removeContent).toContain('ALTER TABLE users DROP COLUMN IF EXISTS subdomain');
    expect(removeContent).toContain('CREATE INDEX IF NOT EXISTS idx_workspaces_owner_created');
  });
});
