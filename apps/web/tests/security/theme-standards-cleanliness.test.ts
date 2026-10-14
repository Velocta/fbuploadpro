/**
 * @file theme-standards-cleanliness.test.ts
 * @description Governance regression test for ISSUE-14:
 * Broken Hardcoded Agent Worktree Links in theme-standards.md
 *
 * Asserts that:
 * 1. .agents/rules/theme-standards.md contains zero hardcoded absolute worktree links (file:///home/agent/...).
 * 2. .agents/rules/theme-standards.md uses clean repository-relative paths (`apps/web/src/lib/theme.ts`, `apps/web/src/app/globals.css`, `DESIGN.md`).
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-14: Theme Standards Governance Link Cleanliness', () => {
  const themeStandardsPath = path.resolve(process.cwd(), '../../.agents/rules/theme-standards.md');

  it('verifies theme-standards.md does not contain hardcoded worktree links', () => {
    expect(fs.existsSync(themeStandardsPath)).toBe(true);

    const content = fs.readFileSync(themeStandardsPath, 'utf-8');

    // Asserts no ephemeral file:/// or worktree paths
    expect(content).not.toContain('file:///home/agent');
    expect(content).not.toContain('verify_speckit_access');
    expect(content).not.toContain('worktrees');

    // Asserts clean relative links
    expect(content).toContain('`apps/web/src/lib/theme.ts`');
    expect(content).toContain('`DESIGN.md`');
  });
});
