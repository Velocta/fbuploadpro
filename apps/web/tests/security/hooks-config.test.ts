/**
 * @file hooks-config.test.ts
 * @description Governance and developer experience regression test for ISSUE-33:
 * Broken Hook Command in .agents/hooks.json
 *
 * Asserts that:
 * 1. .agents/hooks.json exists and is valid JSON.
 * 2. Commands declared in hooks.json do not reference nonexistent shell scripts like './scripts/lint.sh'.
 * 3. Commands reference valid repository commands such as 'pnpm run lint'.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-33: .agents/hooks.json Command Integrity', () => {
  const hooksConfigPath = path.resolve(process.cwd(), '../../.agents/hooks.json');

  it('ensures .agents/hooks.json exists, is valid JSON, and does not reference nonexistent script files', () => {
    expect(fs.existsSync(hooksConfigPath)).toBe(true);

    const rawContent = fs.readFileSync(hooksConfigPath, 'utf-8');
    expect(rawContent).not.toContain('./scripts/lint.sh');

    const parsed = JSON.parse(rawContent);
    const postToolHook = parsed['example-post-tool-hook'];
    expect(postToolHook).toBeDefined();

    const hookList = postToolHook.PostToolUse;
    expect(Array.isArray(hookList)).toBe(true);

    for (const item of hookList) {
      for (const hook of item.hooks) {
        if (hook.type === 'command') {
          expect(hook.command).not.toContain('./scripts/lint.sh');
          expect(hook.command).toBe('pnpm run lint');
        }
      }
    }
  });
});
