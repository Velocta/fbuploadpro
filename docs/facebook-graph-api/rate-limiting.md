# Facebook Graph API — Rate Limiting & Throttle Codes Reference

**Source**: [`https://developers.facebook.com/docs/graph-api/overview/rate-limiting`](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)

> [!IMPORTANT]
> **Distinction Between API Volume Rate Limits vs. `fb_rate_limited` (`368`)**:
> In FBUploadPro, `facebook_pages.status = 'fb_rate_limited'` is reserved **exclusively** for Pages that receive **Error Code `368`** (`Temporarily blocked for policies violations`).
> All API call volume rate limits documented on this page (`4`, `17`, `32`, `613`, `80000`–`80014`) are **transient HTTP call throttles** — both `facebook_accounts.status` and `facebook_pages.status` remain **`'active'`**, and the worker/caller simply backs off and retries the request.

---

## 1. How Facebook Rate Limits Apply to FBUploadPro

Facebook enforces two distinct rate-limiting engines depending on the endpoint and the type of access token used:

1. **Platform Rate Limits**:
   - Applied to Graph API calls made with a **User Access Token** (such as `GET /v26.0/me` and `GET /v26.0/me/accounts` during OAuth connection and Page discovery) or an **Application Access Token**.
   - **Application Formula**: `Calls within 1 hour = 200 * Number of Daily Active Users (DAU)`.
   - **User Formula**: Tracked per Facebook user across a rolling 1-hour window (shared across all apps the user uses).
   - **HTTP Header**: `X-App-Usage` containing `call_count`, `total_cputime`, and `total_time` (each expressed as an integer percentage `0–100`; throttling begins when any metric reaches `100`).

2. **Business Use Case (BUC) Rate Limits**:
   - Applied to **Pages API** calls made with a **Page Access Token** (such as publishing posts, uploading media, and fetching Page insights in FBUploadPro), as well as Marketing API, Instagram, Messenger, LeadGen, and WhatsApp endpoints.
   - **Pages API Formula (Page Access Token)**: `Calls within 24 hours = 4800 * Number of Engaged Users` (where Engaged Users is the number of users who engaged with the Page per 24 hours).
   - **HTTP Header**: `X-Business-Use-Case-Usage` containing per-object arrays with `type` (`pages`, `ads_insights`, `ads_management`, etc.), `call_count` (%), `total_cputime` (%), `total_time` (%), and `estimated_time_to_regain_access` (minutes until throttling ends).

---

## 2. Platform Throttle Error Codes

| Error Code | Subcode | Official Description | `facebook_accounts.status` | `facebook_pages.status` | FBUploadPro Handling Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`4`** | — | Indicates that the **app** whose token is being used in the request has reached its rate limit (`200 * Users` per hour). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Handled in `evaluateGraphApiError(4)`. Transient (`isTransient = true`, `requiresReauth = false`). Keep account and Page `'active'`, inspect `X-App-Usage`, and back off worker retries until usage drops below 100%. |
| **`17`** | *(none)* | Indicates that the **User** whose token is being used in the request has reached their rate limit (rolling 1-hour window). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Handled in `evaluateGraphApiError(17)`. Transient (`isTransient = true`, `requiresReauth = false`). Keep account and Page `'active'`, and retry after backoff. |
| **`17`** | **`2446079`** | Indicates that the token being used in the Ads API v3.3 or older request has reached its rate limit. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient rate limit. Keep account and Page `'active'`. |
| **`32`** | — | Indicates that the **User or app** whose token is being used in the **Pages API** request has reached its rate limit (`(#32) Page request limit reached`). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Handled in `evaluateGraphApiError(32)`. Transient (`isTransient = true`, `requiresReauth = false`). Keep account and Page `'active'` and reschedule the queue item for retry. |
| **`613`** | *(none)* | Indicates that a **custom rate limit** has been reached on the specific API endpoint being called. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Handled in `evaluateGraphApiError(613)`. Transient (`isTransient = true`, `requiresReauth = false`). Keep account and Page `'active'` and retry after backoff. |
| **`613`** | **`1996`** | Indicates that Facebook noticed **inconsistent behavior in the API request volume** of your app (e.g., sudden traffic spikes from recent changes). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient spike throttle. Keep account and Page `'active'`, and smooth out worker dispatch concurrency. |

---

## 3. Facebook Stability Throttle Codes (`#stability-throttle-codes`)

When queries are overly complex or trigger excessive backend QPS on Meta's infrastructure, Graph API responses may include stability throttle metadata:

