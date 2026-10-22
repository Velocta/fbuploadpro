/**
 * @file theme-standards-cleanliness.test.ts
 * @description Governance regression tests:
 * - ISSUE-14: .agents/rules/theme-standards.md contains no hardcoded absolute
 *   worktree links and uses clean repository-relative paths.
 * - Spec 129 PR-F1: theme-standards.md names the design-token files
 *   (apps/web/tokens/) and the generated outputs as the authority / source of
 *   truth, and does not present the deleted DESIGN.md as an authority.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Theme Standards Governance Cleanliness', () => {
  const themeStandardsPath = path.resolve(process.cwd(), '../../.agents/rules/theme-standards.md');

  it('verifies theme-standards.md does not contain hardcoded worktree links', () => {
    expect(fs.existsSync(themeStandardsPath)).toBe(true);

    const content = fs.readFileSync(themeStandardsPath, 'utf-8');

    // Asserts no ephemeral file:/// or worktree paths
    expect(content).not.toContain('file:///home/agent');
    expect(content).not.toContain('verify_speckit_access');
    expect(content).not.toContain('worktrees');

    // Asserts clean relative links to the token source and generated outputs
    expect(content).toContain('`apps/web/src/lib/theme.ts`');
    expect(content).toContain('`apps/web/tokens/`');
    expect(content).toContain('`apps/web/src/styles/tokens.generated.css`');
  });

  it('verifies the token system — not DESIGN.md — is the stated authority (spec 129)', () => {
    const content = fs.readFileSync(themeStandardsPath, 'utf-8');

    // DESIGN.md must not be presented as an authority or as immutable.
    expect(content).not.toContain('Absolute Immutability');
    expect(content).not.toContain('permanently frozen');
    expect(content).not.toContain('System Specification');

    // The token files are named as the source of truth.
    expect(content).toContain('single source of truth');
  });
});
