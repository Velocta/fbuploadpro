# Implementation Plan: Rebuild Workspace Settings Facebook Tab

**Branch**: `rebuild_facebook_settings_tab` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/061-facebook-settings-tab-rebuild/spec.md`

## Summary

Rebuild the Workspace Settings "Facebook" tab (renamed from "Facebook BYOC") to provide a clean, two-state interface aligned with the new design specification. State 1 (Not connected) presents a numbered setup flow with inline validation, connection testing, and a separate "One more step" card for the OAuth callback URL. State 2 (Connected) displays the active App ID, masked App Secret, connection timestamp, and controls for "Edit details" and "Disconnect". The disconnect action triggers a confirmation dialog that removes only the App ID and Secret via a new `DELETE /api/tenant/[subdomain]/settings/byoc` handler while leaving all other tenant data, accounts, and publishing pipelines intact.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 16 (App Router), React 19  
**Primary Dependencies**: `@web/lib/theme`, `@fbuploadpro/contracts`, `@supabase/supabase-js`  
**Storage**: PostgreSQL (`workspace_byoc_credentials` table via Supabase PostgREST)  
**Testing**: Vitest (`apps/web/tests/ui/byoc-settings.test.tsx`, `apps/web/tests/api/byoc-settings-api.test.ts`)  
**Target Platform**: Web application (`apps/web`)  
**Project Type**: Next.js App Router Web Application  
**Performance Goals**: Instant UI state switches (<16ms), client validation (<10ms)  
**Constraints**: Zero ad-hoc colors or borders, zero capsule badges, strict theme tokens from `apps/web/src/lib/theme.ts`, exact verbatim UX copy, no modifications to General tab, auth, or routing  
**Scale/Scope**: 1 UI view rewrite (`byoc-settings-view.tsx`), 1 page tab label update (`settings/page.tsx`), 1 API route method extension (`byoc/route.ts` DELETE handler), unit tests  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Principle 8 (Theme Tokens): All visual attributes use `THEME`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`, or CSS variables.
- [x] Principle 12 (Immutability of `DESIGN.md`): `DESIGN.md` is strictly unmodified.
- [x] Principle 14 (No Mock Theater): Unit tests test real component rendering and exact copy.
- [x] Principle 24 (UX Writing): Verbatim professional UX copy, no tech jargon leaks, zero emojis.
- [x] Principle 26 (Thin Client / Fat Server): Secrets encrypted at rest; never returned in cleartext.

## Project Structure

### Documentation (this feature)

```text
specs/061-facebook-settings-tab-rebuild/
├── plan.md              # This file
├── research.md          # Technical analysis & design decisions
├── data-model.md        # Database and API payload schemas
├── quickstart.md        # Manual and automated verification guide
├── contracts/           # API contract definitions
│   └── facebook-settings-contracts.md
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Sequenced atomic tasks
```

### Source Code Impact

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── api/tenant/[subdomain]/settings/byoc/route.ts  # Add DELETE handler & connectedAt in GET
│   │   └── tenant/[subdomain]/settings/page.tsx           # Rename tab label to "Facebook"
│   └── components/
│       └── settings/
│           └── byoc-settings-view.tsx                     # Complete rewrite to match design specs
└── tests/
    ├── api/
    │   └── byoc-settings-api.test.ts                      # Tests for GET, PUT, and DELETE endpoints
    └── ui/
        └── byoc-settings.test.tsx                         # UI tests for State 1, State 2, and Disconnect dialog
```
