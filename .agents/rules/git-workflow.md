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
