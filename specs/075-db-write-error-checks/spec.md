# Spec 075: DB Write Error Checks + Photo-ID Guard

**Feature Branch**: `fix/075-db-write-error-checks`
**Created**: 2026-10-19
**Status**: Ready for Planning

## Problem

Two fire-and-forget DB writes silently swallow failures, and a missing-ID guard can never fire:

1. **M13a**: `updateJobStatus` in `apps/worker/src/services/downloader-engine.ts` does `await db.from('media_download_jobs').update(...)` without checking `{ error }` — a failed write means the job status silently goes stale.
2. **M13b**: `apps/worker/src/settlement.ts` (~line 224) account-expiry cascade — `await accountUpdateQuery` unchecked.
3. **M33**: `apps/worker/src/fb-client.ts` (~line 438) — `String(photoData.id)` yields the string `"undefined"` when `id` is missing, which is truthy, so the `if (!photoId)` guard never fires.

## Scope

- Check `{ error }` on both DB writes; on failure, report via `captureWorkerError` (Phase 3) with site context. Do not throw — these are background paths where throwing could break the tick; surfacing via error tracking is the right call.
- Replace the M33 guard with `if (!photoData.id)` before stringifying.

Out of scope: broader error-handling refactors; changing write semantics.

## Acceptance Criteria

1. Both DB writes check their result and report failures to PostHog.
2. `photoData.id` missing → guard fires (no `"undefined"` string).
3. Existing tests pass; CI green.
