# Implementation Plan: Spec 032 — Dedicated Facebook Pages Management Section

**Branch**: `feat/032-facebook-pages-section` | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)

---

## 1. Summary

Deliver the dedicated **Facebook Pages** section under **Facebook -> Pages** in the workspace sidebar (`/tenant/[subdomain]/pages`), backed by follower growth tracking (`starting_followers`, `current_followers`, and signed `followersGained`), a two-step Account-to-Page **Add Page** modal, clean clickable `PageCard` components with red attention highlighting, soft-delete disconnection semantics, and a dedicated Page route placeholder (`/tenant/[subdomain]/pages/[pageId]`).

---

## 2. Technical Context

- **Frontend (`apps/web`)**: Next.js 16 App Router, React 19, centralized styling tokens from `apps/web/src/lib/theme.ts` (zero ad-hoc hex colors, zero capsule pills, zero changes to `DESIGN.md`).
- **Contracts (`packages/contracts`)**: Zod schemas in `packages/contracts/src/domain/facebook.ts`.
- **Database (`supabase/migrations` & `packages/database`)**: Forward SQL migration `20261011180000_facebook_pages_followers_tracking.sql` and symlink in `packages/database/migrations/0012_facebook_pages_followers_tracking.sql`.
- **Edge Worker (`apps/worker`)**: Update `apps/worker/src/insights-sync.ts` to update `current_followers` on `facebook_pages` while preserving `starting_followers`.

---

## 3. Constitution Check

- **Principle I (SDD & TDD)**: Full specification, data model, contracts, and task breakdown created before code changes.
- **Principle II & III (Modular Isolation & Multi-Tenancy)**: All SQL queries scoped strictly by `user_id`.
- **Principle VIII & IX (Theme Authority & Professional UX Writing)**: Uses `THEME`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY` from `@/lib/theme`; customer-centric copy free of technical jargon.
- **Principle XXV (Spec 032 Governance)**: Complies 100% with sidebar placement, `current_followers` / `starting_followers` tracking, negative `followersGained` display, two-step `AddPageModal`, clickable `PageCard` with red attention standout, and `/pages/[pageId]` placeholder view.

---

## 4. Architecture & File Structure

```text
supabase/migrations/
└── 20261011180000_facebook_pages_followers_tracking.sql

packages/contracts/src/domain/
└── facebook.ts                                    # Add startingFollowers, currentFollowers, followersGained

apps/worker/src/
└── insights-sync.ts                               # Update current_followers on facebook_pages

apps/web/src/
├── components/
│   ├── workspace/
│   │   └── workspace-sidebar.tsx                  # Add Pages sub-item below Accounts under Facebook
│   └── pages/
│       ├── page-card.tsx                          # Clean clickable Page card with followersGained & red attention state
│       ├── pages-empty-state.tsx                  # Empty state for 0 linked pages
│       └── add-page-modal.tsx                     # 2-step modal: Step 1 Select Account -> Step 2 Multi-select Pages
└── app/
    ├── api/tenant/[subdomain]/
    │   ├── accounts/[accountId]/pages/discover/route.ts
    │   └── pages/
    │       ├── route.ts                           # List active pages with startingFollowers, currentFollowers, followersGained
    │       ├── import/route.ts                    # Set starting_followers & current_followers
    │       └── [pageId]/route.ts                  # Soft-delete (status = 'disconnected')
    └── tenant/[subdomain]/pages/
        ├── page.tsx                               # Main Facebook Pages grid, search/filter, AddPageModal
        └── [pageId]/page.tsx                      # Dedicated Page view placeholder
```
