<!--
Sync Impact Report:
- Version change: 2.6.0 -> 2.7.0 (MINOR: Amended Section 12 to govern 6-digit OTP-based password recovery, removing email magic recovery links)
- List of modified principles:
  - Technology & Architectural Constraints: Amended Section 12 to replace email magic links with unified 6-digit OTP password recovery dispatched via Resend, enforcing 10-minute TTL, 60-second cooldown, timing-safe verification, and 5-attempt progressive lockout.
- Added/Modified sections:
  - Section 12: Defense-in-Depth Authentication Redirects, 6-Digit OTP Password Reset Lifecycle, and Credential Memory Zero-Retention.
- Follow-up TODOs: Implement Spec 018 for unified OTP password reset flow.
-->

# FBUploadPro Constitution

## Core Principles

### I. Spec-Driven Development (SDD) as Single Source of Truth
No application code, database migrations, or infrastructure configurations may be written or modified without an approved specification under `specs/`. Every implementation change must link directly to an approved specification requirement and a decomposed GitHub task issue. Test-Driven Development (TDD) is non-negotiable: tests asserting functional acceptance criteria must be written and approved before implementation code is finalized.

### II. Modular Architecture & Strict Service Boundary Isolation
The system enforces strict architectural decoupling between the edge execution layer (Cloudflare Workers), application control plane (Next.js 16 Webapp), and asynchronous ingestion pipelines (VPS Scraper/Downloaders). Edge workers must run in standard V8 isolate environments with zero Node.js TCP socket dependencies, using `@fbuploadpro/database/edge`. Web applications and background services must never cross-import code; all shared data contracts, validation schemas, and error definitions must reside strictly within `@fbuploadpro/contracts`.

### III. Multi-Tenant Defense-in-Depth & Data Isolation
Tenant boundaries (`user_id`) are immutable and mandatory across all domain models. There are no agency containers in the platform: the platform architecture is centered strictly on individual **Users** (`user_id`), with **Sellers** and **Admins** operating under dedicated role-based boundaries. Database schemas must enforce multi-tenant isolation through composite foreign keys (e.g. `(user_id, facebook_account_id)`, `(user_id, folder_id)`) and compound unique constraints (e.g. `(user_id, fb_page_id)`) to eliminate any risk of cross-tenant data leakage. Publishing entitlement is unrestricted for all active users (`status = 'active'`) with connected Facebook Pages. All legacy prepaid token ledger, balance constraints, and token debit mechanisms are formally abolished and purged from the platform data model.

### IV. Zero-Trust Boundary Validation & Sanitization
All data crossing public API routes, webhook endpoints, and worker fetch handlers must be validated at runtime against strict Zod schemas. Sensitive secrets, tokens, connection strings, and database credentials must never be emitted in logs or client-facing responses. Diagnostic endpoints such as `/api/health` must enforce strict execution timeout budgets (e.g., 2000ms AbortController) and return sanitized status envelopes without exposing internal infrastructure topology.

### V. Atomic PRs & Linear Git Hygiene
Direct commits to `main` are strictly forbidden. All modifications must be delivered via dedicated feature branches and Pull Requests referencing their associated GitHub Issue (`Closes #X`). Net pull request diffs must remain small and focused (strictly under 150–200 lines of code). Every pull request must include verifiable test execution output and maintain zero linter warnings and zero type errors.

## Technology & Architectural Constraints

1. **Package Management & Tooling**: `pnpm` workspaces configured with Turborepo (`turbo.json`) for pipeline orchestration and task caching.
2. **TypeScript Standards**: TypeScript in strict mode across all packages and applications (`"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`). No unchecked type coercions (`any`).
3. **Database & Authentication (Supabase)**: PostgreSQL substrate powered by Supabase with forward SQL migrations maintained under `/supabase/migrations/` using the Supabase GitHub Integration standard (`YYYYMMDDHHmmss_<name>.sql`), connection pooling (PgBouncer/transaction pooler for edge runtimes, direct port 5432 for schema DDL), and Supabase Auth integration. Supabase branching is disabled (paid tier feature); the architecture operates strictly against the single primary database instance, with migrations deployed automatically upon merge to `main`. Agents and tools are strictly prohibited from executing migrations via Supabase MCP (`apply_migration`, `execute_sql`); migrations deploy exclusively through Git merges to `main`.
4. **Web Application Hosting (Vercel)**: Next.js 16 App Router using React 19 standards hosted on Vercel, adhering strictly to event-driven state transitions (prohibiting `react-hooks/set-state-in-effect`).
5. **Edge Execution & Media Storage (Cloudflare)**:
   - **Workers**: Cloudflare Workers edge runtime (`apps/worker`) executing high-throughput scheduling and Facebook publishing dispatchers.
   - **R2 Storage**: Cloudflare R2 object storage for short-form video/image storage and presigned direct browser-to-bucket ingestion.
