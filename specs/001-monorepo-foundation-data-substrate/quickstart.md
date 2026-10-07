# Quickstart Validation Guide: Core Monorepo Foundation & Data Substrate

This guide details the step-by-step verification commands to validate the monorepo foundation, domain contracts, database substrate, webapp health probe, and edge worker shell.

---

## Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL database instance (local or Supabase)

---

## 1. Setup & Installation

Install dependencies across the monorepo workspace:
```bash
pnpm install
```

---

## 2. Workspace Validation Commands

### 2.1 Domain Contracts Validation
Verify that Zod schemas, subdomain blocklists, and domain error status mappings compile and pass all tests:
```bash
pnpm --filter @fbuploadpro/contracts typecheck
pnpm --filter @fbuploadpro/contracts lint
pnpm --filter @fbuploadpro/contracts test
```
**Expected Outcome**: 100% test pass; invalid subdomains rejected; balance invariants enforced.

### 2.2 Database Substrate & Dual Client Validation
Verify that migration DDL contains all required composite FKs and balance check constraints, and test dual client operations:
```bash
pnpm --filter @fbuploadpro/database typecheck
pnpm --filter @fbuploadpro/database lint
pnpm --filter @fbuploadpro/database test
```
**Expected Outcome**: 100% test pass; DDL validated; atomic token deduction succeeds under sufficient balance and throws `InsufficientFundsError` under overdraft.

### 2.3 Web Application & Health Probe Route
Verify Next.js 16 app router shell and sanitized `/api/health` endpoint:
```bash
pnpm --filter @fbuploadpro/web typecheck
pnpm --filter @fbuploadpro/web lint
pnpm --filter @fbuploadpro/web test
```
**Expected Outcome**: 100% test pass; HTTP 200 on healthy DB; HTTP 503 on drop/timeout; zero leaked credentials.

### 2.4 Cloudflare Worker Shell
Verify edge worker handler and isolate packaging:
```bash
pnpm --filter @fbuploadpro/worker typecheck
pnpm --filter @fbuploadpro/worker lint
pnpm --filter @fbuploadpro/worker test
```
**Expected Outcome**: 100% test pass; GET `/health` returns `{ status: "ok", worker: "fbuploadpro-worker" }`; unhandled routes return 404.

---

## 3. End-to-End Monorepo Quality Gate Simulation

Simulate full GitHub Actions CI pipeline locally across all packages and apps:
```bash
pnpm turbo run build lint typecheck test
```
**Expected Outcome**: 0 linter errors, 0 type errors, 100% tests passing across all packages.
