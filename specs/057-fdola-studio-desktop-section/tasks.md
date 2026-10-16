# Tasks: Fdola Studio Desktop-Only Section & Native Shell Scaffolding

**Specification**: [`specs/057-fdola-studio-desktop-section/spec.md`](./spec.md)  
**Plan**: [`specs/057-fdola-studio-desktop-section/plan.md`](./plan.md)  

## Phase 1: Setup & Foundational

**Purpose**: Navigation entries and route contracts in workspace shell

- [x] **T001**: Register `fdola-studio` route in `computeBreadcrumbs` mapping (`apps/web/src/components/workspace/workspace-breadcrumb.tsx`)
- [x] **T002**: Add "Fdola Studio" menu item with studio icon directly below "Downloader" in primary navigation group (`apps/web/src/components/workspace/workspace-sidebar.tsx`)

---

## Phase 2: User Story 1 — Sidebar Navigation & Breadcrumb Integration (Priority: P1) 🎯 MVP

**Goal**: Deliver seamless sidebar discovery, active highlighting, and breadcrumb tracking for Fdola Studio.

**Independent Test**: Verify sidebar renders `Home` -> `Media Library` -> `Downloader` -> `Fdola Studio` -> `Separator` -> `Platform`, and active state highlights when URL is `/tenant/[subdomain]/fdola-studio`.

- [x] **T003**: [US1] Update `apps/web/tests/ui/workspace-sidebar.test.tsx` to assert Fdola Studio positioning, icon tooltip, and active state
- [x] **T004**: [US1] Update `apps/web/tests/ui/workspace-breadcrumb.test.tsx` to assert `computeBreadcrumbs` returns `[{ label: 'Fdola Studio' }]`

---

## Phase 3: User Story 2 — Web Browser Desktop-Only Gate View (Priority: P1)

**Goal**: Present an authoritative, polished desktop gate view in standard browsers with desktop feature highlights and launch/download guidance.

**Independent Test**: Navigate to `/tenant/[subdomain]/fdola-studio` in browser mode (`isDesktopApp() === false`) and verify gate card renders with explanation, CTAs, and return button.

- [x] **T005**: [US2] Implement `FdolaStudioGate` in `apps/web/src/components/studio/fdola-studio-gate.tsx` with midnight-slate container, desktop-only notice ("This feature is only available on desktop. Please download the desktop app."), zero download links, and return button
- [x] **T006**: [US2] Implement environment-adaptive `FdolaStudioView` in `apps/web/src/components/studio/fdola-studio-view.tsx` with hydration safety and `forceDesktop` testing override
- [x] **T007**: [US2] Create tenant page route in `apps/web/src/app/tenant/[subdomain]/fdola-studio/page.tsx`

---

## Phase 4: User Story 3 — Empty Fdola Studio Workspace for Desktop App (Priority: P1)

**Goal**: Deliver the empty Fdola Studio workspace placeholder when running inside the desktop app.

**Independent Test**: Navigate to `/tenant/[subdomain]/fdola-studio` with desktop environment active (`isDesktopApp() === true`) and verify the empty desktop workspace placeholder renders.

- [x] **T008**: [US3] Implement empty `FdolaStudioWorkspace` placeholder in `apps/web/src/components/studio/fdola-studio-workspace.tsx`
- [x] **T009**: [US3] Author unit tests in `apps/web/tests/ui/fdola-studio.test.tsx` verifying web gate view, empty desktop workspace placeholder, and return button

---

## Phase 5: Polish & Documentation

**Purpose**: Documentation synchronization and consistency alignment

- [x] **T010**: Synchronize architecture reference and platform roadmap in `docs/foundational-knowledge.md`
