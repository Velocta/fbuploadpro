# Research: Authentication & Multi-Tenant Subdomain Routing Isolation

This document details the architectural decisions, trade-offs, and design rationale for Spec 002: Authentication & Multi-Tenant Subdomain Routing Isolation in FBUploadPro.

---

## 1. Edge Middleware & Subdomain Path Rewriting Architecture

### Decision
Implement Next.js edge middleware (`apps/web/src/middleware.ts`) utilizing the Web Standard `Request` and `NextResponse` APIs:
- Inspect the incoming HTTP `host` header.
- Strip port numbers (e.g., `client.localhost:3000` -> `client.localhost`).
- Differentiate root/apex domain (e.g., `fbuploadpro.com`, `localhost`, `www.fbuploadpro.com`) from tenant subdomains (e.g., `acme.fbuploadpro.com`, `acme.localhost`).
- Filter out reserved system subdomains (`api`, `app`, `admin`, `www`, `billing`, etc.) and system path prefixes (`/_next/*`, `/api/*`, `/favicon.ico`, `/static/*`).
- For valid tenant subdomains, perform internal path rewriting to `/tenant/[subdomain]/*` using `NextResponse.rewrite(new URL(`/tenant/${subdomain}${pathname}`, request.url))`.
- Inject custom request headers (`x-tenant-subdomain: subdomain`, `x-pathname: pathname`) into downstream Server Components.

### Rationale
- **Clean URLs for Users**: Internal rewriting preserves the exact browser URL (`https://acme.fbuploadpro.com/dashboard`) without unsightly path prefixes in the browser address bar.
- **Edge Performance**: Next.js Edge Middleware executes before route rendering, resolving hostnames and performing rewrites in <2ms at the edge.
- **Zero Configuration Drift**: Subdomain routing logic is centralized in a single edge filter rather than scattered across individual route handlers.

### Alternatives Considered
- **Client-side Redirects**: Causes a visible URL change, additional network roundtrips, and poor UX.
- **Nginx/Reverse Proxy Rewrites**: Adds external infrastructure complexity and duplicates routing rules outside the TypeScript codebase.
- **Query Parameter Mapping (`?tenant=slug`)**: Unprofessional URL aesthetics and breaks browser cookie isolation scoping.

---

## 2. Session Authentication & Edge-Compatible Web Cryptography

### Decision
Implement lightweight, edge-safe HMAC-SHA256 session token generation and verification using the standard **Web Crypto API (`crypto.subtle`)** in `@fbuploadpro/contracts`:
- Session envelope payload:
  ```typescript
  export interface SessionPayload {
    userId: string;
    email: string;
    name?: string | null;
    subdomain: string;
    role: 'user' | 'seller' | 'admin';
    status: 'active' | 'suspended';
    iat: number; // Issued at (Unix timestamp in seconds)
    exp: number; // Expiration timestamp in seconds
  }
  ```
- Store signed tokens in secure, HTTP-only cookies (`fbup_session`) with `SameSite=Lax`, `Path=/`, and `Secure` (in production).
- Fallback support for `Authorization: Bearer <token>` for API and programmatic clients.
- Provide edge-safe sign and verify utilities: `signSessionToken(payload, secret)` and `verifySessionToken(token, secret)`.

### Rationale
- **Universal V8 Isolate & Edge Compatibility**: Native Web Crypto (`crypto.subtle`) is built into all modern JavaScript environments (V8 Isolates, Cloudflare Workers, Next.js Edge Runtime, Node.js 18+). It requires zero external binary dependencies and zero native Node TCP or OpenSSL bindings.
- **Stateless Edge Verification**: The edge middleware can verify the session signature and extract user role, status, and tenant subdomain in sub-millisecond time without querying the database on every asset or sub-page request.
- **Defense Against Tampering**: Any tampering with the payload invalidates the HMAC signature.

### Alternatives Considered
- **`jsonwebtoken` (npm package)**: Depends on Node.js native `crypto` module streams, causing runtime compilation failures on V8 edge workers and Next.js edge runtime.
- **Server-Side Session Store in Redis**: Adds an external network hop and failure point to every edge request; unnecessary given signed stateless claims.

