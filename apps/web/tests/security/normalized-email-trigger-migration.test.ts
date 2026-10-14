/**
 * @file normalized-email-trigger-migration.test.ts
 * @description Regression test for ISSUE-45: trg_canonicalize_user_email Bypassed on Direct normalized_email Updates
 *
 * Verifies that:
 * 1. A forward migration updates trg_canonicalize_user_email to fire on BEFORE INSERT OR UPDATE OF email, normalized_email ON users.
 * 2. canonicalize_user_email() handles both email and normalized_email modifications, canonicalizing them identically.
 * 3. Empty usernames before '@' raise clean exceptions rather than leaking unhandled check constraint failures.
 * 4. All non-alphanumeric characters are stripped from the username and domain is restricted strictly to @gmail.com or @googlemail.com.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-45: trg_canonicalize_user_email Bypassed on Direct normalized_email Updates', () => {
  const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');

  it('provides a forward database migration ensuring trigger fires on email and normalized_email updates with clean exception handling', () => {
    const files = fs.readdirSync(migrationsDir);
    const migrationFile = files.find((f) => f.includes('fix_normalized_email_trigger_and_check_constraint'));

    expect(migrationFile).toBeDefined();

    const sqlContent = fs.readFileSync(path.join(migrationsDir, migrationFile!), 'utf-8');

    // 1. Asserts function definition
    expect(sqlContent).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?canonicalize_user_email\(\)/i);

    // 2. Asserts trigger fires on BEFORE INSERT OR UPDATE OF email, normalized_email ON users
    expect(sqlContent).toMatch(/CREATE\s+TRIGGER\s+trg_canonicalize_user_email\s+BEFORE\s+INSERT\s+OR\s+UPDATE\s+OF\s+email,\s*normalized_email\s+ON\s+users/i);

    // 3. Asserts clean exception handling for empty username
    expect(sqlContent).toMatch(/RAISE\s+EXCEPTION\s+['"]Email username cannot be empty['"]/i);

    // 4. Asserts domain check and exception
    expect(sqlContent).toMatch(/RAISE\s+EXCEPTION\s+['"]Only @gmail\.com or @googlemail\.com email addresses are permitted['"]/i);

    // 5. Asserts handling for direct normalized_email update branch
    expect(sqlContent).toMatch(/ELSIF\s+NEW\.normalized_email\s+IS\s+NOT\s+NULL\s+THEN/i);

    // 6. Asserts non-alphanumeric character stripping
    expect(sqlContent).toMatch(/regexp_replace\(.*,\s*'\s*\[\^a-z0-9\]\s*',\s*''/i);
  });
});
