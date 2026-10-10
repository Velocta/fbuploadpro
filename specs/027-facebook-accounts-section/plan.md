# Implementation Plan: Spec 027 — Dedicated Facebook Accounts Management Section & Dual-Mode Connection Flow

**Branch**: `feat/027-facebook-accounts-section` | **Date**: 2026-10-10 | **Spec**: [specs/027-facebook-accounts-section/spec.md](spec.md)

---

## 1. Summary

Implement the dedicated frontend Facebook Accounts management section at `/tenant/[subdomain]/accounts`, dual-mode account connection modal (Direct Connection & Magic Link for cross-browser sessions), standalone remote connection success page, and safety disconnect dialog.

---

## 2. Technical Context

- **Platform**: Next.js 16 (App Router), React 19, TypeScript strict mode
- **Theme & Styles**: `apps/web/src/lib/theme.ts` (`THEME`, `PALETTE`, `SPACING`, `RADII`, `TYPOGRAPHY`), CSS variables (`--bg-panel`, `--text-main`, `--border-subtle`). NEVER touch `DESIGN.md`.
- **Backend APIs**:
  - `GET /api/tenant/[subdomain]/accounts`: Existing endpoint returning `accounts` array with `displayName`, `profilePictureUrl`, `gender`, `accountLink`, `status`, `tokenExpiresAt`, `connectedPagesCount`, `createdAt`.
  - `DELETE /api/tenant/[subdomain]/accounts/[accountId]`: Existing endpoint cascading to pages.
  - `POST /api/tenant/[subdomain]/accounts/magic-link`: NEW endpoint generating 15-minute cryptographically signed token.
  - `GET /connect/facebook`: NEW public forwarder verifying token and redirecting to Facebook OAuth dialog with `isMagic: true` in state.
  - `GET /api/auth/facebook/callback`: Extend to redirect to `/connect/facebook/success` when `isMagic: true`.
  - `GET /connect/facebook/success`: NEW standalone public success view.
- **Testing**: Vitest (`apps/web/tests/ui/accounts.test.tsx`, `apps/web/tests/api/magic-link.test.ts`).

---

## 3. Constitution & Quality Gates Check

- [x] **Principle 19 / 20: Dual-Mode Connection Architecture & Minimalist Account Health UI**.
- [x] **Theme Standards**: Strict import from `@/lib/theme`, zero ad-hoc hex colors, zero capsule pills.
- [x] **UX Writing Standards**: Clean, human SaaS copy, zero technical plumbing leaks.
- [x] **Single Combined PR Protocol**: Code and docs committed together.
- [x] **Mandatory Human Approval Gate Before Merging**.

---

## 4. Architectural Components

```text
apps/web/src/
├── app/
│   ├── api/
│   │   ├── auth/facebook/callback/route.ts       # Updated to handle isMagic flag
│   │   └── tenant/[subdomain]/accounts/magic-link/route.ts # NEW magic link endpoint
│   ├── connect/
│   │   └── facebook/
│   │       ├── route.ts                          # NEW magic link forwarder to FB OAuth
│   │       └── success/page.tsx                  # NEW standalone remote success view
│   └── tenant/[subdomain]/accounts/
│       └── page.tsx                              # NEW main Facebook Accounts view
└── components/
    └── accounts/
        ├── account-card.tsx                      # Clean minimalist account card
        ├── connect-account-modal.tsx             # Dual-mode modal (Direct + Magic Link)
        ├── disconnect-account-dialog.tsx         # Safety confirmation modal
        └── accounts-empty-state.tsx              # Clean empty state card
```
