# Implementation Tasks: Supabase Authentication Flow (Spec 009)

## Phase 1: Setup & Contracts

- [x] **T001**: Define `SignupRequestSchema`, `LoginRequestSchema`, and `AuthSuccessResponseSchema` in `packages/contracts/src/domain/auth.ts` and export from barrel `packages/contracts/src/index.ts`.
- [x] **T002**: Implement `deriveSubdomainFromEmail` utility in `packages/contracts/src/domain/auth.ts` with unit tests covering stripping of dots, plus tags, slug bounding, and character filtering.
- [x] **T003**: Add migration `packages/database/migrations/0006_users_phone_number.sql` adding optional `phone VARCHAR(50)` to `users` table and update database schema tests.

---

## Phase 2: Backend Auth Engine & API Endpoints

- [x] **T004**: Implement Supabase Auth service client in `apps/web/src/lib/supabase-auth.ts` supporting Supabase Auth with hermetic fallback for CI test environments.
- [x] **T005**: Implement `POST /api/auth/signup` in `apps/web/src/app/api/auth/signup/route.ts` with automatic subdomain derivation, Supabase user registration, database sync, quota initialization, and root-domain cookie setting.
- [x] **T006**: Implement `POST /api/auth/login` in `apps/web/src/app/api/auth/login/route.ts` with Supabase verification, status assertion (`active` vs `suspended`), root-domain cookie setting, and `returnUrl` redirection.
- [x] **T007**: Implement `POST /api/auth/logout` and `GET /api/auth/me` in `apps/web/src/app/api/auth/logout/route.ts` and `apps/web/src/app/api/auth/me/route.ts`.
- [x] **T008**: Create backend unit and integration tests in `apps/web/tests/api/auth-endpoints.test.ts`.

---

## Phase 3: Production Frontend Dual-Theme UI Pages

- [x] **T009**: Recreate `/signup` page in `apps/web/src/app/signup/page.tsx` using Spec 008 primitives (`Card`, `Input`, `Button`, `Alert`) with live subdomain derivation preview, field validation, and loading spinner.
- [x] **T010**: Recreate `/login` page in `apps/web/src/app/login/page.tsx` using Spec 008 primitives (`Card`, `Input`, `Button`, `Alert`) with returnUrl preservation, password visibility toggle, and error alert banners.
- [x] **T011**: Create frontend unit tests for Login and Signup views in `apps/web/tests/components/auth-pages.test.tsx`.

---

## Phase 4: Verification, Convergence & Pull Request

- [x] **T012**: Verify full quality gates via `pnpm turbo run build lint typecheck test` with 100% pass rate.
- [x] **T013**: Commit all implementation tasks, push branch `feat/login-signup-flow` to origin, and create GitHub Pull Request.
