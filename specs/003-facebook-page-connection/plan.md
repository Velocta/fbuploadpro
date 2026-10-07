# Implementation Plan: Facebook Graph API OAuth & Multi-Account Social Connection

**Branch**: `spec/003-facebook-page-connection` | **Date**: 2026-10-07 | **Spec**: [specs/003-facebook-page-connection/spec.md](spec.md)

**Input**: Feature specification from `/specs/003-facebook-page-connection/spec.md`

## Summary

Implement Facebook Graph API OAuth 2.0 authorization and multi-account connection for tenant workspaces. Support connecting multiple distinct Facebook accounts per tenant (1:N), secure code exchange for 60-day long-lived tokens, zero-trust token encryption at rest via native Web Crypto API (AES-256-GCM), Graph API `/me/accounts` page discovery, user-driven selective import of Facebook Pages (Pages only, zero groups), granular disconnection, and real-time health monitoring in the workspace UI.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode across all packages)

**Primary Dependencies**: Next.js 16 (App Router), React 19, Zod (runtime boundary schemas in `@fbuploadpro/contracts`), Web Crypto API (`crypto.subtle` for AES-256-GCM token encryption and HMAC-SHA256 OAuth state signing)

**Storage**: PostgreSQL (`facebook_accounts`, `facebook_pages`) with composite foreign key isolation, forward DDL migration `0002_facebook_tokens.sql`

**Testing**: Vitest (`@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/web`)

**Target Platform**: Next.js App Router (Node.js runtime & Edge middleware runtime) and universal Web Crypto environments

**Project Type**: Web Application, Multi-Tenant Database Substrate & Shared Contracts

**Performance Goals**: Token encryption/decryption in <2ms; Graph API discovery in <1.5s; Server-rendered accounts view in <200ms

**Constraints**: Zero Node.js TCP dependencies in Edge runtime; Native Web Crypto API; Strict composite tenant isolation `(user_id, facebook_account_id)`; Zero plaintext token or key leaks; Strictly Facebook Pages only (zero groups)

**Scale/Scope**: Multi-account SaaS architecture supporting multiple connected profiles per tenant and arbitrary imported Facebook Pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Spec-Driven Development (SDD) as Single Source of Truth**: Approved specification at `specs/003-facebook-page-connection/spec.md`. TDD approach enforced with test tasks planned before implementation code.
- [x] **Principle II: Modular Architecture & Strict Service Boundary Isolation**: Zero Node.js TCP socket or stream dependencies in edge runtimes. Universal Web Crypto API (`crypto.subtle`) used for AES-256-GCM encryption. Contracts and validation schemas live strictly in `@fbuploadpro/contracts`. Database migrations and models live in `@fbuploadpro/database`. Web UI and route handlers reside in `apps/web`.
- [x] **Principle III: Multi-Tenant Defense-in-Depth & Data Isolation**: Tenant ownership is verified on all account and page operations. Composite foreign keys `(user_id, facebook_account_id)` and unique constraints `(user_id, fb_account_id)`, `(user_id, fb_page_id)` prevent cross-tenant or duplicate leakage. Disconnection cascades only to target account assets without affecting sibling accounts.
- [x] **Principle IV: Zero-Trust Boundary Validation & Sanitization**: All OAuth parameters, callback inputs, and page import requests are validated with Zod schemas. Sensitive tokens and secrets are encrypted with AES-256-GCM before DB insertion and strictly omitted from all client-facing view models and logs.
- [x] **Principle V: Atomic PRs & Linear Git Hygiene**: All tasks decomposed into atomic increments (<150–200 LoC each) delivered via dedicated PRs referencing GitHub Issues.

## Project Structure

### Documentation (this feature)

```text
specs/003-facebook-page-connection/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Architectural decisions & research
├── data-model.md        # Entities, DDL migration & state machines
├── quickstart.md        # Validation commands & test scenarios
├── contracts/           # Interface contracts
│   ├── oauth.md         # OAuth flow & token exchange schemas
│   ├── accounts.md      # Multi-account listing & disconnect schemas
│   ├── pages.md         # Page discovery & selective import schemas
│   └── crypto.md        # Web Crypto AES-256-GCM encryption interface
└── checklists/          # Requirements & quality checklists
    └── requirements.md  # Quality validation checklist
```

### Source Code

```text
packages/contracts/
├── src/
│   ├── domain/
│   │   ├── facebook.ts   # Updated FacebookAccount & FacebookPage schemas
│   │   ├── oauth.ts      # OAuth state & callback schemas
│   │   └── crypto.ts     # Token encryption interfaces
│   ├── crypto/
│   │   └── token.ts      # Web Crypto AES-256-GCM encrypt/decrypt utilities
│   └── index.ts
└── tests/
    └── crypto.test.ts    # AES-256-GCM unit tests

packages/database/
├── migrations/
│   └── 0002_facebook_tokens.sql # Migration for encrypted tokens & metadata
└── tests/
    └── facebook-tokens.test.ts  # Multi-account & page constraint tests

apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── facebook/
│   │   │   │       ├── route.ts          # Initiate OAuth redirect
│   │   │   │       └── callback/route.ts # OAuth callback & token exchange
│   │   │   └── tenant/[subdomain]/
│   │   │       ├── accounts/
│   │   │       │   ├── route.ts          # List connected accounts
│   │   │       │   └── [accountId]/
│   │   │       │       ├── route.ts      # Disconnect account
│   │   │       │       └── pages/
│   │   │       │           └── discover/route.ts # Discover pages
│   │   │       └── pages/
│   │   │           ├── route.ts          # List imported pages
│   │   │           ├── import/route.ts   # Selectively import pages
│   │   │           └── [pageId]/route.ts # Disconnect page
│   │   └── tenant/[subdomain]/
│   │       └── accounts/
│   │           └── page.tsx              # Multi-account & page management UI
└── tests/
    └── facebook-routes.test.ts           # Integration tests for route handlers
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | All designs adhere strictly to Constitution and existing monorepo boundaries | N/A |
