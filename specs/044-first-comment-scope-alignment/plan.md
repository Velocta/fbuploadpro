# Implementation Plan: First Comment Scope Alignment (pages_manage_engagement)

**Branch**: `feat/044-first-comment-scope-alignment` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/044-first-comment-scope-alignment/spec.md`

## Summary

Add the `pages_manage_engagement` permission scope to Meta Graph API v26.0 OAuth authorization dialog URLs (both standard web login and 15-minute magic link connect) and update the BYOC settings permissions checklist. This provides the necessary authorization for the Cloudflare Worker dispatch engine to publish automated first comments via `POST /{post-id}/comments` without `(#200) OAuthException` failures.

## Technical Context

**Language/Version**: TypeScript / Node.js 22 / Next.js 16 (App Router)  
**Primary Dependencies**: Next.js 16, React 19, `@fbuploadpro/contracts`, Cloudflare Workers (`apps/worker`)  
**Storage**: Remote Supabase PostgreSQL (no schema changes needed)  
**Testing**: Vitest (`apps/web/tests/api/auth-facebook.test.ts`)  
**Target Platform**: Vercel Serverless (Next.js 16 App Router) and Cloudflare Workers Edge Runtime  
**Project Type**: Monorepo Web Application (`apps/web`) and Edge Worker (`apps/worker`)  
**Performance Goals**: Instant OAuth redirect generation (< 50ms)  
**Constraints**: Zero ad-hoc style declarations (strict theme tokens in `byoc-settings-view.tsx`), absolute immutability of `DESIGN.md`  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle 1 (Spec-Driven Development)**: Comprehensive spec, plan, and research artifacts maintained in `specs/044-first-comment-scope-alignment/`.
- [x] **Principle 2 (Strict Theme Token Authority)**: Any UI updates in `byoc-settings-view.tsx` reference `apps/web/src/lib/theme.ts`.
- [x] **Principle 3 (Immutability of DESIGN.md)**: No changes to `DESIGN.md`.
- [x] **Principle 4 (Single Combined PR Protocol)**: Documentation updates in `docs/` committed in the exact same PR.
- [x] **Principle 5 (No Local Build Checks)**: Build/lint verification offloaded to remote GitHub Actions CI.

## Project Structure

### Documentation (this feature)

```text
specs/044-first-comment-scope-alignment/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code

```text
apps/web/src/
├── app/api/auth/facebook/route.ts       # Standard OAuth initiation
├── app/connect/facebook/route.ts        # 15-minute magic link connect flow
└── components/settings/byoc-settings-view.tsx # BYOC Required Meta App Permissions badge checklist

apps/web/tests/
└── api/auth-facebook.test.ts            # Unit tests validating OAuth scope parameters

docs/
└── foundational-knowledge.md            # Synchronized architecture documentation
```

## Structure Decision

Targeting `apps/web` for OAuth URL construction and settings view, plus tests and documentation.
