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
});
