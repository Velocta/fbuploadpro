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
  - Key services: `facebook/direct-post-service.ts`, `facebook/direct-schedule-service.ts`, `facebook/inapp-schedule-service.ts`, `tokens/token-cost-service.ts`, `uploads/presign-service.ts`.
- `webapp/src/server/repositories`
  - Supabase table access and persistence details.
- `webapp/src/server/integrations`
  - External API clients (Facebook Graph, page publishing).
  - `facebook/graph-client.ts` — low-level Graph requests.
  - `facebook/page-publish.ts` — page token resolution and publish methods.
- `webapp/src/contracts`
  - Shared schemas and API shapes.
- `webapp/src/features`
  - Feature-local UI, types, schemas, and adapters.
  - `facebook/shared/media-upload.ts` — presigned upload helper for client components.
- `webapp/src/lib/r2`
  - R2 presigned URL generation, object key building, object deletion.
- `webapp/src/components/dashboard`
  - `shell.tsx` — `SidebarProvider` layout (shadcn/ui Sidebar).
  - `app-sidebar.tsx` — role-based sidebar (agency groups + super-admin flat nav).
  - `nav-config.ts` — navigation trees; `nav-user.tsx` — footer (tokens, user, sign out).
  - `coming-soon.tsx` — reusable shell placeholder.

## Route Structure (Agency)

```
/agency                           → Dashboard overview
/agency/facebook/accounts         → FB account management
/agency/facebook/auto-download-upload  → ADU pages list
/agency/facebook/auto-download-upload/[id] → ADU page detail
/agency/facebook/bulk-delete      → Bulk post deletion tool
/agency/facebook/direct-post      → Publish immediately
/agency/facebook/direct-schedule  → Native FB scheduling
/agency/facebook/direct-schedule/pages → Manage saved pages
/agency/facebook/inapp-schedule   → Queue-based scheduling
/agency/facebook/inapp-schedule/pages  → Manage saved pages
/agency/youtube/*                 → Coming Soon shells
/agency/instagram/*               → Coming Soon shells
/agency/settings                  → Settings landing
/agency/settings/facebook-byoc    → Facebook BYOC app config
/agency/settings/youtube-byoc     → Coming Soon shell
/agency/settings/instagram-byoc   → Coming Soon shell
```

## Runtime and Deployment

- Public pages and marketing routes prioritize static rendering where possible.
- Supabase/session-heavy routes and external integrations use Node.js runtime on Vercel.
- Proxy entrypoint (`webapp/src/proxy.ts`) handles auth/session and subdomain routing.
- Facebook OAuth is handled via `/api/v1` callback/start endpoints with server-side redirects and service-layer processing.
- Token gating is handled in the sidebar UI (lock icons when balance=0), not via hard middleware redirects.
