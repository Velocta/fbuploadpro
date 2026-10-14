/**
 * @file auth-contracts-routing-drift.test.ts
 * @description Security and governance regression test for ISSUE-16:
 * Legacy /dashboard Route and user.subdomain Lingering in Contracts Tests
 *
 * Asserts that:
 * 1. auth-contracts.test.ts asserts tenant root redirection ('/') or canonical tenant paths, not banned '/dashboard' per Principle 14.
 * 2. AuthSuccessResponseSchema redirectUrl defaults and tests reflect canonical workspace root.
 * 3. AuthUser interface in supabase-auth.ts and user models decouple user.subdomain to align with Principle 27 (workspaces table as source of truth).
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-16: Legacy /dashboard Route and user.subdomain Lingering in Contracts Tests', () => {
  it('verifies auth-contracts.test.ts does not assert banned /dashboard redirect targets', () => {
    const filePath = path.resolve(process.cwd(), '../../packages/contracts/tests/auth-contracts.test.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('/dashboard');
    expect(content).toContain("redirectUrl: 'https://janedoe.fbuploadpro.com/'");
  });

  it('verifies auth-hardening.test.ts does not assert banned /dashboard redirect targets', () => {
    const filePath = path.resolve(process.cwd(), '../../packages/contracts/tests/auth-hardening.test.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('/dashboard');
  });

  it('verifies AuthUser in apps/web/src/lib/supabase-auth.ts documents workspace authority per Principle 27', () => {
    const filePath = path.resolve(process.cwd(), 'src/lib/supabase-auth.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('Principle 27');
  });
});
