# Git Workflow & Commit Conventions

> **Deterministic, Traceable Git Operations for Human and AI Developers**

---

## 1. Branching Strategy

Our Git branching strategy enforces strict separation between **spec creation** and **feature implementation**.

```text
main (always releasable, approved specs + verified code)
  │
  ├── spec/0002-oauth-authentication  ──► (Drafting & review of SPEC-0002)
  │     └─► Merged to main when approved
  │
  └── feat/SPEC-0002-TASK-0001-jwt-model ──► (AI agent implementing task 1)
        └─► Merged to main via PR after passing verification recipe
```

### 1.1 Branch Naming Conventions

| Branch Type | Format | Example |
| :--- | :--- | :--- |
| **Spec Drafting** | `spec/<spec-id>-<short-slug>` | `spec/0002-oauth-auth` |
| **Feature / Task** | `feat/<spec-id>-<task-id>-<short-slug>` | `feat/SPEC-0002-TASK-0001-jwt` |
| **Defect / Bug** | `fix/<spec-id>-<issue-id>-<short-slug>` | `fix/SPEC-0001-issue-4-typo` |
| **Documentation** | `docs/<short-slug>` | `docs/update-project-guide` |
| **Chores / Tooling** | `chore/<short-slug>` | `chore/upgrade-linter` |

---

## 2. Conventional Commit Standard

All commit messages must strictly conform to [Conventional Commits](https://www.conventionalcommits.org/) and reference the parent specification in the scope.

### 2.1 Format
```text
<type>(<spec-id>): <short imperative description>

[optional body: explanation of intent and architectural decisions]

[optional footer: Resolves #<issue-id>]
```

### 2.2 Allowed Types
- `feat`: A new feature or capability defined in a spec.
- `fix`: A bug fix or defect correction against a spec contract.
- `spec`: Changes to specification files (`specs/**`).
- `test`: Adding missing tests or refactoring test suites.
- `docs`: Documentation updates outside `specs/`.
- `refactor`: Code change that neither fixes a bug nor adds a feature.
- `perf`: Code change that improves performance without altering spec contracts.
- `chore`: Changes to build process, tooling, or dependencies.

### 2.3 Good vs. Bad Commit Examples

| Status | Message | Reason |
| :--- | :--- | :--- |
| ✅ Good | `feat(spec-0001): add issue templates for specs and tasks` | Clear type, spec scope, concise imperative description |
| ✅ Good | `test(spec-0002): add unit tests for token expiration` | Directly relates to spec acceptance criteria |
| ❌ Bad | `fixed bug` | No type, no scope, vague |
| ❌ Bad | `WIP on agent changes` | Incomplete, non-conventional |
| ❌ Bad | `feat: added stuff to user controller` | Missing spec scope, past tense verb |

---

## 3. Pull Request Guidelines

1. **Keep PRs Atomic:**
   - Ideally < 150-200 lines of code change (target: 50-150 LoC).
   - One PR = One Task (`TASK-XXXX`).
2. **Always Link Spec and Issue:**
   - The PR body must reference the `SPEC-XXXX` and `Resolves #<issue-id>`.
3. **Attach Execution Proof:**
   - Terminal logs showing test results and linter runs must be pasted into the PR description.
4. **Merge Strategy:**
   - **Squash and Merge** is the default for feature tasks to maintain a clean, linear `main` history.
   - Commit title on squash should match the conventional commit format.
