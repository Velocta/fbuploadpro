---
id: SPEC-0001
title: "Spec-Driven Development (SDD) Standard for AI-Assisted Engineering"
status: approved
type: standard
created: "2026-10-06"
updated: "2026-10-06"
author: "@Velocta"
reviewers: ["@shahzebpyc"]
epic_issue: "1"
ai_readiness: ready
target_version: "v1.0.0"
---

# SPEC-0001: Spec-Driven Development (SDD) Standard for AI-Assisted Engineering

## 1. Executive Summary & Problem Statement
Modern AI models possess exceptional capability to write code rapidly, but left unconstrained, they introduce severe systemic hazards:
1. **Architectural Drift:** Inventing unapproved dependencies, schemas, and abstractions.
2. **Context Hallucination:** Implementing features based on incomplete assumptions rather than concrete contracts.
3. **Premature Completion:** Declaring tasks "done" without executing regression suites, edge cases, or verification recipes.

**The Solution:** Spec-Driven Development (SDD) establishes **Specifications as the Single Source of Truth (SSOT)**. Every feature, refactor, or complex bug fix starts with a versioned, machine-readable specification in Git before any implementation code is written. GitHub Issues, Pull Requests, GitHub Actions, and GitHub Projects (v2) are organized to provide automated guardrails and total observability across the human-agent loop.

---

## 2. Scope & Non-Goals

### 2.1 In Scope
- Specification lifecycle, file structure, and metadata standards.
- Git branching, commit conventions, and Pull Request compliance gates.
- GitHub Issues hierarchy: RFC Proposals -> Spec Review -> Task Decomposition -> Defect tracking.
- GitHub Projects (v2) architecture for tracking human vs. autonomous agent workflows.
- GitHub Actions automated validation rules (spec linting, commit hygiene, project syncing).
- Machine-actionable agent context protocols (`AGENTS.md`, `.cursorrules`, `copilot-instructions.md`).

### 2.2 Non-Goals
- Mandating a specific programming language or web framework (the standard is language-agnostic).
- Replacing human review with 100% autonomous unattended deployment without human-in-the-loop gates.

---

## 3. Specification Structure & Syntax Standards

Every specification must reside in `specs/<id>-<slug>.md` and adhere to the following schema:

### 3.1 YAML Frontmatter Schema
```yaml
---
id: SPEC-XXXX                    # 4-digit unique numerical identifier (e.g., SPEC-0002)
title: "String"                  # Human-readable title
status: draft                    # draft | in-review | approved | in-implementation | completed | deprecated
type: feature                    # architecture | api | feature | refactor | standard | workflow
created: "YYYY-MM-DD"            # ISO-8601 date string
updated: "YYYY-MM-DD"            # ISO-8601 date string
author: "@github_handle"         # Primary author
reviewers: ["@handle1"]          # Reviewers
epic_issue: "123"                # GitHub Issue tracking this spec epic
ai_readiness: drafting           # not-ready | drafting | ready | executing | verified
target_version: "v1.0.0"         # Milestone release version
---
```

### 3.2 Mandatory Specification Headings
1. `## 1. Executive Summary & Problem Statement`
2. `## 2. Scope & Non-Goals` (Explicit In-Scope and Out-of-Scope lists)
3. `## 3. User Stories & Acceptance Criteria` (Gherkin format scenarios)
4. `## 4. Technical Architecture & System Design` (Diagrams, data models, API contracts)
5. `## 5. Security, Performance & Observability`
6. `## 6. AI Agent Implementation Directives` (Boundaries, forbidden patterns, rules)
7. `## 7. Verification & Test Plan` (Exact commands to run)
8. `## 8. Atomic Task Breakdown` (Subtasks linked to GitHub Issues)

---

## 4. GitHub Ecosystem Architecture

### 4.1 GitHub Issues (The Work Units)
Issues are categorized into three rigid types via GitHub Issue Forms (`.github/ISSUE_TEMPLATE/`):

| Issue Template | Purpose | Lifecycle State | Required Metadata |
| :--- | :--- | :--- | :--- |
| `01_spec_rfc.yml` | Proposing a new capability or architecture | Spec Phase | Target Spec ID, Problem, Scope, Draft link |
| `02_task_breakdown.yml` | Granular unit of implementation (<150-200 LoC) | Implementation Phase | Parent Spec ID, File boundaries, Test command, DoD |
| `03_spec_defect.yml` | Bug report asserting code violates an approved spec | Maintenance Phase | Violated Spec ID & Section, Failing test/repro |

