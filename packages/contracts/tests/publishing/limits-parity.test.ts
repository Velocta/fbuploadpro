import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PLATFORM_PUBLISH_LIMITS } from '../../src/publishing/limits.js';
import type { PlatformPublishLimitConfig } from '../../src/publishing/limits.js';

// =============================================================================
// D5 limits parity (A-1, ratified by Shahzeb 2026-10-22)
// =============================================================================
//
// PLATFORM_PUBLISH_LIMITS in packages/contracts/src/publishing/limits.ts is
// the canonical source for the D5 per-account posting limits. The
// destination_claim_limits seed in supabase/migrations is the enforcement
// copy the claim RPC reads at runtime. This test fails if the two drift in
// either direction: a seeded row with no config entry, or a config window
// with no seeded row.
//
// The extractor below is intentionally NOT a general SQL parser. It only
// understands this repo's INSERT shape for destination_claim_limits:
//   INSERT INTO public.destination_claim_limits
//     (platform, metric, cap, window_seconds) VALUES
//     ('instagram', 'published', 100, 86400), ... ;
// Later migrations override earlier ones for the same
// (platform, metric, window_seconds) key — last row wins, matching how the
// migrations apply in filename order.

const testDir = dirname(fileURLToPath(import.meta.url));
// This file: <repo>/packages/contracts/tests/publishing/limits-parity.test.ts
// Repo root is four levels up from the publishing/ test folder.
const repoRoot = resolve(testDir, '../../../..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');

type LimitKey = string; // `${platform}|${metric}|${windowSeconds}`

function key(platform: string, metric: string, windowSeconds: number): LimitKey {
  return `${platform}|${metric}|${windowSeconds}`;
}

function readSeededLimits(): Map<LimitKey, number> {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const seeded = new Map<LimitKey, number>();

  const insertPattern =
    /INSERT\s+INTO\s+(?:public\.)?destination_claim_limits\s*\([^)]*\)\s*VALUES\s*([\s\S]*?);/gi;
  const tuplePattern = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;

  for (const file of files) {
    const raw = readFileSync(join(migrationsDir, file), 'utf8');
    // Strip SQL line comments so commented examples can never be parsed
    // as real seed rows.
    const sql = raw.replace(/--[^\n]*/g, '');

    for (const insertMatch of sql.matchAll(insertPattern)) {
      const valuesChunk = insertMatch[1] ?? '';
      for (const tuple of valuesChunk.matchAll(tuplePattern)) {
        const platform = tuple[1] ?? '';
        const metric = tuple[2] ?? '';
        const cap = Number(tuple[3]);
        const windowSeconds = Number(tuple[4]);
        // Last row wins for a given (platform, metric, window_seconds).
        seeded.set(key(platform, metric, windowSeconds), cap);
      }
    }
  }

  return seeded;
}

const METRIC_BY_CONFIG_FIELD: Record<keyof PlatformPublishLimitConfig, string> = {
  publishedPosts: 'published',
  publishCalls: 'calls',
};

function readConfigLimits(): Map<LimitKey, number> {
  const expected = new Map<LimitKey, number>();

  for (const [platform, config] of Object.entries(PLATFORM_PUBLISH_LIMITS)) {
    // `null` (facebook) and `{}` (youtube/tiktok) produce no seed rows.
    if (config === null) {
      continue;
    }
    for (const [field, metric] of Object.entries(METRIC_BY_CONFIG_FIELD)) {
      const window = config[field as keyof PlatformPublishLimitConfig];
      if (window === undefined) {
        continue;
      }
      expected.set(key(platform, metric, window.windowSeconds), window.maxCount);
    }
  }

  return expected;
}

describe('D5 limits parity — contracts config vs destination_claim_limits seed (A-1)', () => {
  it('seeds exactly the PLATFORM_PUBLISH_LIMITS values, in both directions', () => {
    const seeded = readSeededLimits();
    const expected = readConfigLimits();

    // Guard against a vacuous pass if the extractor ever finds nothing.
    expect(expected.size).toBeGreaterThan(0);
    expect(seeded.size).toBeGreaterThan(0);

    // Exact equality both directions: no row without a config entry,
    // and no config window without a row.
    expect(Object.fromEntries(seeded)).toEqual(Object.fromEntries(expected));
    expect(seeded.size).toBe(expected.size);
  });

  it('produces no seed rows for facebook, youtube, or tiktok', () => {
    const seeded = readSeededLimits();

    for (const platform of ['facebook', 'youtube', 'tiktok']) {
      const rowsForPlatform = [...seeded.keys()].filter((k) =>
        k.startsWith(`${platform}|`),
      );
      expect(rowsForPlatform).toEqual([]);
    }
  });
});
