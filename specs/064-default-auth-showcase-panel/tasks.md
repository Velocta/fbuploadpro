# Implementation Tasks: Spec 064 - Default Auth Showcase Panel Standardization

## User Story 1 (P1): Canonical Default Showcase Across All Auth Pages
- [x] **T001**: Export `AuthShowcasePanel` alias in `apps/web/src/components/auth/login-showcase-panel.tsx`.
- [x] **T002**: Import `AuthShowcasePanel` in `apps/web/src/components/auth/auth-split-layout.tsx` and set it as the default value `{showcase ?? <AuthShowcasePanel />}`.

## User Story 2 (P1): Elimination of Legacy Showcase Bloat
- [x] **T003**: Purge `VALUE_PILLARS`, `ShieldCheckIcon`, `CloudIcon`, `CommentIcon`, and `LockIcon` from `auth-split-layout.tsx`.
- [x] **T004**: Purge old inline showcase markup from `auth-split-layout.tsx`.

## User Story 3 (P1): Test Suite Modernization
- [x] **T005**: Update `apps/web/tests/auth/auth-components.test.tsx` to assert new canonical showcase text and elements.
- [x] **T006**: Add test verifying `SignupPage` renders the new default showcase panel.

## Documentation Synchronization
- [x] **T007**: Update `docs/foundational-knowledge.md` to document the global default auth showcase panel standardization (Spec 064).
