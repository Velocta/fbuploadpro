# Tasks: Dedicated User Media Library & Cloudflare R2 Uploads

**Input**: Design documents from `/specs/004-media-library/` (`spec.md`, `plan.md`, `data-model.md`, `contracts/`, `research.md`, `quickstart.md`)  
**Prerequisites**: Spec 001, Spec 002, Spec 003 completed and merged to `main`

---

## Phase 1: Setup (Cloudflare R2 Infrastructure & Environment Config)

**Purpose**: Configure object storage dependencies and environment configuration for Cloudflare R2.

- [X] T078 Configure Cloudflare R2 storage credentials, environment variable schema, and AWS SDK dependencies in `apps/web/src/lib/storage.ts` (Issue: #126)

---

## Phase 2: Foundational (Database Migration, Domain Contracts & Storage Abstraction)

**Purpose**: Core data substrate, validation schemas, and storage abstractions that BLOCK all user stories.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [X] T079 [P] Create domain contracts and validation schemas for media items, upload URLs, and confirmations in `packages/contracts/src/domain/media.ts` (Issue: #127)
- [X] T080 [P] Create domain contracts and validation schemas for folders, captions, and quotas in `packages/contracts/src/domain/folder.ts`, `packages/contracts/src/domain/caption.ts`, and `packages/contracts/src/domain/storage.ts` (Issue: #128)
- [X] T081 [P] Implement `IStorageService` interface and `MockStorageProvider` for test execution in `apps/web/src/lib/storage.ts` (Issue: #129)
- [X] T082 Implement forward DDL migration for media items, folders, caption templates, and storage quotas in `packages/database/migrations/0003_media_library.sql` (Issue: #130)
- [X] T083 Export media contracts and storage interfaces from `packages/contracts/src/index.ts` (Issue: #131)
- [X] T084 [P] Add unit tests for media validation contracts and schemas in `packages/contracts/tests/media-contracts.test.ts` (Issue: #132)
- [X] T085 [P] Add database migration tests asserting multi-tenant isolation, unique constraints, and check constraints in `packages/database/tests/media-library.test.ts` (Issue: #133)

**Checkpoint**: Core contracts, migration, and mock storage ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Direct PC Media Upload & Storage Quota Enforcement (Priority: P1) 🎯 MVP

**Goal**: Content creators upload short-form videos and images directly from PC to Cloudflare R2 via presigned URLs with 5 GB storage quota enforcement.

**Independent Test**: Can be validated by requesting upload URLs for video and image files, asserting quota rejection when remaining space is insufficient, and confirming uploads with metadata persistence.

### Tests for User Story 1 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T086 [P] [US1] Write integration tests for presigned upload URL generation and quota rejection in `apps/web/tests/api/media-upload-url.test.ts` (Issue: #134)
- [X] T087 [P] [US1] Write integration tests for media upload confirmation and atomic quota increment in `apps/web/tests/api/media-confirm.test.ts` (Issue: #135)

### Implementation for User Story 1

- [X] T088 [US1] Implement storage quota inspection route in `apps/web/src/app/api/tenant/[subdomain]/media/quota/route.ts` (Issue: #136)
- [X] T089 [US1] Implement presigned upload URL generation endpoint with quota pre-check in `apps/web/src/app/api/tenant/[subdomain]/media/upload-url/route.ts` (Issue: #137)
- [X] T090 [US1] Implement Cloudflare R2 presigned PUT URL generator in `R2StorageProvider` within `apps/web/src/lib/storage.ts` (Issue: #138)
- [X] T091 [US1] Implement media confirmation endpoint with atomic database transaction and quota increment in `apps/web/src/app/api/tenant/[subdomain]/media/confirm/route.ts` (Issue: #139)

**Checkpoint**: User Story 1 fully functional and testable independently — direct uploads and quota enforcement active.

---

## Phase 4: User Story 2 - Media Organization via Custom Folders & Multi-Tagging (Priority: P2)

**Goal**: Content creators organize uploaded assets into custom folders and assign multi-tag taxonomy with non-destructive folder deletion (`ON DELETE SET NULL`).

**Independent Test**: Can be validated by creating folders, assigning tags, filtering assets by folder and tag, and asserting that deleting a folder preserves contained assets in Unorganized.

### Tests for User Story 2 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T092 [P] [US2] Write unit and integration tests for custom folder CRUD and non-destructive deletion in `apps/web/tests/api/media-folders.test.ts` (Issue: #140)
- [ ] T093 [P] [US2] Write unit and integration tests for media listing, folder filtering, and tag search in `apps/web/tests/api/media-list-filter.test.ts` (Issue: #141)

### Implementation for User Story 2

- [ ] T094 [US2] Implement custom folder listing and creation endpoint in `apps/web/src/app/api/tenant/[subdomain]/media/folders/route.ts` (Issue: #142)
- [ ] T095 [US2] Implement folder update and non-destructive deletion endpoint (`ON DELETE SET NULL`) in `apps/web/src/app/api/tenant/[subdomain]/media/folders/[folderId]/route.ts` (Issue: #143)
- [ ] T096 [US2] Implement media item listing endpoint with folder, media type, and tag filtering in `apps/web/src/app/api/tenant/[subdomain]/media/route.ts` (Issue: #144)

**Checkpoint**: User Stories 1 AND 2 functional — assets can be organized into folders and filtered by tags.

---

## Phase 5: User Story 3 - Reusable Caption Templates Management (Priority: P3)

**Goal**: Social media publishers manage reusable caption templates and attach them to media items as default publishing copy.

**Independent Test**: Can be validated by creating caption templates, updating them, attaching them to media assets, and verifying that template modifications or deletions do not alter snapshotted asset copy.

### Tests for User Story 3 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T097 [P] [US3] Write unit and integration tests for caption templates CRUD and attachment in `apps/web/tests/api/caption-templates.test.ts` (Issue: #145)

### Implementation for User Story 3

- [ ] T098 [US3] Implement caption templates listing and creation endpoint in `apps/web/src/app/api/tenant/[subdomain]/media/captions/route.ts` (Issue: #146)
- [ ] T099 [US3] Implement caption template update and deletion endpoint in `apps/web/src/app/api/tenant/[subdomain]/media/captions/[captionId]/route.ts` (Issue: #147)
- [ ] T100 [US3] Implement media item patch endpoint for updating folder, tags, and attaching captions in `apps/web/src/app/api/tenant/[subdomain]/media/[mediaId]/route.ts` (Issue: #148)

**Checkpoint**: User Stories 1, 2, and 3 functional — copywriting templates can be created and attached to assets.

---

## Phase 6: User Story 4 - Media Preview, Detail Inspection & Safe Asset Purging (Priority: P4)

**Goal**: Content creators inspect full-screen previews with technical metadata and permanently purge unwanted assets from R2 and DB to reclaim storage quota.

**Independent Test**: Can be validated by inspecting media metadata, deleting an asset, and asserting that the storage provider purges the object and the user's storage quota is refunded.

### Tests for User Story 4 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T101 [P] [US4] Write unit and integration tests for media asset retrieval and safe purging with quota reclamation in `apps/web/tests/api/media-purge.test.ts` (Issue: #149)

### Implementation for User Story 4

- [ ] T102 [US4] Implement single media item inspection endpoint in `apps/web/src/app/api/tenant/[subdomain]/media/[mediaId]/route.ts` (Issue: #150)
- [ ] T103 [US4] Implement media asset deletion handler with R2 object purge and atomic quota decrement in `apps/web/src/app/api/tenant/[subdomain]/media/[mediaId]/route.ts` (Issue: #151)

**Checkpoint**: All backend APIs complete — assets can be inspected and purged with quota refunded.

---

## Phase 7: UI Integration (Dedicated Media Library Interface)

**Purpose**: Build the user-facing Media Library at `/tenant/[subdomain]/media`.

- [ ] T104 [P] Implement storage quota meter component in `apps/web/src/components/media/storage-meter.tsx` (Issue: #152)
- [ ] T105 [P] Implement folder sidebar and tag navigation component in `apps/web/src/components/media/folder-sidebar.tsx` (Issue: #153)
- [ ] T106 [P] Implement drag-and-drop file upload modal with client-side canvas thumbnail generation and progress in `apps/web/src/components/media/upload-modal.tsx` (Issue: #154)
- [ ] T107 [P] Implement media asset grid component with aspect ratio badges and video indicators in `apps/web/src/components/media/media-grid.tsx` (Issue: #155)
- [ ] T108 [P] Implement media preview modal with video player, audio controls, and technical metadata inspector in `apps/web/src/components/media/media-preview-modal.tsx` (Issue: #156)
- [ ] T109 [P] Implement caption templates manager modal in `apps/web/src/components/media/caption-modal.tsx` (Issue: #157)
- [ ] T110 Assemble full Media Library dashboard page at `apps/web/src/app/tenant/[subdomain]/media/page.tsx` (Issue: #158)

---

## Phase 8: Polish & Cross-Cutting Quality Gates

**Purpose**: Security audit asserting zero cross-user media leakage and 100% clean Turborepo pipeline validation.

- [ ] T111 [P] Run multi-tenant security isolation audit asserting zero cross-user media leakage in `apps/web/tests/security/media-isolation.test.ts` (Issue: #159)
- [ ] T112 Execute quickstart validation scenarios defined in `specs/004-media-library/quickstart.md` (Issue: #160)
- [ ] T113 Verify all Turborepo quality gates pass cleanly (`pnpm turbo run build lint typecheck test`) across all monorepo packages (Issue: #161)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational (Phase 2).
- **User Story 2 (Phase 4 - P2)**: Depends on User Story 1 (Phase 3).
- **User Story 3 (Phase 5 - P3)**: Depends on User Story 1 & 2.
- **User Story 4 (Phase 6 - P4)**: Depends on User Story 1 & 2.
- **UI Integration (Phase 7)**: Depends on Phases 3, 4, 5, 6.
- **Polish & Quality Gates (Phase 8)**: Depends on all implementation phases complete.

### Parallel Opportunities
- Foundational tests (T084, T085) and domain contracts (T079, T080, T081) can run in parallel.
- User story test tasks (T086, T087, T092, T093, T097, T101) can be written in parallel before implementation.
- UI components (T104, T105, T106, T107, T108, T109) can be built in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (T078)
2. Complete Phase 2: Foundational (T079–T085)
3. Complete Phase 3: User Story 1 (T086–T091)
4. Validate User Story 1 independently with direct upload and quota tests.

### Incremental Delivery
1. Add User Story 2 (T092–T096) ➔ Custom folders & multi-tagging with non-destructive deletion.
2. Add User Story 3 (T097–T100) ➔ Reusable copywriting caption templates vault.
3. Add User Story 4 (T101–T103) ➔ Technical metadata inspection & safe asset purging with quota refund.
4. Add UI Integration (T104–T110) ➔ Interactive Media Library interface at `/tenant/[subdomain]/media`.
5. Polish & Quality Gates (T111–T113) ➔ Security isolation audit and Turborepo 100% clean.