6. **Domain Separation & Gateway Routing**:
   - **Marketing Apex Domain (`fbuploadpro.com` / `www.fbuploadpro.com`)**: Strictly decoupled from the SaaS application; dedicated to marketing landing pages, Terms of Service (`/terms`), and Privacy Policy (`/privacy`), deployed and operated independently.
   - **Application Central Gateway (`app.fbuploadpro.com` / `app.vinsmokemedia.online`)**: Hosts the primary authentication portal, providing `/login` and `/signup`.
   - **Tenant Workspaces (`{username}.fbuploadpro.com` / `{username}.vinsmokemedia.online`)**: Serves authenticated user workspaces, with session cookies scoped to root domain wildcard (`.fbuploadpro.com` / `.vinsmokemedia.online`) to enable seamless transitions from the gateway into private subdomains.
   - **Active Construction Demo Domain**: `vinsmokemedia.online` is active as the operational deployment and demo domain (`app.vinsmokemedia.online` gateway, `*.vinsmokemedia.online` tenant subdomains, `.vinsmokemedia.online` session cookies) until final production cutover.
7. **Publishing & External APIs**: Facebook Graph API v26.0 for reels, photos, and automated first-comment publishing; Cloudflare R2 for media storage. Publishing is unrestricted for all active users (`status = 'active'`) with connected Facebook Pages, with zero token ledger or credit balance checks. All billing and monetization systems are deferred.
8. **Theme Token & Design System Governance (`apps/web/src/lib/theme.ts`)**: All visual interface design, colors, hairlines, spacing, radii, typography, and shadows across `apps/web` are governed strictly by the canonical theme configuration in `apps/web/src/lib/theme.ts` and `apps/web/src/app/globals.css`, which reflect the immutable specification in `DESIGN.md`. Agents must NEVER modify or edit `DESIGN.md` (permanently frozen). Hardcoding ad-hoc hex color literals, arbitrary border definitions, custom shadows, or capsule pill badges in components is permanently prohibited; all frontend code must consume tokens directly from `@web/lib/theme` or CSS variables. Status signaling must strictly use unboxed 6px luminous dots with micro-halos (`STATUS_SIGNALS`).
9. **Universal Professional UX Writing & Interface Tone Governance**: FBUploadPro is a commercial SaaS application; all user-visible copy across the entire platform (pages, layouts, headers, modals, forms, helper text, error alerts, empty states, and buttons) must be professional, conversational, clear, concise, and human. Agents and engineers must NEVER expose backend plumbing, data models, validation internals, regex/sanitization logic, system architecture, or DevOps/infrastructure jargon on any public screens. Decorative, mock, or simulated "operational / system status" signals (such as "Online", "Ready", "Operational", or static status dots) on pages, cards, headers, forms, or general UI components are strictly prohibited; status signals are reserved exclusively for authentic, live entity runtime state (e.g., connected Facebook page health, queue job execution status). All copy must be framed strictly around user intent, benefits, and straightforward actions.
10. **Strict Gmail Canonicalization, International E.164 Phone Validation, and Hardened OTP Security**:
    - **Strict Gmail-Only & Email Canonicalization**: FBUploadPro strictly requires `@gmail.com` or `@googlemail.com` email domains for customer registration and authentication. All email addresses must be canonicalized before lookup, validation, or persistence: trim whitespace, lowercase, extract username, strip all dots (`.`), remove plus tags (`+tag` and everything up to `@`), and recombine as `<normalized_username>@gmail.com`. Canonicalization must be enforced on client input, API contract layer (`@fbuploadpro/contracts`), and at the PostgreSQL database substrate with a unique index on normalized emails (`normalized_email`).
    - **International E.164 Phone Validation**: Phone numbers must strictly comply with international E.164 standard formatting (e.g. `+923001234567`). Formatting, country codes, and numeric lengths must be validated using `libphonenumber-js`. Raw, unvalidated strings or non-numeric characters (aside from leading `+`) are prohibited.
    - **Supabase + Resend OTP Security**: Verification OTPs must be cryptographically secure 6-digit numeric codes with 5–10 minute expiration, single-use invalidation upon verification, and timing-safe comparison. Rate limiting per IP and per identifier (email/phone) is mandatory across OTP dispatch routes to prevent Resend credit exhaustion and SMS/email spam bombing. Verification endpoints must enforce progressive backoff and temporary lockout after 3–5 failed attempts. Cleartext passwords must never linger in unhashed memory.
