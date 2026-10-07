import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Facebook Tokens & Multi-Account DDL Migration Suite', () => {
  it('0002_facebook_tokens.sql exists and contains expected schema alterations', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../migrations/0002_facebook_tokens.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const ddl = fs.readFileSync(migrationPath, 'utf8');

    // facebook_accounts alterations
    expect(ddl).toContain('ALTER TABLE facebook_accounts');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ');

    // facebook_pages alterations
    expect(ddl).toContain('ALTER TABLE facebook_pages');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS category VARCHAR(100)');
    expect(ddl).toContain("ADD COLUMN IF NOT EXISTS tasks JSONB NOT NULL DEFAULT '[]'::jsonb");

    // indexes
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_fb_accounts_status ON facebook_accounts(status)');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_fb_pages_status ON facebook_pages(status)');
  });

  it('verifies 1:N multi-account constraint allows multiple accounts per user while preventing duplicates', () => {
    const migration1Path = path.resolve(
      __dirname,
      '../migrations/0001_initial_schema.sql'
    );
    const ddl1 = fs.readFileSync(migration1Path, 'utf8');

    // Multi-account uniqueness on (user_id, fb_account_id)
    expect(ddl1).toContain(
      'CONSTRAINT uq_fb_accounts_user_account UNIQUE (user_id, fb_account_id)'
    );

    // Page uniqueness per tenant on (user_id, fb_page_id)
    expect(ddl1).toContain(
      'CONSTRAINT uq_fb_pages_user_page UNIQUE (user_id, fb_page_id)'
    );

    // Composite foreign key from page to account (user_id, facebook_account_id)
    expect(ddl1).toContain(
      'CONSTRAINT fk_fb_pages_user_account FOREIGN KEY (user_id, facebook_account_id)'
    );
  });
});
