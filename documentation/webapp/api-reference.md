# Webapp API Reference (v1)

Base path: `/api/v1`

## Auth Model

- Session auth is cookie-based through Supabase.
- Role checks:
  - `agency`
  - `super_admin`
- API guards return:
  - `401` for unauthenticated
  - `403` for authenticated but insufficient role

## Agency Endpoints

- `GET /api/v1/agency/facebook/accounts`
  - Role: `agency`
  - Returns: `{ accounts: [...] }`

- `DELETE /api/v1/agency/facebook/accounts/:id`
  - Role: `agency`
  - Returns: `{ success: true }`

- `GET /api/v1/agency/facebook/accounts/:id/pages`
  - Role: `agency`
  - Returns: `{ pages: [...] }`

- `GET /api/v1/agency/facebook/oauth/start`
  - Role: `agency`
  - Query: `reconnectAccountId?`
  - Behavior: server-side redirect to Facebook OAuth dialog.

- `POST /api/v1/agency/facebook/oauth/magic-link`
  - Role: `agency`
  - Body: `{ reconnectAccountId?: string }`
  - Returns: `{ url: string }`

- `GET /api/v1/agency/facebook/oauth/callback`
  - Role: `agency` (cookie session)
  - Query: `code`, `state?`
  - Behavior: processes OAuth and redirects to `/agency/facebook/callback?status=...`.

- `GET /api/v1/agency/usage/export.csv`
  - Role: `agency | super_admin`
  - Returns: CSV attachment (`text/csv`)

- `PATCH /api/v1/agency/settings/facebook-app`
  - Role: `agency`
  - Body: `{ fb_app_id: string, fb_app_secret: string }`
  - Returns: `{ success: true, appName: string }`

- `DELETE /api/v1/agency/settings/facebook-app`
  - Role: `agency`
  - Returns: `{ success: true }`

## Public OAuth Endpoints

- `GET /api/v1/public/facebook/oauth/start`
  - Query: `token`
  - Behavior: validates signed magic token and redirects to Facebook OAuth dialog.

- `GET /api/v1/public/facebook/oauth/callback`
  - Query: `code`, `state?`
  - Behavior: processes magic OAuth callback and redirects to `/fb-callback?status=...`.

## Admin Endpoints

- `GET /api/v1/admin/settings/token-price`
  - Role: `super_admin | agency`
  - Returns: `{ tokenPrice: number }`

- `PATCH /api/v1/admin/settings/token-price`
  - Role: `super_admin`
  - Body: `{ tokenPrice: number }`
  - Returns: `{ success: true }`

## Legacy Compatibility

- `GET /api/agency/usage-csv` remains available as a compatibility redirect (HTTP 307) to `GET /api/v1/agency/usage/export.csv`.
