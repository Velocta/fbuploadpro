# Operational Edge Cases & Multi-Agent Protocols

> **Purpose:** Standard Operating Procedures (SOPs) for handling real-world engineering friction, concurrency collisions, dependency additions, flaky environments, and deadlocks in the Velocta Spec-Driven Development framework.

---

## 🗺️ Protocol Directory

| # | Scenario | Core Risk | Intervening Role | Primary Rule / Protocol |
| :- | :--- | :--- | :--- | :--- |
| **1** | [New 3rd-Party Dependencies](#1-the-dependency-addition-protocol-dap) | CVEs, license traps, bloat | Orchestrator + Challenger | **Dependency Addition Protocol (DAP)** |
| **2** | [CI vs Local Parity Drift](#2-ci-parity--flake-quarantine-protocol) | Hidden production breakages | Worker ➔ Challenger | **CI Parity & Flake Quarantine** |
| **3** | [Concurrent Worker Git Conflicts](#3-concurrent-worker-rebase-protocol) | Overwritten work, bad merges | Worker ➔ Orchestrator | **Rebase-Only & Boundary Check** |
| **4** | [In-Flight Spec Changes](#4-in-flight-spec-mutation--stale-eviction) | Stale implementation, wasted PRs | Orchestrator | **Spec Commit Pinning & Stale Eviction** |
| **5** | [Review Ping-Pong Loops](#5-the-3-round-review-circuit-breaker) | Context exhaustion, token waste | Challenger (Staff Arbiter) | **3-Round Review Circuit Breaker** |
| **6** | [Technical Impossibility Trap](#6-technical-impossibility-red-line-halt) | Brittle monkey-patching slop | Worker ➔ Orchestrator | **Red-Line Halt & Spec Defect** |
| **7** | [External Secrets & Credentials](#7-secret--sandbox-credential-isolation) | Credential leaks, unrunnable tests | Spec Architect | **Port/Adapter Mock-First Isolation** |
| **8** | [Destructive Changes & Deletions](#8-two-phase-deprecation-standard) | Breaking parallel branches | Orchestrator | **Two-Phase Deprecation & Tombstone** |

---

## 1. The Dependency Addition Protocol (DAP)

### The Problem
During implementation, the Worker realizes it needs an external library (npm package, PyPI package, or Cargo crate) that is not in the repository manifests (`package.json`, `pyproject.toml`, `Cargo.toml`).

### The AI Anti-Pattern
The Worker unilaterally modifies manifests and lockfiles, introducing unverified dependencies, license violations (e.g. AGPL in a closed-source product), or bundle bloat.

### The Protocol
1. **Manifest Lockout:** Workers are strictly forbidden from modifying dependency manifests unless explicitly instructed by the parent spec.
2. **Worker Halts & Submits DAP Request:** Worker labels the task `ai:blocked` and posts:
   ```markdown
   ### 📦 Dependency Addition Request (DAP)
   - **Current Task:** TASK-XXXX
   - **Package & Version:** `date-fns@3.6.0`
   - **Rationale:** Native JS Date lacks timezone arithmetic required by Section 4.2.
   - **Alternatives Considered:** Vanilla implementation (+120 LoC) vs tree-shaken library (+3KB).
   - **Security & License:** MIT License, 0 CVEs on npm audit / Snyk.
   - **Manifests Affected:** `package.json`, `package-lock.json`
   ```
3. **Co-Sign Gate:** Orchestrator verifies architectural need; Challenger audits license compatibility.
4. **Isolated Chore Execution:**
   - Once co-signed by both Orchestrator and Challenger, the blocked Worker checks out an isolated chore branch: `chore/deps-<package>`.
   - The Worker commits strictly the manifest updates (`chore(deps): add date-fns v3.6.0`) and opens a micro-PR.
   - Challenger executes expedited squash merge into `main`.
   - The Worker rebases the blocked feature branch onto `main` (`git fetch origin main && git rebase origin/main`), removes `ai:blocked`, and resumes implementation.

---

## 2. CI Parity & Flake Quarantine Protocol

### The Problem
Tests pass in the Worker's local environment, but GitHub Actions CI fails (due to timezone offsets, OS differences, missing system headers, or race conditions).

### The AI Anti-Pattern
The Worker dismisses the failure as "CI noise" or adds `test.skip()` / increases an arbitrary timeout.

### The Protocol
1. **CI Is Supreme Truth:** A PR can NEVER be merged with a red CI check.
2. **Hermetic Local Reproduction:** Worker reproduces the failure locally using CI flags:
   ```bash
   CI=true TZ=UTC npm test
   ```
3. **Flake Triage:**
   - **Worker Bug:** Fix under strict Red-Green-Refactor.
   - **Pre-Existing Flake in Unassigned File:** Worker is **forbidden from modifying that file**. Worker posts the log on the PR, labels the PR `ai:blocked`, and creates a defect issue:
     ```bash
     gh issue create --title "[DEFECT]: Flaky integration test in auth_service.test.ts" --label "type:defect,phase:triage"
     ```
   - The Challenger has exclusive authority to quarantine the flaky test on `main` before the Worker's PR is re-tested.

---

## 3. Concurrent Worker Rebase Protocol

### The Problem
Worker A and Worker B start tasks simultaneously. Worker B merges PR #12 into `main`. Worker A's open PR #13 now shows: *"This branch has conflicts that must be resolved."*

### The AI Anti-Pattern
Worker runs `git merge origin/main`, introducing ugly merge commits, hallucinating conflict markers, or overwriting Worker B's code.

### The Protocol
1. **Rebase-Only Mandatory Rule:** Never merge `main` into a feature branch. Always rebase:
   ```bash
   git fetch origin main
   git rebase origin/main
   ```
2. **Conflict Resolution Boundary Check:**
   - **Inside Allowed Files:** Worker resolves conflicts, re-runs full verification recipe, and pushes:
     ```bash
     git push --force-with-lease origin feat/<branch>
     ```
   - **Outside Allowed Files:** Worker halts immediately. Overlapping boundaries indicate a task decomposition error. Worker tags issue `ai:blocked` for Orchestrator re-alignment.

---

## 4. In-Flight Spec Mutation & Stale Eviction

### The Problem
While a Worker is halfway through a task, the User or Challenger requests an architectural change in `specs/XXXX-*.md`.

### The AI Anti-Pattern
Worker continues coding against the obsolete spec revision, delivering code that violates the updated architectural contracts.

### The Protocol
1. **Spec Commit Pinning:** Every task issue records the exact Git commit SHA of the approved spec:
   ```yaml
   parent_spec_commit: "a1b2c3d"
   ```
2. **Automated Drift Detection:** Before starting implementation, Worker checks if the spec has evolved on `main`:
   ```bash
   git log -1 --format=%H specs/<spec-file>.md
   ```
3. **Stale Eviction:** If the spec SHA does not match, Orchestrator tags the task `spec:stale` and halts work:
   *"Spec updated in commit abc1234. Task paused. Worker must re-baseline against updated contract."*

---

## 5. The 3-Round Review Circuit Breaker

### The Problem
Worker submits PR ➔ Orchestrator requests changes ➔ Worker fixes item A but introduces style flaw B ➔ Orchestrator requests changes again. The loop repeats indefinitely, burning tokens and developer time.

### The AI Anti-Pattern
Endless automated back-and-forth review loops without convergence.

### The Protocol
1. **Round 1 (Standard Review):** Orchestrator audits PR using the 5-Point Scorecard and posts required revisions.
2. **Round 2 (Verification of Fixes):** Worker addresses all points and references commit SHAs. Orchestrator audits only the delta.
3. **Round 3 (Circuit Breaker Tripped):** If on the 3rd turn the PR still fails:
   - Automated review halts immediately.
   - PR is tagged `review:human-signoff` and `ai:blocked`.
   - The Challenger (Staff Arbiter) intervenes:
     - **Option A (Minor Delta):** Challenger pushes the missing 2-line fix directly and merges.
     - **Option B (Architectural Failure):** Challenger closes the PR, resets the task to `ai:ready`, and re-assigns it with a clarified specification.

---

## 6. Technical Impossibility Red-Line Halt

### The Problem
The Orchestrator wrote a spec requiring behavior that is physically unsupported by the underlying runtime, language, or database (e.g., full outer join in SQLite, sync IO in async event loop).

### The AI Anti-Pattern
The Worker writes 150 lines of complex monkey-patching and brittle hacks to simulate impossible behavior, producing unmaintainable code.

### The Protocol
1. **The Red-Line Principle:** An AI Worker must never hack around runtime or library impossibilities.
2. **Worker Files Spec Defect:**
   ```bash
   gh issue create --title "[SPEC-DEFECT]: Spec-0001 Section 4.3 requires unsupported SQLite feature" \
     --label "type:defect,phase:spec" \
     --body "Section 4.3 specifies FULL OUTER JOIN, but SQLite only supports LEFT OUTER JOIN. Halting to prevent brittle workarounds."
   ```
3. Worker tags task `ai:blocked`. Orchestrator amends the specification architecture and requests Challenger re-signoff.

---

## 7. Secret & Sandbox Credential Isolation

### The Problem
A task requires communicating with third-party APIs (Stripe, AWS, Resend, GitHub) that require authentication secrets.

### The AI Anti-Pattern
Worker hardcodes dummy keys like `"sk_test_12345"` in source code or asks the user to paste production API keys in GitHub Issues or chat.

### The Protocol
1. **Zero Real Keys for Workers:** AI Workers are never provided live production or personal credentials.
2. **Mandatory Mock/Fake Port:** Every spec involving an external service must declare an in-memory test adapter (e.g. `MockStripeClient` or `InMemoryEmailGateway`).
3. **Local Testing via Mocks:** The Worker's verification recipe runs 100% against mock adapters and hermetic fixtures.
4. **Sandbox Integration in CI:** Real API keys are stored only in GitHub Actions Encrypted Secrets or executed by the Human User in their private environment.

---

## 8. Two-Phase Deprecation Standard

### The Problem
A task requires refactoring or removing a legacy module or database column (e.g. `src/legacy/auth.ts`).

### The AI Anti-Pattern
Worker immediately runs `rm src/legacy/auth.ts` or drops the column, instantly breaking parallel worker branches and downstream consumers.

### The Protocol
1. **Phase 1 (Soft Deprecation Task):**
   - New code is introduced alongside the old code.
   - Old code is annotated with `@deprecated` docstrings and internally proxies to the new implementation.
   - All existing tests and parallel branches continue passing without disruption.
2. **Phase 2 (Tombstone Purge Task):**
   - After all callers across the repository have been updated in subsequent tasks, Orchestrator creates an explicit tombstone task:
     `[TASK]: Tombstone - Purge legacy auth.ts and deprecated callers`
   - Verification recipe verifies that zero references remain:
     ```bash
     ! git grep "legacyAuth" src/
     ```
