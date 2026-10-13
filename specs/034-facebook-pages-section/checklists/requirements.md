# Specification Quality Checklist: Dedicated Facebook Pages Management Section (Spec 032)

**Purpose**: Validate specification completeness, UX craft, and multi-tenant security before implementation  
**Created**: 2026-10-11  
**Feature**: [spec.md](../spec.md)

## Content Quality & UX Craft

- [x] No implementation plumbing leaked into user-facing copy requirements
- [x] Strictly adheres to `apps/web/src/lib/theme.ts` and immutable `DESIGN.md`
- [x] Card layout specifies exact fields: Page avatar, Page name, category, current followers, followers gained (including negative values), parent Facebook account name, and status with red attention highlighting
- [x] Management actions are deferred to the dedicated Page view (`/tenant/[subdomain]/pages/[pageId]`) opened when clicking a card

## Requirement Completeness

- [x] Database migration requirements defined for renaming `followers_count` to `current_followers` and adding `starting_followers`
- [x] Two-step "Add Page" modal flow (Step 1: Select Facebook Account -> Step 2: Multi-select discovered Pages with "Select All" and "Already added") is unambiguously specified
- [x] Soft-delete semantics (`status = 'disconnected'`, token wipe, queue cancellation) are specified for `DELETE /api/tenant/[subdomain]/pages/[pageId]`
- [x] Multi-tenant compound isolation (`user_id`) enforced across all queries and mutations