---

## 3. Multi-Tenant Ownership Guard & Cross-Tenant Defense-in-Depth

### Decision
Enforce strict multi-tenant boundary checks in both edge middleware and server layouts:
1. **Edge Middleware Guard**:
   - When a request targets a protected tenant route (`/tenant/[subdomain]/dashboard`, etc.):
   - If no valid session exists, redirect to `/login?returnUrl=...`.
   - If `session.status === 'suspended'`, block access and redirect to `/account-suspended`.
   - If `session.subdomain !== targetSubdomain`:
     - If `session.role === 'admin'`: allow access (platform superuser cross-tenant inspection).
     - If `session.role !== 'admin'`: deny cross-tenant access and redirect to the user's authorized workspace (`https://${session.subdomain}.${rootDomain}/dashboard`).
2. **Server Layout Guard (`/tenant/[subdomain]/layout.tsx`)**:
   - Double-check session validity and verify tenant existence in PostgreSQL via `@fbuploadpro/database`.
   - If tenant subdomain does not exist in the database, return clean 404 (Tenant Not Found).

### Rationale
- **Zero-Trust Multi-Tenancy**: Even if an attacker manipulates client routing or host headers, cross-tenant access is physically impossible because session claims are cryptographically signed and verified.
- **Principle III Constitution Compliance**: Multi-tenant defense-in-depth is enforced at the routing boundary and the server component boundary.

### Alternatives Considered
- **Client-Side Authorization Check**: Rejected because client-side checks can be bypassed by modifying frontend state; security must be enforced on the server/edge.

---

## 4. Role-Based Access Control (RBAC) Matrix

### Decision
Define a formal Role-Based Access Control matrix for the three constitutional roles:
- **`user`**: Standard operational tenant. Can view their own workspace dashboard, manage connected Facebook accounts/pages, view ledger transactions, and trigger automation tasks.
- **`seller`**: Includes all `user` capabilities plus access to seller-tier features (e.g. template publishing, client campaign management).
- **`admin`**: Platform superuser. Can access all tenant workspaces, access global `/admin` routes, inspect system health, and adjust token balances.

Implement helper utilities in `@fbuploadpro/contracts`:
- `hasRole(userRole, requiredRole): boolean`
- `canAccessTenant(session, targetSubdomain): boolean`
- `isRoleAuthorized(userRole, allowedRoles[]): boolean`

### Rationale
- **Hierarchical Privilege Model**: Simple, deterministic privilege hierarchy (`admin > seller > user`) prevents role confusion and privilege escalation.
- **Centralized Contract**: Putting RBAC logic into `@fbuploadpro/contracts` ensures consistent evaluation between Edge Middleware, Next.js Server Components, and Background Worker pipelines.

---

## 5. Multi-Tenant Workspace Dashboard Shell

### Decision
Create a Next.js 16 App Router workspace shell:
- Route hierarchy:
  - `apps/web/src/app/tenant/[subdomain]/layout.tsx` (Shared Workspace Shell: Header, Subdomain Badge, Token Balance, Nav)
  - `apps/web/src/app/tenant/[subdomain]/page.tsx` (Workspace Root / Dashboard redirect)
  - `apps/web/src/app/tenant/[subdomain]/dashboard/page.tsx` (Main Dashboard view)
- Dynamic server data loading:
  - Fetches user details and current `tokens_balance` from PostgreSQL using `@fbuploadpro/database`.
  - Displays token balance as a badge with formatted integer.
  - Displays role badge (`USER`, `SELLER`, `ADMIN`).
- React 19 standards: Pure Server Components for initial render, zero `set-state-in-effect`, zero sensitive secret exposure.

### Rationale
- **Optimal Web Vitals (CWV)**: Server-side rendering renders the initial dashboard shell immediately with no client-side loading flashes.
- **Sanitized Data Boundary**: Only safe user fields (`subdomain`, `name`, `email`, `role`, `tokens_balance`) are passed to the UI layer; database credentials and internal ids remain private.
