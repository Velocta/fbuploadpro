## 📌 Spec & Task Linkage
- **Parent Specification:** `SPEC-XXXX` ([Link to Spec](../specs/))
- **Related Issue / Task:** Resolves #
- **Execution Agent:** `Antigravity` | `Claude Code` | `Copilot` | `Human`

---

## 🎯 Summary of Changes
<!-- Provide a clear, bulleted summary of the changes in this pull request -->
- Implemented ...
- Added tests verifying ...

---

## 📦 Scope Boundary Extensions (SBEP)
<!-- If any file outside the original task's 'Allowed Files' was modified, declare it here -->
- [ ] **No Out-of-Scope Files:** All modified files strictly match the task issue scope.
- [ ] **SBEP Exemption Applied:** (Explain reason and list files, e.g. barrel re-export <15 lines or approved by Orchestrator).

---

## 📐 Spec Conformance & Clean Code Checklist
- [ ] **Contract Compliance:** All interfaces, schemas, and return types strictly match the referenced Spec section.
- [ ] **Scope Guard:** No unrequested features or unauthorized files modified.
- [ ] **Atomic PR Size:** Net diff is within the <200 LoC ceiling (or task split was approved).
- [ ] **Clean Architecture:** Domain logic is pure and has zero dependencies on databases or HTTP routers.
- [ ] **TDD Verified:** Unit/integration tests written before implementation and verified failing first.
- [ ] **Craftsmanship Invariants:**
  - [ ] Every function is under 30 lines.
  - [ ] Explicit domain error types used (no generic `Error` or string throws).
  - [ ] Zero magic values; status codes and thresholds defined as constants/enums.
  - [ ] Zero leftover `console.log`, `print()`, unhandled `TODO` stubs, or untyped `any`.
  - [ ] **Secret Scrubbing:** All credentials, auth tokens, database URIs, and local filesystem paths scrubbed from terminal logs.
- [ ] **Zero Drift:** Documentation and types updated to eliminate drift between spec and code.

---

## 🧪 Verification & Evidence (Mandatory for AI Agents)
<!-- Paste the actual terminal output from running the verification recipe -->

### 1. Test Suite Execution
```text
# Paste test run output here (e.g., npm test / pytest / cargo test)
```

### 2. Linter & Static Analysis
```text
# Paste lint/typecheck output here (e.g., npm run lint && npm run typecheck)
```

---

## 🔍 Reviewer Checklist (Human-in-the-Loop)
- [ ] Pull request branch adheres to naming convention (`feat/<spec-id>-<task-id>-...` or `spec/<id>...`).
- [ ] Commit history is clean and uses Conventional Commits format (`type(scope): description`).
- [ ] No extraneous file changes or auto-generated configuration noise.
- [ ] Security & input sanitization verified.
