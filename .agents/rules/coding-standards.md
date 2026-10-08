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

### C. Concise, High-Signal Comments
- **Self-Documenting Code**: Code must be readable without narration. Do not state the obvious (`// increment counter by 1`, `# return the response`, `// initialize variable`).
- **Explain "Why", Not "What"**: Comments are reserved exclusively for non-obvious business logic, domain nuances, algorithmic complexity, or external API quirks.
- **Accurate Docstrings**: Keep docstrings concise and truthful. Avoid repetitive boilerplate that merely restates type names and argument identifiers without adding context.

### D. No Silent Failure or Error Swallowing
- **No Empty Catch/Except Blocks**: Never use bare `except: pass` or `catch (e) {}`. All errors must be logged with actionable diagnostic context, handled with a documented fallback, or rethrown.
- **Preserve Error Causality**: When wrapping exceptions, preserve the original stack trace (e.g., `raise CustomError(...) from err` or `new Error("...", { cause: err })`).
- **Graceful Boundary Degradation**: At user-facing boundaries, catch unexpected crashes, log diagnostics internally, and return structured, informative errors—never crash silently or return ambiguous empty states (`null`, `""`).

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
  1. All new and existing automated tests must pass with zero failures.
  2. Code must pass linters, formatters, and static type checks without suppressing warnings (`# noqa`, `@ts-ignore`) unless strictly justified.
  3. No temporary debug prints (`console.log`, `print()`) or commented-out code may be committed.

---

## 6. FBUploadPro Architectural Constraints

### A. Next.js 16 & React 19 Frontend (`apps/web`)
- **Event-Driven State Transitions**: Never trigger state mutations inside effects. The rule `react-hooks/set-state-in-effect` is strictly enforced.
- **Server vs. Client Components**: Default to Server Components; explicitly declare `'use client'` only when interactive event handlers, browser hooks, or client state are needed.
- **Anti-Slop Craft**: Comply with `taste-skill` and `pbakaus/impeccable` standards for typography, hierarchy, alignment, responsive layout, and contrast.

### B. Cloudflare Worker Edge Isolate (`apps/worker`)
- **V8 Isolate Purity**: Zero Node.js TCP socket or Node-specific standard library dependencies (`net`, `tls`, `fs`).
- **Edge Database Client**: Must import from `@fbuploadpro/database/edge` rather than Node.js connection pool clients.
- **Strict Execution Budgets**: External HTTP calls must carry explicit timeouts via `AbortController` (e.g. 2000ms max).

### C. Multi-Tenant Data Isolation (`packages/database`)
- **Tenant Scope Enforcement**: Every tenant-owned database table must enforce isolation strictly via `user_id`. There are no agency containers in the platform.
- **Compound Constraints**: Enforce foreign keys and unique constraints using compound keys (e.g., `(user_id, facebook_account_id)`).
- **Concurrency & Ledgers**: Token ledgers must use atomic balance debits and non-negative check constraints (`balance >= 0`).

### D. Shared Contracts & Boundary Validation (`packages/contracts`)
- **Zod Runtime Validation**: All payloads crossing API routes, webhook handlers, and worker messages must parse against strict Zod schemas.
- **Zero Type Coercion (`any`)**: Export and consume inferenced TypeScript types directly from Zod contracts (`z.infer<typeof Schema>`).
