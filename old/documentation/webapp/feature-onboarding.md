# Feature Onboarding (Webapp)

Use this checklist whenever you add a new feature.

## 1) Define Contracts First

- Add schemas/types in `webapp/src/contracts`.
- Define request/response shape and expected errors.

## 2) Add Server Workflow

- Add or extend service in `webapp/src/server/services`.
- Add repository methods in `webapp/src/server/repositories` if DB changes are needed.
- Add integration client helpers in `webapp/src/server/integrations` if external API is needed.

## 3) Expose HTTP Interface

- Add endpoint under `webapp/src/app/api/v1`.
- Apply role checks through shared guards.
- Return consistent JSON responses (or explicit file formats like CSV).

## 4) Compose in App Routes

- Keep route files in `webapp/src/app` focused on page composition.
- Move feature-specific UI into `webapp/src/features/<feature>/ui`.

## 5) Performance and Deploy Readiness

- Validate no duplicate auth/data fetch in route tree.
- Keep response payloads bounded.
- Ensure required env vars are documented in `webapp/.env.example`.
- Confirm behavior in local/preview environments before merge.