11. **Inline Form Validation, Non-Intrusive Error States, and Edge-Case Input Hygiene**:
    - **Field-Level Inline Validation & Error Highlighting**: Form validation errors targeting specific input fields MUST be surfaced directly inline under the relevant input field using red border highlighting (`border: 1px solid var(--accent-3)`, `aria-invalid="true"`) and contextual helper text (`role="alert"`).
    - **Prohibition of Disruptive Modal/Alert Boxes for Field Errors**: AI agents and frontend components must NEVER display large modal-like alert banners or popups at the top of cards for normal field validation issues (such as missing names, malformed phone numbers, or invalid email formats). General non-field errors (e.g. invalid credentials, system timeouts, rate limits) must appear as compact, non-disruptive inline callouts positioned directly above the primary action button to prevent jarring layout shifts.
    - **Hybrid Real-Time Validation UX**: Form validation errors must trigger upon form submission attempt and automatically clear and revalidate live as the user corrects their input (on keystroke/change or blur).
    - **Comprehensive Server-to-Client Error Mapping**: When backend Zod validation fails (`400 Bad Request` with `{ error: 'Validation failed', details: ... }`), the frontend MUST unpack and map the `details` field-by-field directly to their corresponding input elements. Never expose raw generic "Validation failed" banners to users.
    - **Elimination of Password Strength Meters**: Unnecessary or noisy password strength meters that add visual clutter must not be rendered on authentication forms; password requirements (e.g. minimum 8 characters) must be conveyed cleanly via static helper text and inline validation.
    - **Client-Side E.164 Phone Validation via `libphonenumber-js`**: Phone input fields must validate international calling codes and numeric length directly on the client using `libphonenumber-js` to provide immediate, specific feedback before submission.

12. **Defense-in-Depth Authentication Redirects, 6-Digit OTP Password Reset Lifecycle, and Credential Memory Zero-Retention**:
    - **Open Redirect Elimination**: Post-authentication and post-registration redirects via `returnUrl` MUST strictly be relative paths (`returnUrl.startsWith('/') && !returnUrl.startsWith('//')`) or strictly verified authorized tenant domains (`new URL(returnUrl).hostname === \`${subdomain}.${rootDomain}\``). Loose substring checks (such as `includes(user.subdomain)`) are permanently forbidden.
    - **Unified 6-Digit OTP Password Reset**: Password recovery MUST operate via a cryptographically generated 6-digit numeric OTP (`100000`–`999999`) dispatched to the user's canonical Gmail address via Resend. Magic recovery links in emails are permanently removed. Password recovery OTPs enforce a 10-minute expiration, 60-second resend cooldown, timing-safe constant-time verification (`crypto.timingSafeEqual`), and a 5-attempt progressive lockout. Password reset mutations require both the verified OTP (or short-lived verification grant) and the user's canonical email alongside the new password.
    - **Credential Memory Zero-Retention**: Plaintext passwords MUST NEVER be stored in server-side heap memory or session/staging caches during multi-step registration or OTP verification flows. Passwords must be pre-hashed immediately upon arrival before staging.
