# Implementation Tasks: Spec 061 Workspace Settings General Tab Redesign

**Branch**: `feat/061-workspace-settings-general-redesign` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Tasks

### Phase 1: Shared Contracts & Backend API (P1)
- [x] **T001**: Define `UpdateWorkspaceRequestSchema` and `UpdateWorkspaceRequest` in `packages/contracts/src/domain/workspace.ts` enforcing 3–40 characters and no leading/trailing spaces (`name === name.trim()`).
- [x] **T002**: Implement `PATCH` handler in `apps/web/src/app/api/workspaces/route.ts` with session authentication, input validation via `UpdateWorkspaceRequestSchema`, ownership verification (`owner_id = session.userId`), and updating the workspace name in Supabase PostgREST.

### Phase 2: Workspace Settings Page & General Tab UI (P1 & P2)
- [x] **T003**: Update page header in `apps/web/src/app/tenant/[subdomain]/settings/page.tsx` with heading "Settings" and subtext "Manage Settings", keeping existing tabs ("General" and "Facebook BYOC") unchanged.
- [x] **T004**: Redesign `apps/web/src/components/settings/general-settings-view.tsx` to render strictly ONE card:
  - Card heading: "About this workspace"
  - Card subtext: "Name your workspace."
  - Name row: label "WORKSPACE NAME" (small-caps label style), current value, and "Edit" button (secondary/outline style).
  - Edit behavior: inline text input with "Save" (primary) and "Cancel" (secondary) buttons.
  - Validation: 3–40 characters, no leading/trailing spaces.
  - Helper line: "Rename it any time — the new name shows up everywhere."
  - Toast: success toast "Workspace name updated." upon save.
  - Mobile responsive: stacks name above, Edit button below full-width on mobile (<640px).
  - Removal of all legacy items: NO subdomain display, NO status indicator, NO "Created" date, NO plan/storage info, NO danger zone.

### Phase 3: Shell Synchronization (P1)
- [x] **T005**: Add `workspace-updated` event listener in `apps/web/src/components/workspace/workspace-studio-footer.tsx` and `apps/web/src/components/workspace/workspace-switcher.tsx` to immediately refresh workspace names across the shell without page reload or layout shift.

### Phase 4: Automated Testing & Verification
- [x] **T006**: Add UI unit tests in `apps/web/tests/ui/general-settings.test.tsx` asserting exact copy, single-card structure, edit flow, cancel revert, validation errors, toast message, and absence of legacy metadata.
- [x] **T007**: Add API tests in `apps/web/tests/api/workspaces-api.test.ts` asserting `PATCH /api/workspaces` behavior: unauthorized 401, validation 400, not found/forbidden 404/403, and successful 200 rename.

### Phase 5: Documentation Synchronization
- [x] **T008**: Update `docs/foundational-knowledge.md` to document Spec 061 Workspace Settings General Tab Redesign in the roadmap milestones.