### 4.2 GitHub Pull Requests (The Gated Verification Unit)
PRs are governed by `.github/PULL_REQUEST_TEMPLATE.md`:
- **Branch Naming:**
  - Spec proposals: `spec/<id>-<short-description>`
  - Feature tasks: `feat/<spec-id>-<task-id>-<short-description>`
  - Bug fixes: `fix/<spec-id>-<issue-id>-<short-description>`
- **Commit Message Standard:** Conventional Commits with spec scope:
  - `feat(spec-0001): add issue forms for spec and tasks`
  - `test(spec-0001): add validator script for spec frontmatter`
  - `docs(spec-0001): document github projects v2 setup`
- **Required PR Body Checklist:**
  - Link to Parent Spec and Task Issue.
  - Confirmation that tests were added and passing.
  - Automated test execution logs.
  - Confirmation of 0 linter and type errors.

### 4.3 GitHub Projects v2 (Mission Control for AI Agents)
A custom GitHub Projects board tracks both Human planning and AI agent dispatch:

#### Custom Fields:
- **`Phase`** (Single Select): `0. Idea / Triage` -> `1. Spec Authoring` -> `2. Spec Review` -> `3. Spec Frozen` -> `4. Task Breakdown` -> `5. Implementation` -> `6. Automated Verification` -> `7. Done`.
- **`AI Readiness`** (Single Select): `Drafting` -> `Spec Needed` -> `AI-Ready` -> `AI Executing` -> `Human Review` -> `Verified`.
- **`Agent Assigned`** (Single Select): `Unassigned` -> `Antigravity` -> `Claude Code` -> `Copilot Workspace` -> `Human Engineer`.
- **`Spec ID`** (Text): e.g., `SPEC-0001`.
- **`Complexity`** (Single Select): `XS (<50 lines)`, `S (50-150 lines)`, `M (150-200 lines ceiling)`, `L (>200 lines, must be split)`.

#### Standard Views:
1. **Spec Pipeline (Board View):** Shows high-level specs moving through drafting, peer review, and approval.
2. **AI Agent Dispatch Board (Board View):** Filtered to implementation tasks. Cards move from `AI-Ready` -> `In Progress (Agent)` -> `Review Needed` -> `Done`.
3. **Milestone / Release Roadmap (Table View):** Grouped by target version and Spec ID.

### 4.4 GitHub Actions Workflows (Automated Gates)
Continuous Integration acts as the automated referee:
1. `spec-lint.yml`: Triggers on changes to `specs/**`. Parses YAML frontmatter, validates all mandatory headings exist, and verifies links.
2. `pr-hygiene.yml`: Triggers on Pull Requests. Validates title against Conventional Commits, verifies linked Issue/Spec reference exists.
3. `project-sync.yml`: Automates label synchronization and project field automation via GitHub CLI.

---

## 5. AI Agent Protocol (Rules of Engagement)

When any AI coding assistant is activated inside a repository adhering to this standard:

```text
[Prompt / Request]
        │
        ▼
Is there an approved Spec for this in `specs/`?
        ├── NO  ──► Halt & prompt user to draft an RFC / Spec first.
        └── YES ──►
                    1. Read Spec & Target Task Issue.
                    2. Read Scope & Non-Goals.
                    3. Write failing unit test reproducing Acceptance Criteria (TDD).
                    4. Implement minimal required code.
                    5. Run local Verification Plan commands (Lint, Types, Tests).
                    6. Submit PR with full trace to Spec and execution log.
```

---

## 6. Verification & Test Plan

| Gate | Check | Command / Tool | Criteria |
| :--- | :--- | :--- | :--- |
| **Spec Validator** | Frontmatter & Structure | `python3 scripts/validate_spec.py specs/` | 100% Valid |
| **PR Linter** | Conventional Commit & Spec Link | GitHub Action / `commitlint` | 0 failures |
| **Code Quality** | Linting & Formatting | `npm run lint` / `flake8` / `ruff` | 0 warnings |
| **Contract Suite** | Acceptance Criteria Scenarios | Language Test Runner | 100% pass |

---

## 7. Definition of Done (DoD)
A specification is marked `completed` only when:
- [x] All child task issues are closed via merged PRs.
- [x] 100% of Acceptance Criteria scenarios are covered by automated tests.
- [x] Zero drift exists between the final codebase and the spec documentation.
- [x] Project board items are transitioned to `Done`.
