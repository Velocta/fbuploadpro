# Coding Standards & Quality Gates

This document establishes the mandatory engineering standards, architectural principles, and quality gates for all code written in this repository. AI agents operating in this workspace MUST adhere to these rules strictly.

---

## 1. Spec-Driven Traceability

- **Spec First**: No production code may be written or modified without tracing directly to an active feature specification under `specs/<feature-id>/spec.md` and technical blueprint in `plan.md`.
- **Atomic Task Alignment**: Every code edit must correspond to an explicit task ID from `tasks.md`.
- **Strict Scope Boundaries**: Do not unilaterally implement features, extensions, or refactors outside the active task and specification scope. If gaps or adjacent improvements are identified, document them in conversation or feature notes—do not silently implement unapproved work.

---

## 2. Anti-Slop Directives (Eliminating AI Bloat & Hallucinations)

AI-generated code frequently suffers from "slop"—unnecessary bloat, speculative layers, shallow tests, and poor hygiene. The following anti-patterns are strictly forbidden:

### A. Zero Speculative Over-Engineering (YAGNI)
- **Implement Only What Is Needed**: Write the simplest code that completely satisfies the current specification. Never build speculative interfaces, abstract factory patterns, generic adapter layers, or "future-proofing" hooks that are not explicitly required by `plan.md`.
- **Prefer Concrete over Abstract**: Do not introduce indirection, wrapper classes, or deep hierarchies when a standalone pure function or cohesive module suffices.
- **No Premature Optimization**: Optimize for clarity, correctness, and maintainability first. Avoid premature caching layers or complex concurrency models unless specified in performance requirements.

### B. Zero Tolerated Stubs or Placeholder Code
- **Complete Implementations Only**: Never commit placeholder comments (`// TODO: implement later`, `# pass`, `throw NotImplementedError()`), mock fallbacks, or dummy functions in production paths.
- **Fail-Fast over Fake Success**: Never return fake success responses or dummy data to mask incomplete logic. Every code path must be fully implemented and verified.

#### Structural Scaffolding (Not Stubs)

`apps/desktop` (Tauri shell) and `apps/extension` (browser companion) are
**intentional structural scaffolding** for surfaces planned for future launch.
They are not stub violations and must not be removed by cleanup efforts.

- **Scaffolding** = a declared future surface with structural presence
  (workspace layout, config, typed contracts). Expected to be incomplete.
- **Stub** = an incomplete implementation inside a live production path
  (`// TODO`, `throw NotImplementedError()`, mock fallbacks). Never allowed.

Only the web app (`apps/web`) is launched. Do not flag scaffolding
directories in audits, and do not propose their removal.

### C. Concise, High-Signal Comments
- **Self-Documenting Code**: Code must be readable without narration. Do not state the obvious (`// increment counter by 1`, `# return the response`, `// initialize variable`).
- **Explain "Why", Not "What"**: Comments are reserved exclusively for non-obvious business logic, domain nuances, algorithmic complexity, or external API quirks.
- **Accurate Docstrings**: Keep docstrings concise and truthful. Avoid repetitive boilerplate that merely restates type names and argument identifiers without adding context.

