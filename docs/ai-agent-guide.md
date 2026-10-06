# AI Agent Orchestration & Prompting Guide

> **How to Maximize LLM Code Quality & Determinism via Spec-Driven Development**

---

## 1. The Core Principle: "Context is Currency"

LLMs do not write bad code because they lack intelligence; they write bad code because they lack **unambiguous boundary conditions**.

When you prompt an AI with:
> *"Add user authentication to my app"*

The model must guess:
- Which hashing algorithm?
- JWT or session cookies?
- In-memory, Redis, or Postgres?
- What status code on expired token?
- What are the non-goals?

The result is architectural drift and wasted developer hours.

Under **Spec-Driven Development (SDD)**, the model is fed:
1. The **Approved Spec** (`specs/0002-auth.md`) containing exact schemas and acceptance criteria.
2. The **Atomic Task** (`TASK-0001`) with strict file boundaries and verification recipes.
3. The **Universal Directives** (`AGENTS.md`).

This guarantees near-100% first-pass accuracy.

---

## 2. Standard Agent Prompt Templates

### Prompt 1: The Spec Generator Prompt
Use this prompt when starting a new capability to draft a compliant specification:

```markdown
You are an expert software architect. Draft a new specification following `specs/templates/SPEC_TEMPLATE.md`.

Feature Request:
<Paste rough user requirements or problem statement>

Constraints:
1. Strict Section 2 (Scope & Non-Goals): Deliberately identify what is out of scope to avoid agent hallucination.
2. Section 3 (Acceptance Criteria): Write at least 3 scenarios using Gherkin syntax (Given/When/Then).
3. Section 4 (Architecture): Provide concrete JSON schemas, TypeScript interfaces, and error response codes.
4. Section 6 (AI Directives): Define strict file boundaries and forbidden patterns.
5. Section 7 (Verification Plan): Specify exact test and lint commands to run.

Output only the markdown specification file.
```

---

### Prompt 2: Adversarial Spec Reviewer Prompt
Use this prompt to find ambiguities, edge cases, and security gaps before approving a spec:

```markdown
You are a Staff Principal Engineer conducting a rigorous technical review of `specs/XXXX-feature.md`.

Your mission is to find every flaw, omission, and security risk before any code is written:
1. Are edge cases (timeouts, concurrency, invalid input, rate limits) fully specified?
2. Are data models and API contracts completely typed without any ambiguous `any` or untyped fields?
3. Are the Acceptance Criteria deterministic and machine-testable?
4. Are non-goals clear enough that an autonomous agent will not over-engineer?

List required revisions as actionable bullet points.
```

---

### Prompt 3: Task Decomposition Prompt
Use this prompt to generate atomic GitHub issues from an approved spec:

```markdown
Break down the approved specification `specs/XXXX-feature.md` into atomic implementation tasks conforming to `specs/templates/TASK_TEMPLATE.md`.

Rules:
1. Each task must represent < 150-200 lines of code changes (target: 50-150 LoC).
2. Tasks must be dependency-ordered (e.g. Models/Migrations -> Tests -> Service Logic -> Integration).
3. Each task must list allowed files, forbidden files, and an exact verification command recipe.
4. Output tasks formatted for GitHub Issues.
```

---

### Prompt 4: The Task Execution Prompt
Use this prompt to dispatch an agent (Antigravity, Claude Code, Cursor) to execute a task:

```markdown
You are an autonomous software engineering agent operating under Spec-Driven Development rules (`AGENTS.md` and `specs/0001-spec-driven-development-standard.md`).

Your Task:
Implement [TASK-XXXX: Title] from parent spec [SPEC-XXXX].

Execution Steps:
1. Locate and inspect the parent spec in `specs/`.
2. Inspect target file paths: <list allowed files>. Do not modify any other files.
3. TDD First: Write failing unit/integration tests reproducing the Acceptance Criteria scenarios.
4. Implement minimal required code to make the tests pass.
5. Run the Verification Recipe:
   <Paste verification commands>
6. Format commit as: `feat(spec-XXXX): <concise summary>`
7. Output PR summary with verification logs.
```

---

## 3. Best Practices for Human Supervisors

1. **Never merge a PR without terminal test evidence:** Ensure the agent pasted output from the verification recipe into the PR.
2. **Reject scope creep immediately:** If the agent created extra helper files or dependencies outside the task boundary, request changes.
3. **Keep the Spec updated:** If an edge case is discovered during development, update the spec first (`spec(spec-XXXX): ...`), then update the code.
