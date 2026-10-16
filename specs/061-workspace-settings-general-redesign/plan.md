# Implementation Plan: Spec 061 Workspace Settings General Tab Redesign

**Branch**: `feat/061-workspace-settings-general-redesign` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

---

## 1. Summary

Redesign the General tab of Workspace Settings (`/tenant/[subdomain]/settings`) to feature exactly ONE card titled "About this workspace". The card provides an inline rename capability with exact copy, 3–40 character validation with no leading/trailing spaces, a success toast "Workspace name updated.", immediate shell synchronization (sidebar footer & workspace switcher), responsive mobile stacking, and the complete removal of all legacy metadata (subdomain display, status indicators, creation dates, plan/storage info, danger zone).

---

## 2. Technical Context

- **Platform**: Next.js 16 (App Router), React 19 (`apps/web`).
- **Design System & Theme Authority**: Strictly adheres to `apps/web/src/lib/theme.ts` (`THEME`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`) and `DESIGN.md` (frozen/immutable). Zero ad-hoc colors, zero pill badges, zero emojis.
- **Contracts**: `@fbuploadpro/contracts` domain contracts (`UpdateWorkspaceRequestSchema`).
- **Data Layer**: Supabase PostgREST via `apps/web/src/app/api/workspaces/route.ts` (`PATCH`).
- **Inter-Component Eventing**: Custom event (`window.dispatchEvent(new CustomEvent('workspace-updated', ...))`) for instant reactive updates in `WorkspaceStudioFooter` and `WorkspaceSwitcher` without layout shifts or full reloads.

---

## 3. Architecture & File Structure

```text
packages/contracts/src/domain/
└── workspace.ts                        # Add UpdateWorkspaceRequestSchema and UpdateWorkspaceRequest

apps/web/src/
├── app/
│   ├── api/workspaces/
│   │   └── route.ts                    # Add PATCH handler for workspace renaming
│   └── tenant/[subdomain]/settings/
│       └── page.tsx                    # Update page header (Heading: "Settings", Subtext: "Manage Settings")
├── components/
│   ├── settings/
│   │   └── general-settings-view.tsx   # Redesigned single-card General tab implementation
│   └── workspace/
│       ├── workspace-studio-footer.tsx # Add 'workspace-updated' event listener
│       └── workspace-switcher.tsx      # Add 'workspace-updated' event listener
└── tests/
    ├── api/
    │   └── workspaces.test.ts          # API tests for PATCH /api/workspaces
    └── ui/
        └── general-settings.test.tsx   # UI component & user scenario tests
```

---

## 4. Component Details & UX Specifications

### 4.1 Header & Tab Bar (`page.tsx`)
- Header:
  - Heading: "Settings"
  - Subtext: "Manage Settings"
- Tab Bar:
  - "General" (active) and "Facebook BYOC" preserved exactly as existing.

### 4.2 Single Card: "About this workspace" (`general-settings-view.tsx`)
- Card Container:
  - Surface: `var(--bg-panel, ${THEME.default.surfaces.panel})`
  - Border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
  - Border Radius: `RADII.md` (`8px`)
  - Padding: `SPACING.xl` (`24px`)
  - Max width: generous desktop width (`680px`), responsive `100%` on mobile.
- Card Header:
  - Heading: "About this workspace" (`fontSize: '1rem'`, `fontWeight: TYPOGRAPHY.weights.semibold`)
  - Subtext: "Name your workspace." (`fontSize: '0.8125rem'`, `color: var(--text-sub)`)
- Name Row:
  - Label: "WORKSPACE NAME" (small-caps label style: `fontSize: '0.75rem'`, `fontWeight: TYPOGRAPHY.weights.medium`, `letterSpacing: TYPOGRAPHY.tracking.caption`, `textTransform: 'uppercase'`, `color: var(--text-dim)`)
  - Display View:
    - Current name value (e.g. "shahzebpyc") in clean typography.
    - "Edit" button on the right (secondary/outline button style).
  - Edit View:
    - Inline text input (`input` with `RADII.sm`, `border: 1px solid var(--border-subtle)`, focus ring).
    - "Save" button (primary style: `backgroundColor: PALETTE.primary`, `color: #0b0e11`, `fontWeight: TYPOGRAPHY.weights.semibold`).
    - "Cancel" button (secondary/outline style).
    - Validation error message displayed inline under the input if invalid.
- Helper Line:
  - Text: "Rename it any time — the new name shows up everywhere." (`fontSize: '0.8125rem'`, `color: var(--text-sub)`)
- Toast:
  - Success toast upon saving: "Workspace name updated." (auto-dismisses or allows manual dismissal).
- Mobile Responsiveness:
  - Name row flexes or stacks on narrow viewports (<640px) with name above and Edit button below spanning full width.

---

## 5. Security & Multi-Tenant Isolation

- `PATCH /api/workspaces` requires an authenticated session (`extractSession`).
- Only the workspace owner (`owner_id = session.userId`) can update the workspace name.
- Input validation rejects malicious strings, empty inputs, leading/trailing whitespace, and strings outside the 3–40 length envelope.