### D. No Silent Failure or Error Swallowing
- **No Empty Catch/Except Blocks**: Never use bare `except: pass` or `catch (e) {}`. All errors must be logged with actionable diagnostic context, handled with a documented fallback, or rethrown.
- **Preserve Error Causality**: When wrapping exceptions, preserve the original stack trace (e.g., `raise CustomError(...) from err` or `new Error("...", { cause: err })`).
- **Graceful Boundary Degradation**: At user-facing boundaries, catch unexpected crashes, log diagnostics internally, and return structured, informative errors—never crash silently or return ambiguous empty states (`null`, `""`).
- **Silent-Failure Ban at the Data Boundary (Spec 137 §3.1)**: In `apps/web/src`, the pattern family `if (!res.ok) return;` (including `return null;` / `return undefined;` variants), bare `catch { return; }`, and empty catch blocks in data code are **banned**. A failed request or caught error must surface — thrown as an `ApiError` from the typed client (`apps/web/src/lib/api`), presented to the user via the interruption ladder at its scope, or reported through `reportError` (`apps/web/src/lib/report-error.ts`). Browser code talks to the app's API **only** through the typed client (`apiFetch` / `api.*` with its zod schemas); hand-rolled `fetch(` + `.json()` casts in components/pages are not permitted for new code. Enforcement is mechanical: guardrail **check 12** in `.github/scripts/regression-guardrails.sh` freezes pre-existing occurrences per file in `apps/web/silent-failure-baseline.txt` (decrease-only; they are deleted by the surface rebuilds that own each file, spec 137 §4.1.2) and fails CI on any new occurrence.
- **localStorage Allowlist (Spec 137 §3.9)**: In `apps/web/src`, direct `localStorage` access is **allowlist-only**: the typed preferences helper (`apps/web/src/lib/storage/preferences.ts` — zod-validated reads/writes, namespaced keys, typed registry; the only way to persist device preferences), the theme-init script in `apps/web/src/app/layout.tsx`, and the auth cross-tab broadcast mechanism (`apps/web/src/lib/auth-broadcast.ts` + `apps/web/src/components/workspace/workspace-lifecycle-guard.tsx`). Server-owned data in `localStorage` is **banned** — server data lives in the data layer (`apps/web/src/lib/data`, React Query + the typed client). Enforcement is mechanical: guardrail **check 13** freezes pre-existing non-allowlist usages per file in `apps/web/localstorage-baseline.txt` (decrease-only; each is classified in PR-A1b's per-site table with a named migration owner — the surface rebuild that owns the file, spec 137 §4.1.7) and fails CI on any new usage.
- **`any` Ratchet (Spec 137 §3.7)**: Type-position `any` in `apps/web/src` may only go **down**. Type the boundary properly instead: zod-inferred types from `apps/web/src/lib/api` schemas, contracts row types (`Database*Row`), typed accumulators/reduces, and `catch (err: unknown)` narrowed through `getErrorMessage` (`apps/web/src/lib/api/errors.ts`) or an `in`/`typeof` probe. Casting through `unknown`/`as any` to move an `any` elsewhere does not count as removing it. Enforcement is mechanical: guardrail **check 14** freezes the residuals per file in `apps/web/any-baseline.txt` (counting method recorded in that file's header; each residual names its owning surface, spec 137 §4.1.6) and fails CI on any increase or new file. End state: zero `any` in `src/lib/api`, `src/lib/data` and all response-mapping paths.
- **Images & Bundle (Spec 137 §3.5/§3.6)**: Raw `<img>` is **banned** in `apps/web/src` — use `next/image` (remote hosts are allowlisted in `next.config.ts` `images.remotePatterns`; add a host only with grep evidence the app displays it). ESLint `@next/next/no-img-element` is an error; the 16 pre-existing surface-owned files are frozen per file in `apps/web/img-baseline.txt` (guardrail **check 15**, decrease-only) until their surface rebuilds convert them (spec 137 §4.1.4). Heavy or closed-by-default UI stays out of route initial bundles via `next/dynamic`; `posthog-js` loads by dynamic import only. Bundle budgets are **enforced** (D137-3's report-only posture superseded 2026-10-24): `apps/web/bundle-budgets.json` records the measured baseline and a 5% headroom; the CI bundle job fails when the shared bundle, any route, or total emitted client JS exceeds its budget, and a new route has no budget. Raise a budget only deliberately, from a fresh measurement recorded in the same PR — never invent a number.

### E. Dependency Restraint & Standard Library First
- **Standard Library Priority**: Exhaust standard library solutions before proposing external dependencies. Never add a third-party package for simple tasks (e.g., date parsing, string manipulation, basic math, UUID generation) that standard libraries easily provide.
- **Vetted Dependencies**: Any new dependency must be vetted, documented in `plan.md`, and justified by substantial complexity reduction.

---

## 3. Code Architecture & Maintainability

### A. Modularity & Single Responsibility
- **Focused Units**: Functions and methods must have a single, well-defined responsibility. Aim for functions that fit within a single screen view (~30–50 lines).
- **Pure Functions Where Possible**: Prefer stateless, deterministic functions with explicit inputs and outputs to maximize testability and minimize hidden side effects.
- **Cohesive Modules**: Group related capabilities into cohesive modules. Avoid monolithic "utils" or "helpers" dump files; organize utilities by domain (e.g., `crypto`, `http`, `formatters`).

### B. DRY via Codebase Discovery
- **Discover Before Inventing**: Before writing a helper function, search the existing codebase (`grep`, file inspection) to verify whether identical or similar utilities already exist. Reuse existing patterns and helpers.
- **Eliminate Duplicate Sprawl**: If the same logic is repeated in three places, refactor it into a shared, tested utility rather than copy-pasting.

### C. Strict, Explicit Typing
- **Comprehensive Type Annotations**: Apply explicit type annotations to all public function signatures, data models, and module boundaries.
- **No Untyped Fallbacks**: Prohibit `any` (TypeScript) or raw `dict`/`Any` (Python) where structured schemas (interfaces, Pydantic models, dataclasses, TypeScript types) are known.
- **Strict Nullability & Optionality**: Explicitly handle `null`/`undefined`/`None`. Do not assume properties exist without validation or safe accessors.

### D. Constants over Magic Numbers
- **Extract Magic Literals**: Never scatter unexplained numbers, timeout durations, regex patterns, or status strings across the codebase. Extract them into named, uppercase constants or configuration objects with explanatory names (e.g., `DEFAULT_HTTP_TIMEOUT_SECONDS = 30`).

---

## 4. Modification Discipline & Surgical Diffs

### A. Context & Documentation Preservation
- **Preserve Existing Integrity**: Never truncate, delete, or rewrite unrelated existing code, comments, docstrings, or types when editing files.
- **Respect Surrounding Conventions**: Match the existing formatting, quote style, indentation, and architectural conventions of the file being edited.

### B. Surgical, Focused Changes
- **Single-Purpose Diffs**: Make minimal, targeted modifications that directly satisfy the current task. Do not perform drive-by reformatting across untouched functions in the same file.
- **No Unprompted Mass Renames**: Do not rename public symbols, file paths, or directories unless explicitly called for in the task plan.

---

## 5. Testing & Verification Standards

### A. Behavioral Verification over Mock Theater
- **Test Real Behaviors**: Write tests that verify real outcomes, contract fulfillment, and edge cases. Avoid shallow tests that merely assert trivial tautologies (`expect(true).toBe(true)`).
- **Avoid Over-Mocking**: Never mock the system under test. Mock only external, non-deterministic boundaries (e.g., third-party network APIs, system clocks, hardware). If a unit requires dozens of complex mocks, refactor the code toward pure, decoupled functions.
- **Cover Edge Cases**: Every feature must include tests for boundary conditions:
  - Empty collections, zero values, and missing/null fields.
  - Invalid types, malformed input strings, and out-of-range parameters.
  - Timeouts, simulated network errors, and expected failure modes.

### B. Non-Negotiable Quality Gates
- **Automated Verification**: Before marking any implementation task complete:
  1. All new and existing automated tests must pass with zero failures (`pnpm turbo run test`).
  2. Code must pass linters, formatters, and static type checks without suppressing warnings (`# noqa`, `@ts-ignore`) unless strictly justified (`pnpm turbo run lint typecheck`).
  3. Native desktop Rust code must pass compilation and static checks (`cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`).
  4. Full production build must pass without errors (`pnpm turbo run build`).
  5. No temporary debug prints (`console.log`, `println!`, `print()`) or commented-out code may be committed.

---

## 6. FBUploadPro Architectural Constraints

### A. Next.js 16 & React 19 Frontend (`apps/web`)
- **Event-Driven State Transitions**: Never trigger state mutations inside effects. The rule `react-hooks/set-state-in-effect` is strictly enforced.
- **Server vs. Client Components**: Default to Server Components; explicitly declare `'use client'` only when interactive event handlers, browser hooks, or client state are needed.
- **Anti-Slop Craft**: Comply with `taste-skill` and `pbakaus/impeccable` standards for typography, hierarchy, alignment, responsive layout, and contrast.

### B. Cloudflare Worker Edge Isolate (`apps/worker`)
- **V8 Isolate Purity**: Zero Node.js TCP socket or Node-specific standard library dependencies (`net`, `tls`, `fs`).
- **Edge Database Client**: Must use `@supabase/supabase-js` communicating strictly over HTTPS / PostgREST. Legacy database packages and direct TCP poolers are permanently eradicated.
- **Strict Execution Budgets**: External HTTP calls must carry explicit timeouts via `AbortController` (e.g. 2000ms max).

### C. Multi-Tenant Data Isolation & Supabase Substrate
- **Tenant Scope Enforcement**: Every tenant-owned database table must enforce isolation strictly via `user_id`. There are no agency containers in the platform.
- **Compound Constraints**: Enforce foreign keys and unique constraints using compound keys (e.g., `(user_id, facebook_account_id)`).
- **Abolition of Token Economy**: The legacy prepaid token system, credit balances, and transaction ledgers are formally abolished. Publishing is unrestricted for all active users (`status = 'active'`) with connected Facebook Pages, with zero token deduction or balance gating.

### D. Shared Contracts & Boundary Validation (`packages/contracts`)
- **Zod Runtime Validation**: All payloads crossing API routes, webhook handlers, and worker messages must parse against strict Zod schemas.
- **Zero Type Coercion (`any`)**: Export and consume inferenced TypeScript types directly from Zod contracts (`z.infer<typeof Schema>`).

### E. Theme Token & Design System Enforcement (`apps/web/src/lib/theme.ts`)
- **Mandatory Centralized Theme Authority**: All visual styling, colors, borders, spacing, radii, typography, and shadows in `apps/web` MUST be referenced strictly from `apps/web/src/lib/theme.ts` (or CSS custom properties in `globals.css`).
- **Never Declare, Always Reference**: AI agents are strictly prohibited from declaring ad-hoc hex color literals, RGB/HSL strings, or arbitrary border/shadow definitions inside component files.
- **Status Presentation (Colour + Icon + Text)**: Status must be signaled as colour + icon + text together (spec 129 OD-3) — state never travels by colour alone. Colours and labels come from `STATUS_SIGNALS`; never present status as a bare coloured dot.
- **Full Specification**: Detailed compliance and code patterns are governed by `.agents/rules/theme-standards.md` and the design-token source in `apps/web/tokens/` (the single source of truth since 2026-10-22, spec 129; the former `DESIGN.md` was deleted and superseded by the token system).

### F. Desktop Application Shell & Native Rust Backend (`apps/desktop`)
- **Thin Client / Fat Server IP Isolation (Principle 26)**:
  - The desktop client is strictly a presentation and local hardware/filesystem gateway.
  - NEVER store raw long-lived third-party OAuth access tokens or app secrets inside the desktop app.
  - NEVER implement proprietary publishing decision algorithms, rate limiting bypasses, or core scheduling engines in desktop client code.
- **Tauri v2 Architecture & IPC Purity**:
  - Tauri commands exposed to the frontend webview must validate all inbound arguments and return strongly typed `Result<T, E>` structures serialized via `serde`.
  - Zero `unwrap()` calls in production Rust command paths; use idiomatic error propagation (`?`) with descriptive error types.
- **Release Profile Symbol Stripping**:
  - Cargo release profile MUST maintain `strip = true`, `opt-level = 3`, `lto = true`, `codegen-units = 1`, and `panic = "abort"` to prevent binary decompilation and symbol leakage.
- **Local File System Ergonomics**:
  - Local directory/folder watchers must be non-blocking and stream change events efficiently through Tauri's event bus without saturating CPU.

### G. Browser Companion Shell (`apps/extension`)
- **Manifest V3 Specification**:
  - Strictly adhere to Chrome and Firefox Manifest V3 architecture.
  - Background processes must run as transient service workers; never rely on persistent background page memory.
- **Zero Client-Side Secret Leakage**:
  - Extensions execute in untrusted user-controlled runtime environments. No master client secrets or unencrypted tenant tokens may be packaged in extension bundles.
  - Extension communicates with `@fbuploadpro/worker` edge endpoints using authenticated ephemeral session tokens.
- **Scoped Permissions & Content Security Policy (CSP)**:
  - Request minimal required permissions (`activeTab`, `storage`).
  - Zero eval, WebAssembly compilation, or inline script injection.
- **Contract Synchronization**:
  - Data transfer schemas between content scripts, popup UI, and background workers must be validated against `@fbuploadpro/contracts`.

