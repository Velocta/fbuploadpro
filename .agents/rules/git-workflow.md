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

## 3. Human Approval Gate Before Committing & GitHub Issues Exemption
- **Standard Feature Development**: Autonomous commits without explicit human confirmation are prohibited. The agent MUST propose the commit summary and receive approval before executing `git commit`.
- **GitHub Issues Exemption**: When resolving GitHub issues (e.g. audit-fix, bug fixes, or backlog issues), the agent is explicitly authorized to stage and commit changes autonomously without asking for permission, once local quality checks pass.
- **Deferred Test Verification**: Automated tests do NOT need to be run on intermediate turns or scratch iterations. Tests are only run when preparing to commit, prior to presenting the commit for review, or when explicitly requested by the user.

## 4. Pull Request Requirements & Creation Gate
- **Approval Gate**: For standard feature workflows, ask the user before creating any Pull Request (`gh pr create`). When working on GitHub issues, autonomous PR creation is authorized.
- **Atomic Diffs**: Net pull request diffs must remain strictly under 150–200 lines of code.
- **Traceability**: Reference the active specification ID from `specs/` and associated GitHub Issue (`Closes #X`).
- **Quality Gates**: All automated checks (`pnpm turbo run build lint typecheck test` and `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`) must pass with 100% test pass rate and 0 errors/warnings prior to creating PRs.

## 5. Documentation Synchronization in the Same PR (Never Separate Docs PRs)
- All documentation updates under `docs/` (e.g., updating roadmap milestone statuses in `docs/foundational-knowledge.md`, architecture diagrams, environment configurations, and API contracts) MUST ALWAYS be included and committed directly in the SAME Pull Request as the feature, fix, or code modifications.
- AI agents and engineers MUST NEVER create separate, standalone Pull Requests solely for documentation synchronization. Code and documentation must ship together atomically in one PR.

## 6. PR Merging & Quality / SonarQube Gates
- **Standard Feature Merges**: Require explicit human approval before executing `gh pr merge`.
- **GitHub Issues Autonomous Merge Exemption**: For GitHub issues, the agent is authorized to merge autonomously via `gh pr merge --squash --delete-branch` WITHOUT asking for permission, PROVIDED THAT:
  1. All local quality gates (`pnpm turbo run build lint typecheck test` and `cargo check`) pass cleanly with zero errors.
  2. All CI checks and SonarQube Cloud quality gate scans (`.github/workflows/sonar.yml`) pass with zero blocking issues before merging.
- If UI components are modified, obtain and share the live Vercel Preview Deployment URL for interactive review.
