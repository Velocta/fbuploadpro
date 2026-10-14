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
- **GitHub Issues Exemption**: When resolving GitHub issues (e.g. audit-fix, bug fixes, or backlog issues), the agent is explicitly authorized to stage and commit changes autonomously without asking for permission.
- **Elimination of Local Builds & Checks**: Automated test suites, linting, typechecking, and builds are NOT executed locally by agents prior to committing. Verification is offloaded to remote GitHub Actions CI upon opening the Pull Request.

## 4. Pull Request Requirements & Creation Gate
- **Approval Gate**: For standard feature workflows, ask the user before creating any Pull Request (`gh pr create`). When working on GitHub issues, autonomous PR creation is authorized.
- **Atomic Diffs**: Net pull request diffs must remain strictly under 150–200 lines of code.
- **Traceability**: Reference the active specification ID from `specs/` and associated GitHub Issue (`Closes #X`).
- **Elimination of Local Builds & Checks**: AI agents MUST NOT execute full local builds or test suites (`pnpm turbo run build lint typecheck test`, `cargo check`) prior to commit or opening PRs. Quality validation, builds, and test executions are offloaded to GitHub Actions CI upon opening the Pull Request.

## 5. Documentation Synchronization in the Same PR (Never Separate Docs PRs)
- All documentation updates under `docs/` (e.g., updating roadmap milestone statuses in `docs/foundational-knowledge.md`, architecture diagrams, environment configurations, and API contracts) MUST ALWAYS be included and committed directly in the SAME Pull Request as the feature, fix, or code modifications.
- AI agents and engineers MUST NEVER create separate, standalone Pull Requests solely for documentation synchronization. Code and documentation must ship together atomically in one PR.

## 6. PR Merging & Quality / SonarQube Gates
- **Standard Feature Merges**: Require explicit human approval before executing `gh pr merge`.
- **GitHub Issues Autonomous Merge Exemption**: For GitHub issues, the agent is authorized to merge autonomously via `gh pr merge --squash --delete-branch` WITHOUT asking for permission, PROVIDED THAT:
  1. All GitHub Actions CI checks (`CI Quality Gates/Build, Lint, Typecheck & Test`) pass cleanly with 100% success and zero errors.
  2. All SonarQube Cloud quality gate scans (`.github/workflows/sonar.yml`) pass cleanly with zero blocking issues before merging.
- If UI components are modified, obtain and share the live Vercel Preview Deployment URL for interactive review.
- **Post-Merge Main Repo Checks (Supabase Migrations Gate)**: If a merged Pull Request includes any SQL migration files under `supabase/migrations/**`, the agent MUST check the status of post-merge deployment workflows on `main` (specifically `Deploy Supabase Migrations` via `gh run list --workflow "Deploy Supabase Migrations" --branch main --limit 1` or `gh run watch`) and verify that database migrations apply with 100% success and 0 errors. If the deployment fails, the agent must immediately inspect `gh run view --log-failed` and remediate any database migration or workflow failure. If a PR does NOT contain SQL migration files, post-merge migration checks on `main` may be skipped.
