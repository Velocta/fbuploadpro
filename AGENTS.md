# AI Agents Guide

This repository enforces **Autonomous Spec-Driven Development (SDD)** and multi-agent orchestration for all AI agents, assistants, and sub-agents.

---

## 🚨 Autonomous Execution & Interaction Rules

AI agents operating in this repository MUST strictly follow these execution protocols:

### 1. Single User Touchpoint ("Ask Once, Complete Till Merge")
- **One Question Only:** The agent must ONLY ask the user which spec or feature to work on (if not already specified in the user's prompt).
- **Zero Intermediate Prompts:** Once the target spec is identified, the agent **MUST execute the entire lifecycle autonomously until all PRs are squash-merged into `main`**.
- **No Permission Pauses:** Never pause to ask for approvals, confirmations, or next-step permissions (e.g., do NOT ask "Should I plan now?", "Ready to create tasks?", "Should I open the PR?", "Should I merge?"). Execute each phase sequentially and merge without interruption.
- **Autonomous Clarifications:** If requirement gaps or edge cases arise during specification or planning, resolve them using established codebase patterns and domain defaults rather than stopping to query the user.

### 2. Strict Deterministic Phase Sequence
Every feature milestone MUST execute in this exact sequence without skipping phases:
1. **GitHub Discussions (Ideation & RFC):** Verify or create an RFC in `Ideas & Features` before task decomposition.
2. **`/speckit-specify`:** Generate functional requirements, user stories, acceptance scenarios, and quality checklists in `specs/<feature>/spec.md`.
3. **`/speckit-plan`:** Formulate technical blueprints, data models, contracts, and migration plans in `plan.md`.
4. **`/speckit-tasks`:** Decompose the plan into dependency-ordered, atomic tasks (<150–200 LoC per task) in `tasks.md`.
5. **`/speckit-taskstoissues`:** Convert all tasks into GitHub Issues, labeled by user story, and sync them to GitHub Project #8 (`fbuploadpro rebuild`) in `To Do`.
6. **`/speckit-implement`:** Execute TDD implementation, run quality gates, create PRs, and squash-merge every task PR into `main`.
7. **`/speckit-converge`:** Audit the codebase against the spec, resolve any residual gaps via PR, and verify 100% convergence.

### 3. Sub-Agent Delegation & Clean Chat Standard
- **Clean Main Chat Protocol:** The primary chat session is reserved strictly for high-level milestone progress updates. Heavy command logs, raw diffs, and verbose test runs MUST execute inside discrete sub-agents (`invoke_subagent`).
- **Dedicated Sub-Agent per Spec Kit Phase:**
  - Launch an isolated sub-agent for `/speckit-specify`.
  - Launch an isolated sub-agent for `/speckit-plan`.
  - Launch an isolated sub-agent for `/speckit-tasks`.
  - Launch an isolated sub-agent for `/speckit-taskstoissues`.
  - Launch an isolated sub-agent for `/speckit-converge`.
- **Multi-Agent Swarm for Implementation (`/speckit-implement`):**
  - During implementation, spawn **multiple sub-agents** to work concurrently on independent task streams (e.g., contracts vs backend vs UI) or sequentially along dependency chains.
  - Each implementation sub-agent:
    1. Checks out a dedicated feature branch (`feat/...`).
    2. Writes failing unit/integration tests first (strict TDD).
    3. Implements minimal code changes (<150–200 LoC).
    4. Validates all Turborepo quality gates (`pnpm turbo run build lint typecheck test`).
    5. Opens PR linking the issue (`Closes #X`).
    6. Squash-merges the PR to `main`, deletes the branch, and updates the project board.
- **Concise Main Chat Reporting:** The orchestrator agent outputs clean summaries after each phase: phase completed, PRs merged, issues closed, and test pass counts.

### 4. Constitutional Quality Gates (Non-Negotiable)
- **Zero Direct Pushes to `main`:** All code and doc changes must arrive via feature branches and Pull Requests.
- **Diff Size Enforcement:** Net pull request diffs must remain strictly under 150–200 lines of code.
- **Strict TDD:** Tests must exist and fail before implementation code is committed. 100% test pass rate required.
- **Zero Warnings / Zero Errors:** Clean execution across Turborepo build, lint (`eslint`), typecheck (`tsc`), and tests (`vitest`).
- **Multi-Tenant Security:** Enforce multi-tenant isolation (`agency_id`) and isolate Cloudflare Workers edge runtimes from Node.js dependencies.

---

## Agent Configuration Directories

- **Rules (`.agents/rules/`):** Repository standards, architectural constraints, security guidelines, and behavioral rules.
- **Skills (`.agents/skills/`):** Predefined Spec Kit playbooks and automation commands.
- **Sub-Agents (`.agents/agents/`):** Role profiles, specialized instructions, and capabilities for discrete sub-agents.
