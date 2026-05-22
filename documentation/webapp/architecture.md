# Webapp Architecture

## Goals

- Keep routing and presentation in `app/*`.
- Keep business logic in `server/services/*`.
- Keep database access in `server/repositories/*`.
- Keep request/response contracts in `contracts/*`.
- Keep reusable domain slices in `features/*`.

## Folder Responsibilities

- `webapp/src/app`
  - Route composition, layouts, page-level loading states.
  - No deep business logic.
- `webapp/src/app/api/v1`
  - Versioned HTTP interface for UI and future clients.
  - Auth, validation, and response handling.
- `webapp/src/server/services`
  - Domain orchestration and workflows.
- `webapp/src/server/repositories`
  - Supabase table access and persistence details.
- `webapp/src/server/integrations`
  - External API clients (Facebook Graph).
- `webapp/src/contracts`
  - Shared schemas and API shapes.
- `webapp/src/features`
  - Feature-local UI, types, schemas, and adapters.

## Runtime and Deployment

- Public pages and marketing routes prioritize static rendering where possible.
- Supabase/session-heavy routes and external integrations use Node.js runtime on Vercel.
- Proxy entrypoint (`webapp/src/proxy.ts`) remains focused on auth/session and subdomain routing, with public-path short-circuiting.
- Facebook OAuth is handled via `/api/v1` callback/start endpoints with server-side redirects and service-layer processing.
