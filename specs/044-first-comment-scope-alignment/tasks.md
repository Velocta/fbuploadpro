# Implementation Tasks: First Comment Scope Alignment (pages_manage_engagement)

**Feature**: First Comment Scope Alignment  
**Branch**: `feat/044-first-comment-scope-alignment`  
**Status**: Completed / Converged (100%)  

---

## Phase 1: Setup

**Purpose**: Alignment verification and setup across monorepo targets.

- [x] T001 Verify active Facebook OAuth scope propagation points in `apps/web` and documentation in `docs/`.

---

## Phase 2: User Story 1 (P1) - Authorized First Comment Publishing via OAuth Alignment

**Goal**: Ensure Facebook OAuth authorization dialog URLs include `pages_manage_engagement` so Page Access Tokens are authorized to create automated first comments via `POST /{post-id}/comments`.

- [x] T002 [US1] Update OAuth scope string in `apps/web/src/app/api/auth/facebook/route.ts` to include `pages_manage_engagement`.
- [x] T003 [US1] Update OAuth scope string in `apps/web/src/app/connect/facebook/route.ts` to include `pages_manage_engagement`.
- [x] T004 [US1] Update OAuth redirect unit tests in `apps/web/tests/api/auth-facebook.test.ts` to assert that `pages_manage_engagement` is present in the `scope` query parameter.

---

## Phase 3: User Story 2 (P2) - BYOC Setup Guidance & Permissions Transparency

**Goal**: Ensure the BYOC setup view in `apps/web` displays `pages_manage_engagement` in the Required Meta App Permissions badge checklist.

- [x] T005 [US2] Add `pages_manage_engagement` to the Required Meta App Permissions badge array in `apps/web/src/components/settings/byoc-settings-view.tsx`.
- [x] T006 [US2] Update BYOC settings test assertions in `apps/web/tests/ui/byoc-settings.test.tsx` to verify `pages_manage_engagement` badge rendering.

---

## Phase 4: Polish & Documentation

**Purpose**: Architecture knowledge synchronization and convergence verification.

- [x] T007 [P] Update `docs/foundational-knowledge.md` to document the 5 production Meta permissions and explain the necessity of `pages_manage_engagement` for first comments.
- [x] T008 Run convergence check (`speckit-converge`) and verify all tasks are checked off.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: Can run immediately.
- **User Story 1 (Phase 2)**: Core OAuth route updates and unit tests.
- **User Story 2 (Phase 3)**: UI checklist update and UI test assertions.
- **Polish (Phase 4)**: Documentation synchronization and convergence validation.
