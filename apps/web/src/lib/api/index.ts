/**
 * Typed API client (spec 137 §3.1) — public surface.
 *
 * Browser code imports from `@/lib/api`: `apiFetch` / `api` verb
 * helpers, the `ApiError` taxonomy, the session-expired handler
 * registration (used by PR-A1b's data-layer provider), and the zod
 * response schemas in `./schemas`.
 */
export * from './client';
export * from './errors';
export * from './session-expired';
export * as apiSchemas from './schemas';
