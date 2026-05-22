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

## Agency — Facebook Accounts

- `GET /api/v1/agency/facebook/accounts`
  - Role: `agency`
  - Returns: `{ accounts: [...] }`

- `DELETE /api/v1/agency/facebook/accounts/:id`
  - Role: `agency`
  - Returns: `{ success: true }`

- `GET /api/v1/agency/facebook/accounts/:id/pages`
  - Role: `agency`
  - Returns: `{ pages: [...] }`

## Agency — Facebook OAuth

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
  - Behavior: processes OAuth and redirects to `/agency/facebook/accounts/callback?status=...`.

## Agency — Uploads (Shared)

- `POST /api/v1/agency/uploads/presign`
  - Role: `agency`
  - Body: `{ filename: string, contentType: string, feature: "direct-post" | "direct-schedule" | "inapp-schedule" }`
  - Returns: `{ uploadUrl: string, objectKey: string }`
  - Upload URL valid 30 minutes. Browser PUTs file directly to R2.

## Agency — Facebook Direct Post

- `POST /api/v1/agency/facebook/direct-post`
  - Role: `agency`
  - Body: `{ facebookAccountId, fbPageId, mediaType, caption?, firstComment?, mediaObjectKey? }`
  - Returns: `{ post: {...} }`
  - Publishes immediately to Facebook. Stores audit record in `facebook_direct_posts`.

- `GET /api/v1/agency/facebook/direct-post`
  - Role: `agency`
  - Returns: `{ posts: [...] }` (recent 50 history entries)

## Agency — Facebook Direct Schedule

- `POST /api/v1/agency/facebook/direct-schedule`
  - Role: `agency`
  - Body: `{ savedPageId, mediaType, caption?, mediaObjectKey?, scheduledAt, timezone }`
  - Returns: `{ post: {...} }`
  - Schedules natively on Facebook using `scheduled_publish_time`.

- `GET /api/v1/agency/facebook/direct-schedule`
  - Role: `agency`
  - Returns: `{ posts: [...] }`

- `DELETE /api/v1/agency/facebook/direct-schedule/:id/cancel`
  - Role: `agency`
  - Cancels the scheduled post on Facebook and marks record `cancelled`.

- `GET /api/v1/agency/facebook/direct-schedule/pages`
  - Role: `agency`
  - Returns: `{ pages: [...] }`

- `POST /api/v1/agency/facebook/direct-schedule/pages`
  - Role: `agency`
  - Body: `{ facebookAccountId, fbPageId, fbPageName, fbPageImage?, fbPageAccessToken }`
  - Returns: `{ page: {...} }`

- `DELETE /api/v1/agency/facebook/direct-schedule/pages?id=...`
  - Role: `agency`

## Agency — Facebook InApp Schedule

- `POST /api/v1/agency/facebook/inapp-schedule`
  - Role: `agency`
  - Body: `{ savedPageId, mediaType, caption?, firstComment?, mediaObjectKey?, scheduledAt, timezone }`
  - Returns: `{ post: {...} }`
  - Queues post for our backend worker to publish at the scheduled time.

- `GET /api/v1/agency/facebook/inapp-schedule`
  - Role: `agency`
  - Returns: `{ posts: [...] }`

- `PATCH /api/v1/agency/facebook/inapp-schedule/:id`
  - Role: `agency`
  - Body: `{ caption?, scheduledAt?, timezone? }`
  - Edit lock: cannot edit within 5 minutes of scheduled time.

- `DELETE /api/v1/agency/facebook/inapp-schedule/:id/cancel`
  - Role: `agency`
  - Only pending posts can be cancelled.

- `GET /api/v1/agency/facebook/inapp-schedule/pages`
  - Role: `agency`
  - Returns: `{ pages: [...] }`

- `POST /api/v1/agency/facebook/inapp-schedule/pages`
  - Role: `agency`
  - Body: `{ facebookAccountId, fbPageId, fbPageName, fbPageImage?, fbPageAccessToken }`
  - Returns: `{ page: {...} }`

- `DELETE /api/v1/agency/facebook/inapp-schedule/pages?id=...`
  - Role: `agency`

## Agency — Settings & Usage

- `PATCH /api/v1/agency/settings/facebook-app`
  - Role: `agency`
  - Body: `{ fb_app_id: string, fb_app_secret: string }`
  - Returns: `{ success: true, appName: string }`

- `DELETE /api/v1/agency/settings/facebook-app`
  - Role: `agency`
  - Returns: `{ success: true }`

- `GET /api/v1/agency/usage/export.csv`
  - Role: `agency | super_admin`
  - Returns: CSV attachment (`text/csv`)

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
