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

## 3. Mandatory Human Approval Gate Before Committing
- Autonomous commits without explicit human confirmation are strictly prohibited.
- The agent MUST propose the commit summary and receive explicit, unambiguous approval from the user before executing `git commit`.
- **Deferred Test Verification**: Automated tests do NOT need to be run on intermediate turns or scratch iterations. Tests are only run when preparing to commit, prior to presenting the commit for review, or when explicitly requested by the user.

## 4. Pull Request Requirements & Creation Gate
- **Mandatory Approval Before PR Creation**: The agent MUST ask the user and receive explicit approval before creating any Pull Request (`gh pr create`).
- **Atomic Diffs**: Net pull request diffs must remain strictly under 150–200 lines of code.
- **Traceability**: Reference the active specification ID from `specs/` and associated GitHub Issue (`Closes #X`).
- **Quality Gates**: All automated checks (`pnpm turbo run build lint typecheck test` and `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`) must pass with 100% test pass rate and 0 errors/warnings prior to requesting review.

## 5. Documentation Synchronization in the Same PR (Never Separate Docs PRs)
- All documentation updates under `docs/` (e.g., updating roadmap milestone statuses in `docs/foundational-knowledge.md`, architecture diagrams, environment configurations, and API contracts) MUST ALWAYS be included and committed directly in the SAME Pull Request as the feature, fix, or code modifications.
- AI agents and engineers MUST NEVER create separate, standalone Pull Requests solely for documentation synchronization. Code and documentation must ship together atomically in one PR.

## 6. Mandatory Human Approval Gate Prior to Merging
- Autonomous merges or auto-merging without explicit human confirmation are strictly prohibited.
- Before merging any PR into `main`, the agent MUST:
  1. Ensure 100% CI checks and Quality Gates pass with zero errors.
  2. If the PR modifies or adds UI components: obtain the live Vercel Preview Deployment URL for the PR and share it in chat for user review and interactive testing.
  3. Formally request human approval in chat (*"PR #X is verified and ready. May I proceed with merging into main?"*).
  4. Wait for explicit human confirmation before executing `gh pr merge`. Even if no frontend code is present, NEVER merge without human approval.
