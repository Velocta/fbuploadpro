# Implementation Plan: Authentication & Multi-Tenant Subdomain Routing Isolation

**Branch**: `002-auth-subdomain-routing` | **Date**: 2026-10-07 | **Spec**: [specs/002-auth-subdomain-routing/spec.md](spec.md)

**Input**: Feature specification from `/specs/002-auth-subdomain-routing/spec.md`

## Summary

Implement Next.js Edge Middleware for multi-tenant subdomain host routing (`{subdomain}.domain.com/*` -> `/tenant/[subdomain]/*`), edge-safe HMAC-SHA256 session authentication, tenant ownership verification, Role-Based Access Control (`user`, `seller`, `admin`), and a responsive multi-tenant dashboard shell displaying workspace context and token balance.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode across all packages)

**Primary Dependencies**: Next.js 16 (App Router), React 19, Zod (runtime boundary schemas in `@fbuploadpro/contracts`), Web Crypto API (`crypto.subtle` for edge-safe HMAC-SHA256 token signing/verification)

**Storage**: PostgreSQL (`users`, `facebook_accounts`, `facebook_pages`, `token_transactions`) accessed via `@fbuploadpro/database`

**Testing**: Vitest (`@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/web`)

**Target Platform**: Next.js App Router (Node.js runtime & Edge middleware runtime)

**Project Type**: Web Application & Shared Monorepo Contracts

**Performance Goals**: Subdomain parsing & edge rewrite in <2ms; Server-rendered dashboard shell in <200ms

**Constraints**: Zero Node.js TCP dependencies in Edge middleware; Strict tenant isolation on `subdomain` / `userId`; Zero secret leaks

**Scale/Scope**: Multi-tenant SaaS architecture supporting arbitrary customer subdomains

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Spec-Driven Development (SDD) as Single Source of Truth**: Approved specification at `specs/002-auth-subdomain-routing/spec.md`. TDD approach enforced with test tasks planned before implementation code.
- [x] **Principle II: Modular Architecture & Strict Service Boundary Isolation**: Edge middleware utilizes standard Web Crypto and Web APIs without Node TCP dependencies. Shared schemas and RBAC logic reside strictly in `@fbuploadpro/contracts`. Web app imports contracts and database clients through workspace boundaries.
- [x] **Principle III: Multi-Tenant Defense-in-Depth & Data Isolation**: Tenant ownership is verified on every request. Cross-tenant access is rejected at both the edge middleware and server component layout. Token balances adhere to non-negative invariants.
- [x] **Principle IV: Zero-Trust Boundary Validation & Sanitization**: Session envelopes validated with Zod schemas. Sensitive secrets (session signing keys, database credentials) are never exposed to client responses or logs.
- [x] **Principle V: Atomic PRs & Linear Git Hygiene**: Atomic tasks organized (<150–200 LoC each) delivered on feature branch and PRs referencing issue numbers.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-subdomain-routing/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Architectural decisions & research
├── data-model.md        # Entities, session payload, RBAC matrix
├── quickstart.md        # Validation commands & test scenarios
├── contracts/           # Interface contracts (session, routing, rbac)
└── checklists/          # Requirements & quality checklists
```

### Source Code

```text
packages/contracts/
├── src/
│   ├── domain/
│   │   ├── user.ts          # Existing User schemas & RESERVED_SUBDOMAINS
│   │   ├── session.ts       # SessionPayloadSchema, signSessionToken, verifySessionToken
│   │   ├── routing.ts       # extractSubdomain, getTenantRewriteUrl
│   │   └── rbac.ts          # ROLE_HIERARCHY, hasRole, canAccessTenant
│   └── index.ts             # Export contracts
└── tests/
    ├── session.test.ts      # Web Crypto session token unit tests
    ├── routing.test.ts      # Subdomain extraction unit tests
    └── rbac.test.ts         # Role authorization unit tests

apps/web/
├── src/
│   ├── middleware.ts        # Next.js Edge Middleware (subdomain rewrite + auth guard)
│   ├── lib/
│   │   └── auth.ts          # Web app session helpers (get session from cookies/headers)
│   └── app/
│       ├── layout.tsx       # Root layout
│       ├── page.tsx         # Public marketing home page
│       ├── login/
│       │   └── page.tsx     # Authentication login view
│       └── tenant/
│           └── [subdomain]/
│               ├── layout.tsx # Tenant workspace shell (Header, Subdomain badge, Balance)
│               ├── page.tsx   # Workspace index (redirects to /dashboard)
│               └── dashboard/
│                   └── page.tsx # Workspace dashboard overview
└── tests/
    ├── middleware.test.ts   # Edge middleware routing & auth tests
    └── dashboard.test.ts    # Dashboard shell server component tests
```

## Complexity Tracking

No constitutional violations. Design strictly adheres to modular boundaries and edge isolate constraints.