| Stability Key | Values / Fields | Official Meaning & Remediation | `facebook_accounts.status` | `facebook_pages.status` |
| :--- | :--- | :--- | :--- | :--- |
| **`throttled`** | `True`, `False` | Indicates whether the query was throttled by Facebook's stability protection layer. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* |
| **`backend_qps`** | `actual_score`, `limit`, `more_info` | First throttling factor. Queries require too many backend requests to handle. Send fewer queries or simplify queries with narrower time ranges and fewer object IDs. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* |
| **`complexity_score`** | `actual_score`, `limit`, `more_info` | Second throttling factor. High `complexity_score` means queries request large amounts of data or deep field expansions. Split complex queries into smaller queries and space them out. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* |

---

## 4. Business Use Case (BUC) Rate Limit Error Codes (`#buc-rate-limits`)

When a Page, Ad Account, Instagram Account, or Business asset reaches its BUC quota, Facebook returns the following error codes:

| Error Code | Subcode | BUC Rate Limit Type | Quota Window & Formula | `facebook_accounts.status` | `facebook_pages.status` | FBUploadPro Handling Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`80001`** | — | **Pages** (calls made with a **Page** or **System User** access token) | Rolling 24h: `4800 * Engaged Users` | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Transient Page API Quota Limit**. Keep both `facebook_accounts.status` and `facebook_pages.status` as `'active'`. Read `estimated_time_to_regain_access` (minutes) from `X-Business-Use-Case-Usage` header and reschedule the queue item for retry after cooldown. |
| **`32`** | — | **Pages** (calls made with a **User** access token) | Rolling 1h Platform User/App limit | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Keep both `facebook_accounts.status` and `facebook_pages.status` as `'active'`. |
| **`80006`** | — | **Messenger** | Rolling 24h: `200 * Engaged Users` (Conversations: 2/sec/Page; Send API: 300/sec text, 10/sec audio/video; Private Replies: 750/hr) | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Keep both `facebook_accounts.status` and `facebook_pages.status` as `'active'`. |
| **`80000`** | **`2446079`** | **Ads Insights** | Rolling 1h: Standard `600 + 400 * Active Ads - 0.001 * User Errors`; Advanced `190000 + 400 * Active Ads - 0.001 * User Errors` | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient BUC throttle. Keep account and Page `'active'`. |
| **`80004`** | **`2446079`** | **Ads Management** | Rolling 1h: Standard `300 + 40 * Active Ads`; Advanced `100000 + 40 * Active Ads` | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient BUC throttle. Keep account and Page `'active'`. |
| **`80003`** | **`2446079`** | **Custom Audience** | Rolling 1h (max 700,000): Standard `5000 + 40 * Active Custom Audiences`; Advanced `190000 + 40 * Active Custom Audiences` | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient BUC throttle. Keep account and Page `'active'`. |
| **`80002`** | — | **Instagram Platform** | Rolling 24h: `4800 * Impressions` | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient BUC throttle. Keep account and Page `'active'`. |
| **`80005`** | — | **LeadGen** | Rolling 24h: `4800 * Leads Generated (past 90d)` | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient BUC throttle. Keep account and Page `'active'`. |
| **`80008`** | — | **WhatsApp Business Management API (WABA)** | Rolling 1h: `200/hr` default (`5000/hr` for active WABA) | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient BUC throttle. Keep account and Page `'active'`. |
| **`80009`** | — | **Catalog Management** | Rolling 1h: `20,000 + 20,000 * log2(DA impressions + PDP visits)` | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient BUC throttle. Keep account and Page `'active'`. |
| **`80014`** | — | **Catalog Batch** | Rolling 1m: `8 + 8 * log2(DA impressions + PDP visits)` | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Transient BUC throttle. Keep account and Page `'active'`. |

---

## 5. Rate Limit HTTP Response Headers Reference

### 5.1 `X-App-Usage` (Platform Rate Limits)

```json
{
  "call_count": 28,
  "total_time": 25,
  "total_cputime": 25
}
```

### 5.2 `X-Business-Use-Case-Usage` (BUC / Page Rate Limits)

```json
{
  "{business-object-or-page-id}": [
    {
      "type": "pages",
      "call_count": 97,
      "total_cputime": 23,
      "total_time": 23,
      "estimated_time_to_regain_access": 0
    }
  ]
}
```

- **Key Rule**: Never transition `facebook_accounts.status` or `facebook_pages.status` on API call volume rate-limit errors (`4`, `17`, `32`, `341`, `613`, `80000`–`80014`) — both remain **`'active'`**, and the queue item is retried after backoff. Only **Error Code `368`** (Page policy block) sets `facebook_pages.status = 'fb_rate_limited'`.
