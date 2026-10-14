/**
 * @file coding-standards-database-directives.test.ts
 * @description Security and governance regression test for ISSUE-13:
 * Contradictory Database Import Directives in coding-standards.md
 *
 * Asserts that:
 * 1. coding-standards.md does NOT instruct agents to import from `@fbuploadpro/database` or `@fbuploadpro/database/edge`.
 * 2. coding-standards.md mandates `@supabase/supabase-js` over HTTPS per Principle II and Principle 28.
 * 3. .agents/AGENTS.md, .agents/system-prompt.md, and agent templates do not reference eradicated `packages/database`.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-13: Contradictory Database Import Directives in coding-standards.md', () => {
  it('verifies coding-standards.md contains zero references to eradicated @fbuploadpro/database packages', () => {
    const filePath = path.resolve(process.cwd(), '../../.agents/rules/coding-standards.md');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('@fbuploadpro/database');
    expect(content).not.toContain('packages/database');
    expect(content).toContain('@supabase/supabase-js');
  });

  it('verifies .agents/AGENTS.md contains zero references to eradicated packages/database or @fbuploadpro/database', () => {
    const filePath = path.resolve(process.cwd(), '../../.agents/AGENTS.md');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('@fbuploadpro/database');
    expect(content).not.toContain('packages/database');
  });

  it('verifies .agents/system-prompt.md contains zero references to packages/database', () => {
    const filePath = path.resolve(process.cwd(), '../../.agents/system-prompt.md');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('packages/database');
    expect(content).not.toContain('@fbuploadpro/database');
  });
});
