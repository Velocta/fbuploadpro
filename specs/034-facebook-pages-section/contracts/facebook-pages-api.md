# API Contracts: Spec 032 — Facebook Pages Management

## 1. `GET /api/tenant/[subdomain]/pages`
Lists all non-disconnected Facebook Pages belonging to the authenticated tenant user.

**Response (`200 OK`)**:
```json
{
  "pages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "facebookAccountId": "660e8400-e29b-41d4-a716-446655440111",
      "accountDisplayName": "Alex Rivera",
      "fbPageId": "1092837465",
      "pageName": "Viral Cinema Daily",
      "profilePictureUrl": "https://scontent.xx.fbcdn.net/...",
      "category": "Media/News Company",
      "startingFollowers": 12000,
      "currentFollowers": 14500,
      "followersGained": 2500,
      "followersCount": 14500,
      "status": "active",
      "tasks": ["MANAGE", "CREATE_CONTENT"],
      "createdAt": "2026-10-10T12:00:00.000Z",
      "updatedAt": "2026-10-11T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

## 2. `GET /api/tenant/[subdomain]/accounts/[accountId]/pages/discover`
Discovers Facebook Pages from Graph API v26.0 (`/me/accounts`) for the selected `accountId`, marking pages with `isImported: true` only when an active (non-disconnected) record exists in `facebook_pages`.

## 3. `POST /api/tenant/[subdomain]/pages/import`
Imports selected `selectedPageIds` for `accountId`. Sets both `starting_followers` and `current_followers` to the Graph API follower count on initial insert; on conflict, updates `current_followers` while preserving `starting_followers` (unless the page was previously `'disconnected'`, in which case `starting_followers` resets to the newly imported follower count).

## 4. `DELETE /api/tenant/[subdomain]/pages/[pageId]`
Soft-deletes a Facebook Page:
- Sets `status = 'disconnected'` and `encrypted_access_token = ''` on `facebook_pages`.
- Updates any `'queued'` items in `queue_items` for that Page to `'cancelled'`.
- Preserves historical `publish_logs` and `page_insights_daily_snapshots`.
