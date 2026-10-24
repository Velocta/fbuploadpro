import { describe, it, expect } from 'vitest';
import fixturesJson from './fixtures/bridge-fixtures.json';
import {
  DESKTOP_BRIDGE_COMMANDS,
  DESKTOP_BRIDGE_REQUEST_SCHEMAS,
  DesktopArtifactManifestSchema,
  RememberTenantRequestSchema,
} from '@fbuploadpro/contracts';

// Shared TS↔Rust fixtures (spec 145 §13.2, tasks T-05). The Rust suite reads
// the same JSON file, so a TS↔Rust shape drift fails in CI, not in a feature
// team's worktree.
const fixtures = fixturesJson as unknown as {
  commands: Array<{ command: string; validRequest: unknown; validResponse: unknown; invalidRequests: unknown[] }>;
  events: Array<{ event: string; payload: unknown }>;
  manifests: { valid: unknown; invalid: unknown[] };
};

describe('desktop bridge fixtures (shared TS↔Rust)', () => {
  it('covers all 52 commands, each with a valid request and invalid cases where rules exist', () => {
    expect(fixtures.commands).toHaveLength(52);
    expect(fixtures.commands.map((f) => f.command).sort()).toEqual([...DESKTOP_BRIDGE_COMMANDS].sort());
    for (const fixture of fixtures.commands) {
      const schema = DESKTOP_BRIDGE_REQUEST_SCHEMAS[fixture.command];
      if (schema) {
        expect(schema.safeParse(fixture.validRequest).success, `${fixture.command}: valid request must parse`).toBe(true);
        for (const invalid of fixture.invalidRequests) {
          expect(schema.safeParse(invalid).success, `${fixture.command}: invalid request must fail: ${JSON.stringify(invalid)}`).toBe(false);
        }
      }
    }
  });

  it('covers all 8 events', () => {
    expect(fixtures.events).toHaveLength(8);
    for (const ev of fixtures.events) {
      expect(ev.event.startsWith('desktop:')).toBe(true);
      expect((ev.payload as { seq: number }).seq).toBeGreaterThanOrEqual(0);
    }
  });

  it('manifest fixtures: valid parses, each invalid fails (proves fixtures are asserted, not just present)', () => {
    expect(DesktopArtifactManifestSchema.safeParse([fixtures.manifests.valid]).success).toBe(true);
    for (const invalid of fixtures.manifests.invalid) {
      expect(DesktopArtifactManifestSchema.safeParse([invalid]).success).toBe(false);
    }
    // A deliberately corrupted fixture fails: mutate a valid subdomain.
    expect(RememberTenantRequestSchema.safeParse({ subdomain: 'BAD SUBDOMAIN!' }).success).toBe(false);
  });
});
