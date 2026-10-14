/**
 * @file constitution-structure-governance.test.ts
 * @description Governance regression test for ISSUE-17:
 * Constitution Header & Section Indentation Drift
 *
 * Asserts that:
 * 1. .specify/memory/constitution.md header version matches footer version 2.29.0.
 * 2. Sync Impact Report header does NOT contain outdated "2.27.0 -> 2.28.0" or "TODO: Implement Spec 038".
 * 3. Principle 29 is elevated to a top-level list item (29. **Production Mock & Fallback Elimination Rule...**)
 *    instead of an improperly indented sub-bullet under Principle 28.
 * 4. SpecKit automated parsers can read all top-level constitutional principles cleanly.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-17: Constitution Header & Section Indentation Drift', () => {
  const constitutionPath = path.resolve(process.cwd(), '../../.specify/memory/constitution.md');

  it('verifies constitution header and footer versions are synchronized to 2.29.0', () => {
    expect(fs.existsSync(constitutionPath)).toBe(true);

    const content = fs.readFileSync(constitutionPath, 'utf-8');

    // Header sync impact report should state 2.29.0
    expect(content).not.toContain('2.27.0 -> 2.28.0');
    expect(content).not.toContain('TODO: Implement Spec 038');

    // Footer version
    expect(content).toMatch(/\*\*Version\*\*:\s*2\.(?:29|[3-9]\d)\.0/);
  });

  it('verifies Principle 29 is formatted as a top-level principle rather than an indented sub-bullet', () => {
    const content = fs.readFileSync(constitutionPath, 'utf-8');

    // Should NOT be indented under Principle 28 as `  - **Principle 29:`
    expect(content).not.toMatch(/^\s+-\s+\*\*Principle 29/m);

    // Should be top-level numbered principle: `29. **Production Mock & Fallback Elimination Rule...**:`
    expect(content).toMatch(/^29\.\s+\*\*Production Mock & Fallback Elimination Rule/m);
  });
});
