# Architecture Blueprint & Technical Plan: Supabase Authentication Flow (Spec 009)

**Branch**: `feat/login-signup-flow` | **Target**: `main`

---

## 1. Executive Summary & Architectural Overview

Spec 009 implements production-grade authentication for FBUploadPro, encompassing:
1. **Tenant Registration (`/signup`)**:
   - Collects Full Name, Phone, Email, Password.
   - Automatically derives tenant subdomain slug in real-time by stripping dots (`.`) and subaddress plus tags (`+tag`) from email.
   - Enforces unique slug allocation, guarding reserved system subdomains (`app`, `api`, `admin`, etc.).
   - Registers user in Supabase Auth and mirrors profile into PostgreSQL `users` table with `role = 'user'`, `status = 'active'`.
   - Initializes default media storage quota (5GB / 50 assets in `storage_quotas`).
   - Issues cryptographically signed root-domain session cookie (`fbup_session`).
   - Immediately redirects to `{subdomain}.fbuploadpro.com/dashboard`.
2. **Tenant Sign-In (`/login`)**:
   - Authenticates credentials via Supabase Auth (`signInWithPassword`).
   - Verifies user status (`active` vs `suspended`).
   - Issues root-domain session cookie.
   - Redirects to `{subdomain}.fbuploadpro.com/dashboard` or preserved `returnUrl`.
3. **Session Invalidation (`/api/auth/logout`)**:
   - Calls Supabase `signOut()`.
   - Expires root-domain session cookie across `.fbuploadpro.com`.
   - Redirects to `app.fbuploadpro.com/login`.
4. **Dual-Theme High-Craft UI**:
   - Fully constructed using the Spec 008 UI component library (`Card`, `Input`, `Button`, `Alert`, `StatusDot`).
   - Strict Binance Precision Dual-Theme styling via `apps/web/src/lib/theme.ts`.

---

## 2. System Architecture & Route Topology

```mermaid
flowchart TD
    subgraph Browser ["Client Browser"]
        SignUpView["/signup Page (Spec 008 Primitives)"]
        LoginView["/login Page (Spec 008 Primitives)"]
        DerivedBadge["Live Subdomain Preview\n({subdomain}.fbuploadpro.com)"]
        SignUpView -->|Input Email| DerivedBadge
    end

    subgraph APIRoutes ["apps/web/src/app/api/auth/"]
        SignUpAPI["POST /api/auth/signup"]
        LoginAPI["POST /api/auth/login"]
        LogoutAPI["POST /api/auth/logout"]
        MeAPI["GET /api/auth/me"]
    end

    subgraph CoreServices ["Application Control Plane"]
        SubdomainDeriver["Subdomain Derivation & Slug Sanitizer"]
        SupabaseClient["Supabase Auth Service Client"]
        SessionIssuer["signSessionToken & Root Cookie Manager"]
        DBClient["PostgreSQL DB Client (@fbuploadpro/database)"]
    end

    subgraph StorageLayer ["PostgreSQL Database"]
        UsersTable[("public.users")]
        QuotasTable[("public.storage_quotas")]
    end

    SignUpView -->|Submit Form| SignUpAPI
    LoginView -->|Submit Form| LoginAPI

    SignUpAPI --> SubdomainDeriver
    SignUpAPI --> SupabaseClient
    SignUpAPI --> DBClient
    DBClient --> UsersTable
    DBClient --> QuotasTable

    LoginAPI --> SupabaseClient
    LoginAPI --> DBClient
    DBClient --> UsersTable

    SignUpAPI --> SessionIssuer
    LoginAPI --> SessionIssuer
    LogoutAPI --> SessionIssuer

    SessionIssuer -->|Set fbup_session Cookie (Domain=.fbuploadpro.com)| Browser
```

---

## 3. Subdomain Derivation Algorithm

```typescript
export function deriveSubdomainFromEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  const usernamePart = email.split('@')[0]!;
  
  // 1. Strip plus subaddress tags: 'user+tag' -> 'user'
  const withoutPlusTag = usernamePart.split('+')[0]!;
  
  // 2. Strip all dots: 'john.doe' -> 'johndoe'
  const withoutDots = withoutPlusTag.replace(/\./g, '');
  
  // 3. Lowercase and replace non-alphanumeric characters with hyphens
  let slug = withoutDots
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
    
  // 4. Bound length between 3 and 50 characters
  if (slug.length < 3) {
    slug = (slug + 'workspace').slice(0, 50);
  } else if (slug.length > 50) {
    slug = slug.slice(0, 50);
  }
  
  return slug;
}
```

---

## 4. Multi-Tenant Cookie Scoping Strategy

| Environment | Cookie Name | Domain Scope | SameSite | Secure | HttpOnly |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Production** | `fbup_session` | `.fbuploadpro.com` | `Lax` | `true` | `true` |
| **Development** | `fbup_session` | Omitted (host-only) / `localhost` | `Lax` | `false` | `true` |

When a session is created on `app.fbuploadpro.com`, the cookie scoped to `.fbuploadpro.com` is automatically sent with subsequent HTTP requests to `{subdomain}.fbuploadpro.com`, allowing Next.js edge middleware (`apps/web/src/middleware.ts`) to verify `fbup_session` immediately without redirect loops.

---

## 5. Security & Error Boundary Protocols

1. **Credential Sanitization**: Passwords and tokens are never logged.
2. **Brute Force Protection**: Failed attempts trigger rate limit notifications.
3. **Account Suspension Isolation**: If `user.status === 'suspended'`, login returns 403 Forbidden and routes to `/account-suspended`.
4. **Collision Resolution**: If a derived subdomain is already taken, an auto-incrementing integer is appended (e.g., `johndoe1`).
