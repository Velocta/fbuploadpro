# Phase 0 Research & Technical Decisions: Facebook Page Insights

**Feature**: Dedicated Facebook Page Insights & Analytics Suite
**Spec**: [specs/006-facebook-page-insights/spec.md](spec.md)

---

## 1. Facebook Graph API v26.0 Insights Endpoints

### A. Page Overview Metrics
- **Endpoint**: `GET https://graph.facebook.com/v26.0/{page-id}?fields=name,fan_count,followers_count,picture.type(large)&access_token={page_token}`
- **Metrics**:
  - `fan_count`: Total page likes
  - `followers_count`: Total followers
  - `picture`: High-resolution page profile thumbnail

### B. Time-Series Daily Insights
- **Endpoint**: `GET https://graph.facebook.com/v26.0/{page-id}/insights?metric={METRICS}&period=day&since={since}&until={until}&access_token={page_token}`
- **Active Metrics List**:
  - `page_follows`: Cumulative follower snapshot
  - `page_daily_follows_unique`: Daily new unique followers gained
  - `page_daily_unfollows_unique`: Daily unique unfollows
  - `page_media_view`: Total media views
  - `page_total_media_view_unique`: Unique media viewers
  - `page_views_total`: Total page profile views
  - `page_post_engagements`: Total post engagement actions
  - `page_total_actions`: Total page button/link clicks
  - `page_video_views`: Total video plays
  - `page_video_views_unique`: Unique video viewers
  - `page_video_complete_views_30s`: Video views >= 30 seconds (or complete video)
  - `page_video_view_time`: Total milliseconds/minutes spent watching videos
  - `page_actions_post_reactions_like_total`: Like reactions
  - `page_actions_post_reactions_love_total`: Love reactions
  - `page_actions_post_reactions_wow_total`: Wow reactions
  - `page_actions_post_reactions_haha_total`: Haha reactions
  - `page_actions_post_reactions_sorry_total`: Sad/Sorry reactions
  - `page_actions_post_reactions_anger_total`: Angry reactions

### C. Audience Demographics
- **Endpoint**: `GET https://graph.facebook.com/v26.0/{page-id}/insights?metric=page_follows_country,page_follows_city&access_token={page_token}`
- **Data Shape**:
  ```json
  {
    "data": [
      {
        "name": "page_follows_country",
        "values": [{ "value": { "US": 1250, "PK": 890, "GB": 450, "CA": 320 } }]
      },
      {
        "name": "page_follows_city",
        "values": [{ "value": { "New York, NY": 310, "Lahore, Pakistan": 290 } }]
      }
    ]
  }
  ```
- **Parsing Strategy**: Extract key-value maps, sort descending by count, slice top 7 items, calculate percentage shares relative to sum of top items.

---

## 2. Token Security & Zero Client Leakage

- In the legacy system (`old/`), raw Page access tokens were passed directly into client-side browser `fetch()` requests.
- In modern FBUploadPro:
  - Tokens are encrypted at rest with `AES-256-GCM` using the workspace secret key in PostgreSQL `facebook_pages.fb_page_access_token`.
  - Client components only ever issue requests to `GET /api/tenant/[subdomain]/pages/[pageId]/insights`.
  - The server decrypts the token in memory, performs the Graph API query, normalizes the data, and returns sanitized DTOs.
  - Zero access tokens, encryption IVs, or auth tags are ever serialized to JSON.

---

## 3. Caching & Rate-Limiting Strategy

- **Rate Limit Window**: Facebook Graph API limits calls per app/page per rolling 1-hour window.
- **Server Cache TTL**: 15 minutes (900 seconds) in-memory cache keyed by `insights:{userId}:{fbPageId}:{range}`.
- **Client Cache Headers**: `Cache-Control: private, max-age=300, stale-while-revalidate=600`.
- **Bypass Flag**: `refresh=true` query parameter allows manual user-triggered refreshes, rate-limited to at most once per 60 seconds per user.

---

## 4. Error Mapping & Health Taxonomy

When Facebook returns API errors, map them to known platform statuses:
- **Error 190 / "Invalid OAuth access token"** ➔ `invalid_token`
- **Error "Two-factor authentication required on Business Manager"** ➔ `2fa_required_on_BM`
- **Error "Log in to Facebook to confirm identity"** ➔ `fb_verification_required`
- **Error "Application request limit reached" (Code 4 / 17 / 32)** ➔ `rate_limited`
- **Error "User is suspended"** ➔ `account_suspended`
