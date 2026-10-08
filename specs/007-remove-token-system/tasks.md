# Tasks: 007-remove-token-system

**Feature**: Purge Token System & Enforce Unrestricted Publishing
**Branch**: `refactor/remove-token-system`
**Ratified**: 2026-10-08
**Constitution**: 2.0.0

---

## Phase 1: User Story 1 - Contracts & Database DDL Purge (Priority: P1)

**Target Subagent**: `backend-engineer`
**Goal**: Remove all token schemas, attributes, DDL tables, and decrement helpers from contracts and database packages.

- [X] T001 [US1] Remove `tokensBalance` from `UserSchema` in `packages/contracts/src/domain/user.ts` and remove `TokenTransaction` schemas from `packages/contracts/src/domain/billing.ts` and `packages/contracts/src/index.ts`
- [X] T002 [US1] Update `packages/contracts/tests/user.test.ts` to assert user schema without `tokensBalance`
- [X] T003 [US1] Clean DDL rewrite: purge `tokens_balance` and delete `token_transactions` table from `packages/database/migrations/0001_initial_schema.sql`, and purge `tokens_deducted` from `packages/database/migrations/0004_publishing_engine.sql`
- [X] T004 [US1] Remove `atomicDecrementTokens` method from `packages/database/src/client.ts` and `packages/database/src/edge.ts`
- [X] T005 [US1] Update `packages/database/tests/database.test.ts` and `packages/database/tests/schema.test.ts` to assert pruned schema and remove token decrement tests

---

## Phase 2: User Story 2 - Unrestricted Queueing & Worker Settlement (Priority: P1)

**Target Subagents**: `backend-engineer`, `qa-engineer`
**Goal**: Remove 402 balance gates on queueing and eliminate token debit queries from edge worker settlement.

- [X] T006 [US2] In `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/route.ts`, remove Step 4 `SELECT tokens_balance` check and 402 Payment Required response; authorize queueing directly for active users
- [X] T007 [US2] In `apps/worker/src/settlement.ts`, remove `DECREMENT_USER_TOKENS_SQL` and `INSERT_TOKEN_TRANSACTION_SQL`; settle published items and insert `publish_logs` with zero token deductions
- [X] T008 [US2] In `apps/worker/tests/token-settlement.test.ts`, update tests to verify pure settlement without token debits or ledger queries
- [X] T009 [US2] In `apps/web/tests/api/publishing-queue.test.ts` and `apps/web/tests/security/publishing-isolation.test.ts`, update test assertions to assert unrestricted queueing without 402 errors

---

## Phase 3: User Story 3 - Tenant UI Header & Navigation Cleanup (Priority: P2)

**Target Subagent**: `frontend-engineer`
**Goal**: Remove token balance queries and display badges from the tenant shell.

- [X] T010 [US3] In `apps/web/src/app/tenant/[subdomain]/layout.tsx`, remove `SELECT tokens_balance` query and the `⚡ X tokens` badge from header navigation

---

## Phase 4: Quality Gate & Polish

**Target Subagent**: `qa-engineer` / `devops-engineer`
**Goal**: Validate all 6 packages pass lint, typecheck, test, and build with 100% success.

- [X] T011 [Polish] Execute full monorepo verification: `pnpm turbo run build lint typecheck test` and verify zero errors
