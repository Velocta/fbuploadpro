# Spec 076: Worker Low-Hanging Hygiene

**Feature Branch**: `fix/076-worker-low-hygiene`
**Created**: 2026-10-19
**Status**: Ready for Planning

## Problem

Batch of small hygiene issues in the worker (all LOW severity from the audit):

1. `export *` ×4 in `index.ts` (lines 33-36) leaks fb-client/dispatcher/settlement/downloader-engine internals.
2. `as ClaimedQueueItem` ×2 in `settlement.ts` (lines 337, 354) — fabricated types via cast.
3. Redundant `0 2 * * *` cron in `wrangler.toml` alongside `* * * * *` — the per-minute tick already gates internally.
4. Unpinned `actions/checkout@v4`, `actions/setup-node@v4` in `sync-vercel-env.yml` (other workflows pin to SHAs).
5. `getMinutes() % 5` cadence coupling in `index.ts:65` — magic number.
6. 17× `throw new Error` in worker src vs `DomainError` in contracts — inconsistent.

## Scope

- Replace `export *` with explicit named re-exports.
- Replace `as` casts with proper construction/narrowing.
- Remove redundant cron; pin actions to SHAs (copy from other workflows).
- Extract `RECOVERY_INTERVAL_MINUTES` constant.
- Convert worker throws to `DomainError` with codes.

Out of scope: full `getMinutes()` decoupling (needs design); changing error semantics.

## Acceptance Criteria

1. No `export *` in worker index; no `as ClaimedQueueItem` casts.
2. Single cron in wrangler.toml; all actions pinned.
3. Named constant for recovery interval; DomainError used consistently.
4. Existing tests pass; CI green.
