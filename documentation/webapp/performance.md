# Webapp Performance Guide

## Core Targets

- Keep dashboard navigation responsive with minimal duplicate auth fetches.
- Keep admin payloads bounded (no broad `select('*')` on large tables).
- Keep landing page client JS lean by limiting `use client` islands.

## Implemented Baseline Improvements

- Cached server-side user lookup via `getSessionUser`.
- Reduced super-admin overview query width to selected columns.
- Added route-level loading UI for dashboard segment.
- Introduced API v1 routes with Node runtime for integration-heavy requests.

## Regression Prevention

- Use `npm run lint` and `npm run typecheck` in CI.
- Track route payload growth in admin/agency pages during PR review.
- Prefer server components and server services before adding client state.

## Optimization Rules for New Work

- Avoid duplicate `supabase.auth.getUser()` calls in the same render path.
- Put heavy data joins behind service/repository functions.
- Prefer feature-local components and lazy load only when interaction warrants it.
- Keep API responses minimal and explicit.
