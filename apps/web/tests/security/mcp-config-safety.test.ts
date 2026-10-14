/**
 * @file mcp-config-safety.test.ts
 * @description Security and governance regression test for ISSUE-47:
 * .agents/mcp_config.json Bypasses Confirmation on Prohibited Migration Tools
 *
 * Asserts that:
 * 1. .agents/mcp_config.json exists and is valid JSON.
 * 2. .agents/mcp_config.json does NOT contain `skip_elicitations` parameter for execute_sql or apply_migration.
 * 3. Human approval safeguards and constitutional prohibition against executing Supabase migrations via MCP are maintained.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ISSUE-47: MCP Configuration Safety & Prohibited Migration Tools Safeguards', () => {
  const mcpConfigPath = path.resolve(process.cwd(), '../../.agents/mcp_config.json');

  it('verifies .agents/mcp_config.json does not bypass confirmation on prohibited migration tools via skip_elicitations', () => {
    expect(fs.existsSync(mcpConfigPath)).toBe(true);

    const rawContent = fs.readFileSync(mcpConfigPath, 'utf-8');
    expect(rawContent).not.toContain('skip_elicitations');
    expect(rawContent).not.toContain('execute_sql');
    expect(rawContent).not.toContain('apply_migration');

    const parsed = JSON.parse(rawContent);
    const supabaseServer = parsed.mcpServers?.supabase;
    expect(supabaseServer).toBeDefined();

    if (supabaseServer.url) {
      expect(supabaseServer.url).not.toContain('skip_elicitations');
      expect(supabaseServer.url).not.toContain('execute_sql');
      expect(supabaseServer.url).not.toContain('apply_migration');
    }
    if (supabaseServer.serverUrl) {
      expect(supabaseServer.serverUrl).not.toContain('skip_elicitations');
      expect(supabaseServer.serverUrl).not.toContain('execute_sql');
      expect(supabaseServer.serverUrl).not.toContain('apply_migration');
    }
  });
});
