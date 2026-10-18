# Plan — Spec 075: DB Write Error Checks + Photo-ID Guard

## Approach

Three surgical fixes. No signature changes (avoids threading env through call sites — out of scope for hygiene).

## Changes

### 1. `apps/worker/src/services/downloader-engine.ts` — `updateJobStatus`

```ts
const { error } = await db.from('media_download_jobs').update(dbUpdates).eq('id', jobId);
if (error) {
  console.error('[updateJobStatus] Failed to persist job status:', { jobId, error });
}
```

### 2. `apps/worker/src/settlement.ts` (~line 224)

```ts
const { error: accountUpdateError } = await accountUpdateQuery;
if (accountUpdateError) {
  console.error('[settleOutcome] Failed to mark account expired:', { accountId, error: accountUpdateError });
}
```

Note: `accountUpdateQuery` is `any` — the Supabase builder returns `{ error }` on await. Safe.

### 3. `apps/worker/src/fb-client.ts` (~line 439)

```ts
if (!photoData.id) {
  throw new FacebookGraphError('Invalid photo upload response for story: missing id');
}
const photoId = String(photoData.id);
```

Guard before stringifying — `String(undefined)` is `"undefined"` (truthy).

## Verification

- Existing worker tests pass.
- CI green.
