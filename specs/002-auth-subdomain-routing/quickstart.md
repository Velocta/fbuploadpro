# Quickstart: Authentication & Multi-Tenant Subdomain Routing Isolation

This document outlines the validation commands and developer flows to verify Spec 002.

---

## 1. Prerequisites
Ensure database is migrated and dependencies are installed:
```bash
pnpm install
pnpm turbo run build
```

---

## 2. Running Automated Tests

Run the test suite across packages and apps:
```bash
# Test contracts (Session, Subdomain Extraction, RBAC)
pnpm --filter @fbuploadpro/contracts test

# Test web application (Edge Middleware, Subdomain rewrites, RBAC guards, Workspace shell)
pnpm --filter @fbuploadpro/web test

# Run full monorepo CI checks
pnpm turbo run build lint typecheck test
```

---

## 3. End-to-End Validation Scenarios

### Scenario A: Subdomain Edge Rewriting
- Request to `http://localhost:3000` ➔ Serves public marketing homepage (`/`).
- Request with header `Host: client.localhost:3000` to `/` ➔ Next.js Edge Middleware internally rewrites to `/tenant/client`.
- Request with header `Host: api.localhost:3000` ➔ Bypasses tenant rewriting and routes to standard API.

### Scenario B: Session Verification & Tenant Isolation
- Generate a session token for user `client` with role `user`.
- Pass cookie `fbup_session=<token>` to `client.localhost:3000` ➔ Access granted, renders workspace shell.
- Pass the same cookie to `otherclient.localhost:3000` ➔ Access blocked with tenant mismatch.

### Scenario C: Role-Based Access Control
- User with role `user` attempting seller-restricted operation ➔ HTTP 403 Forbidden.
- User with role `seller` or `admin` performing seller-level operation ➔ HTTP 200 Allowed.
- User with role `admin` accessing any tenant workspace ➔ Privileged access granted.

### Scenario D: Workspace Shell
- Accessing authorized workspace displays:
  - Subdomain context (e.g. `client`)
  - User display name and role badge
