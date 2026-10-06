---
task_id: TASK-0000
spec_id: SPEC-0000
spec_version: "v1.0" # or git commit SHA of parent spec when task was generated
title: "Subsystem or Component Implementation Step"
status: ready # backlog | ready | in-progress | in-review | done
assigned_agent: "none" # human | antigravity | claude | copilot | other
complexity: S # XS | S | M | L
pr_number: ""
---

# TASK-0000: Subsystem or Component Implementation Step

## Parent Specification
- **Spec:** [SPEC-0000](../0000-feature-name.md)
- **Spec Version / Commit:** v1.0 (Guarantees execution against the exact approved revision)
- **Phase:** Implementation
- **Goal:** Implement a discrete, atomic slice of the parent specification that can be built, tested, and reviewed independently.

---

## 1. Objective & Context
*Provide a concise summary of what this task delivers and which specific sections of the parent spec it implements.*

- Target Spec Section: Section 4.2 & 4.3 (Data Models & Contracts)

---

## 2. Requirements & Invariants
- [ ] Implement interface `X` strictly conforming to `SPEC-0000#section-4.3`.
- [ ] Add domain validation rules ensuring `name` length is between 1 and 100 characters.
- [ ] Guarantee zero side effects on unauthenticated calls.

---

## 3. Scope of Work (File Boundaries)
> [!NOTE]
> AI agents must restrict modifications strictly to these files. If additional files are required, you MUST follow the **Scope Boundary Extension Protocol (SBEP)**:
> - Barrel / re-export files (<15 LoC): Allowed if documented in PR under SBEP.
> - New files / cross-cutting logic: Halt, mark `ai:blocked`, and post SBEP request.

- **Files to Create:**
  - `src/domain/entity.ts`
  - `tests/domain/entity.test.ts`
- **Files to Modify:**
  - `src/domain/index.ts`
- **Forbidden Files:**
  - Database migration files, infra config, unrelated controllers.

---

## 4. Verification Recipe
Run these commands in order. Every single command must succeed before this task is marked complete:

```bash
# 1. Typecheck & Lint
npm run typecheck
npm run lint

# 2. Focused Unit Tests
npm test -- tests/domain/entity.test.ts

# 3. Full Test Suite Regression Check
npm test
```

---

## 5. Definition of Done (DoD) & Clean Code Checklist
- [ ] **TDD Red-Green-Refactor:** Failing unit test written and verified before implementation code.
- [ ] **Atomic Task Size:** Net diff is strictly within target window (50–150 LoC; hard ceiling 200 LoC). If >200 LoC, halt and trigger Task Splitting Protocol.
- [ ] **Function Budget:** Every function is under 30 lines and adheres to Single Responsibility.
- [ ] **Typed Error Handling:** Uses explicit domain error classes; zero generic `throw new Error()` or untyped catches.
- [ ] **Zero Magic Values:** Status codes, regexes, and thresholds are declared as typed constants or enums.
- [ ] **Zero Slop:** No leftover `console.log`, `print()`, unhandled `TODO` stubs, or untyped `any`.
- [ ] **Clean Verification:** 0 type errors, 0 linter warnings, 100% test pass on verification recipe.
- [ ] **Scope Enforced:** Changes restricted strictly to allowed files (or approved SBEP extensions).
- [ ] **PR Ready:** PR created with scrubbed terminal test logs attached.

