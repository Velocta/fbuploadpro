# Specification Quality Checklist: Spec 031 — Cloud Media Downloader

**Purpose**: Validate specification completeness, security, UX craft, and constitutional compliance before implementation  
**Created**: 2026-10-11  
**Feature**: [`spec.md`](../spec.md)

## Content & Requirements Completeness

- [x] No unresolved `[NEEDS CLARIFICATION]` markers remain (all 7 design branches resolved in `/grill-me`)
- [x] Requirements are testable, deterministic, and unambiguous
- [x] All user stories (US1–US5) have clear, verifiable acceptance criteria
- [x] Edge cases identified (empty/invalid URLs, duplicate batch URLs, multi-asset carousels, SSRF private IPs, >500 MB files, missing post captions, auto-provisioning `Downloads` folder)

## Security & Multi-Tenant Isolation

- [x] Session authentication (`fbup_session`) and tenant subdomain isolation (`session.subdomain === subdomain`) enforced on `POST /api/tenant/[subdomain]/media/downloader`
- [x] Target `folderId` verified against `(user_id, id)` in `media_folders` to prevent cross-tenant folder injection
- [x] Strict SSRF guard (`validateSafeRemoteUrl`) blocks non-HTTP(S) schemes, `localhost`, loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), and RFC1918 private network addresses
- [x] Maximum 500 MB per-file size limit and allowed MIME type whitelist enforced before R2 storage ingestion

## UX Writing & Design System Craft

- [x] Zero technical plumbing or developer jargon exposed in UI copy or error messages
- [x] Zero decorative/simulated status dots or capsule pill badges
- [x] Strictly consumes theme tokens from `apps/web/src/lib/theme.ts` and CSS variables (`globals.css`)
- [x] Zero modifications to `DESIGN.md`
