# Tasks: Rebuild Workspace Settings Facebook Tab

## Phase 1: Setup & Foundational Prerequisites

**Purpose**: Core tab navigation rename and backend API route extensions

- [x] T001 Rename settings tab label from "Facebook BYOC" to "Facebook" in `apps/web/src/app/tenant/[subdomain]/settings/page.tsx`
- [x] T002 Implement `DELETE /api/tenant/[subdomain]/settings/byoc` in `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/route.ts` to delete only App ID and Secret (`workspace_byoc_credentials`)
- [x] T003 Return `connectedAt` in `GET /api/tenant/[subdomain]/settings/byoc` response in `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/route.ts`
- [x] T004 Add unit tests for `DELETE /api/tenant/[subdomain]/settings/byoc` and `connectedAt` in `apps/web/tests/api/byoc-settings-api.test.ts`

---

## Phase 2: User Story 1 - State 1: Not Connected Setup Flow (Priority: P1) 🎯 MVP

**Goal**: Deliver the State 1 ("Not connected") UI with numbered steps, field validation, save flow, toast, and OAuth callback card.

**Independent Test**: Mount tab with no credentials: verify amber "Not connected" badge, Step 1 (link to developers.facebook.com), Step 2 (App ID and Secret fields with validation), and "One more step" card with callback URL and copy button.

- [x] T005 [US1] Rebuild State 1 UI structure in `apps/web/src/components/settings/byoc-settings-view.tsx` with "Connect Facebook" card, amber unboxed status dot (`status="queued"`), and exact subtext
- [x] T006 [US1] Implement Step 1 with numbered badge, title "Get your app details", and semibold accent link to `https://developers.facebook.com` in `apps/web/src/components/settings/byoc-settings-view.tsx`
- [x] T007 [US1] Implement Step 2 with numbered badge, title "Add them here", small-caps labels ("APP ID", "APP SECRET"), placeholders, helper texts, and password show toggle in `apps/web/src/components/settings/byoc-settings-view.tsx`
- [x] T008 [US1] Implement "Connect Facebook" button with click validation (numeric App ID 10–20 digits, non-empty secret), inline field error rendering, sub-button helper text, and success toast "Facebook connected." in `apps/web/src/components/settings/byoc-settings-view.tsx`
- [x] T009 [US1] Implement "One more step" card in `apps/web/src/components/settings/byoc-settings-view.tsx` displaying monospace callback URL in accent color with "Copy" button and helper text

**Checkpoint**: At this point, State 1 is fully functional, validates fields, and saves credentials.

---

## Phase 3: User Story 2 - State 2: Connected Presentation & Edit Flow (Priority: P1)

**Goal**: Deliver State 2 ("Connected") display with masked secret, copy buttons, edit details, and connected date.

**Independent Test**: Mount tab with saved credentials: verify green "Connected" badge, App ID with copy, masked secret with show toggle, "Edit details" and "Disconnect" buttons, and formatted date line. Confirm "One more step" card is hidden.

- [x] T010 [US2] Implement State 2 rendering in `apps/web/src/components/settings/byoc-settings-view.tsx` with green unboxed status dot (`status="operational"`), subtext, App ID with Copy button, and masked secret with Show toggle
- [x] T011 [US2] Implement formatted "Connected on <date>." line under buttons in `apps/web/src/components/settings/byoc-settings-view.tsx`
- [x] T012 [US2] Ensure "One more step" card is conditionally hidden in State 2 in `apps/web/src/components/settings/byoc-settings-view.tsx`
- [x] T013 [US2] Implement "Edit details" handler to pre-fill State 1 form with current App ID, show the form, and unhide "One more step" card in `apps/web/src/components/settings/byoc-settings-view.tsx`

**Checkpoint**: State 2 renders correctly, hides the second card, and enables editing details.

---

## Phase 4: User Story 3 - Disconnect Confirmation & Data Removal (Priority: P1)

**Goal**: Deliver disconnect confirmation dialog with verbatim copy and targeted credential deletion.

**Independent Test**: Click "Disconnect" in State 2: confirm dialog opens with exact copy. Click "Keep connected" to dismiss. Click "Disconnect" to confirm: verify DELETE request succeeds, toast "Facebook disconnected." appears, and tab resets to State 1.

- [x] T014 [US3] Implement Disconnect confirmation dialog in `apps/web/src/components/settings/byoc-settings-view.tsx` with exact title, body, "Keep connected" (secondary), and "Disconnect" (danger) buttons
- [x] T015 [US3] Wire Disconnect action to `DELETE /api/tenant/[subdomain]/settings/byoc`, trigger toast "Facebook disconnected.", and reset to State 1 in `apps/web/src/components/settings/byoc-settings-view.tsx`

**Checkpoint**: Disconnect flow safely removes App ID and Secret while preserving accounts and publishing pipelines.

---

## Phase 5: Polish, Unit Testing & Verification (Priority: P2)

**Goal**: Ensure automated tests cover both states, validation, disconnect, exact copy, responsive layout, and theme compliance.

- [x] T016 [P] Update UI unit test suite in `apps/web/tests/ui/byoc-settings.test.tsx` covering State 1, State 2, Edit mode, Disconnect dialog, and toast notifications
- [x] T017 [P] Verify documentation synchronization in `docs/foundational-knowledge.md`