13. **Pure Sidebar-Only Workspace App Shell Architecture**:
    - **Headerless Desktop Canvas**: Authenticated tenant workspaces (`/tenant/[subdomain]`) adopt a pure sidebar navigation architecture (Linear/Stripe style) providing 100% full-viewport height for content workflows with zero horizontal top header chrome on desktop.
    - **Shadcn Sidebar Primitives & Token Authority**: The workspace navigation shell is constructed strictly using shadcn sidebar primitives (`SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarSeparator`, `SidebarTrigger`, `SidebarRail`) styled exclusively with tokens from `apps/web/src/lib/theme.ts`.
    - **Navigation Hierarchy**: The primary navigation organizes tools cleanly: top Workspace identity, "Home" navigation item, a visual `SidebarSeparator` hairline, and a "Facebook" section header with "Accounts" as its nested sub-item.
    - **Bottom Profile & Popover Action**: The bottom of the sidebar anchors a user card displaying the authenticated operator's name and email, accompanied by a chevron-up (`^`) trigger that reveals a contextual menu for theme switching and instant sign out.
    - **Mobile Floating Trigger**: Small screens (<768px) access the sidebar drawer via a discreet, floating theme-styled trigger button in the top-left corner without adding horizontal header bars.
14. **Canonical Post-Authentication Workspace Home Landing Route**:
    - **Tenant Root as Default Destination**: Following successful authentication (login) or account creation (signup OTP verification), the default destination MUST strictly resolve to the tenant's workspace root (`https://${subdomain}.${rootDomain}/` in production, `http://${subdomain}.${rootDomain}/` in dev), which internally rewrites to the workspace Home view (`/tenant/[subdomain]`). Legacy references redirecting to `/dashboard` are permanently eradicated.
    - **Post-Password Reset Sign-In Redirection**: Upon successful 6-digit OTP password reset and creation of a new password, the user MUST be redirected to the central Sign In page (`/login`) accompanied by a clear success notification confirming their password has been updated. Upon signing in with their new credentials, they are landed directly on their workspace Home page.
    - **Deep-Link Return URL Preservation**: When a valid, authorized `returnUrl` is provided during login or signup, it takes precedence over the default Home destination provided it satisfies strict open-redirect sanitization rules.
    - **Central Gateway Forwarding**: Authenticated sessions attempting to access central auth routes (`app.${rootDomain}/`, `/login`, `/signup`) are automatically routed to their workspace root (`https://${session.subdomain}.${rootDomain}/`).

## Development Workflow & Quality Gates

1. **Ideation & Governance**: Broad proposals and milestone announcements begin in GitHub Discussions.
2. **Spec Kit Lifecycle**: Features progress sequentially through:
   - `/speckit-specify` — Functional requirements & acceptance scenarios.
   - `/speckit-plan` — Technical architecture, contracts, and data models.
   - `/speckit-tasks` — Atomic task breakdown (<150–200 LoC).
   - `/speckit-taskstoissues` — Automated creation of GitHub Issues.
   - `/speckit-implement` — TDD execution of tasks.
   - `/speckit-converge` — Verification against specification before completion.
3. **CI Quality Gates**: All PRs must cleanly execute `pnpm turbo run build lint typecheck test` with 100% test pass rates before merge.
4. **Post-PR Vercel Preview Deployments**: UI previews are validated directly via automated Vercel Preview Deployments generated on each Pull Request. If and only if the PR includes UI changes, the live Vercel preview link must be presented to the user for interactive visual inspection before requesting merge approval. Non-UI PRs do not surface a preview link.
5. **Mandatory Human Approval Gate**: Autonomous or unapproved merges to `main` are strictly forbidden. The agent must explicitly ask for and receive user approval prior to executing any merge, regardless of whether the PR contains frontend, backend, database, or infrastructure changes.
6. **Single Combined PR Documentation Protocol (Never Separate Docs PRs)**: All documentation updates under `docs/` (including milestone roadmaps, architectural knowledge, API contracts, or schemas) MUST ALWAYS be included and committed directly in the SAME Pull Request as the implementation or architectural changes. Creating separate standalone PRs solely for documentation updates is strictly prohibited.

## Governance

The Constitution is the supreme governing document of the FBUploadPro repository and supersedes all conflicting instructions, agent prompts, or ad-hoc workflows.
- **Amendments**: Modifying this constitution requires formal proposal, documented rationale, and an increment to `CONSTITUTION_VERSION` following Semantic Versioning (MAJOR for breaking principle changes, MINOR for additions, PATCH for clarifications).
- **Compliance**: All contributors, AI agents, and code reviews must verify compliance against these principles before merging code.
- **Guidance Reference**: Operational agent instructions are maintained in [.agents/AGENTS.md](../../.agents/AGENTS.md).

**Version**: 2.9.0 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-09
