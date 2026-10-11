# Quickstart Validation Guide: Spec 029 — Nested Media Library Explorer

## Prerequisites
- Node.js & `pnpm` installed
- Dependencies installed via `pnpm install --ignore-scripts`

## Validation Commands

1. **Run Contract & Schema Tests**:
   ```bash
   pnpm --filter @fbuploadpro/contracts test
   pnpm --filter @fbuploadpro/database test
   ```

2. **Run Web API, Security & UI Component Tests**:
   ```bash
   pnpm --filter @fbuploadpro/web test
   ```

3. **Full Monorepo Quality Gate**:
   ```bash
   pnpm turbo run build lint typecheck test
   ```

## Expected Outcomes
- All contract, database migration, backend route, security isolation, and frontend explorer UI tests pass with 0 errors.
- Navigating to `/media` from the workspace sidebar opens the Google Drive-style Media Library Explorer with breadcrumb navigation, nested subfolder creation/deletion, inline & modal caption editing, batch actions, and unified Windows-style upload progress tracking.
