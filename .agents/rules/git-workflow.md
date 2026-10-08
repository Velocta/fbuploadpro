# Agent Git & Version Control Guidelines

## 1. Branching Strategy
- Direct commits to `main` are strictly forbidden. All modifications must be delivered via dedicated feature branches.
- Branch naming convention: `<type>/<spec-id>-<short-description>`
  - Examples: `feat/005-publishing-engine`, `fix/002-jwt-expiry`, `chore/001-deps-upgrade`.

## 2. Commit Message Standards
Follow Conventional Commits:
- `feat(scope): add new capability`
- `fix(scope): resolve bug or edge case`
- `refactor(scope): internal reorganization without behavior change`
- `test(scope): add or improve test coverage`
- `docs(scope): updates to specs, plans, or documentation`

## 3. Pull Request Requirements
- **Atomic Diffs**: Net pull request diffs must remain strictly under 150–200 lines of code.
- **Traceability**: Reference the active specification ID from `specs/` and associated GitHub Issue (`Closes #X`).
- **Quality Gates**: All automated checks (`pnpm turbo run build lint typecheck test`) must pass with 100% test pass rate and 0 errors/warnings prior to requesting review.

## 4. Documentation Synchronization
- Every pull request or merge to `main` must include synchronized updates to `docs/` (e.g., updating roadmap milestone statuses in `docs/foundational-knowledge.md`, architecture diagrams, environment configurations, and API contracts) to prevent documentation drift.

## 5. Mandatory Human Approval Gate Prior to Merging
- Autonomous merges or auto-merging without explicit human confirmation are strictly prohibited.
- Before merging any PR into `main`, the agent MUST:
  1. Ensure 100% CI checks and Quality Gates pass with zero errors.
  2. If the PR modifies or adds UI components: launch `apps/showroom` on port 3001, generate an ephemeral Cloudflare tunnel, and provide the live link for user testing.
  3. Formally request human approval in chat (*"PR #X is verified and ready. May I proceed with merging into main?"*).
  4. Wait for explicit human confirmation before executing `gh pr merge`. Even if no frontend code is present, NEVER merge without human approval.
