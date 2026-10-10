# Facebook Graph API v26.0 — Error Codes, Rate Limits & Account Status Mapping

This directory contains the authoritative reference for **Facebook Graph API v26.0** error codes, authentication subcodes, rate-limiting throttles, and `/user` (`/me`) node errors, alongside their exact mapping to FBUploadPro's internal `facebook_accounts.status` and `facebook_pages.status` domain state machines.

## Official Meta Documentation Sources

1. **[Error Handling Guide](./error-handling.md)** — Extracted from [`https://developers.facebook.com/docs/graph-api/guides/error-handling`](https://developers.facebook.com/docs/graph-api/guides/error-handling)
2. **[Rate Limiting Overview](./rate-limiting.md)** — Extracted from [`https://developers.facebook.com/docs/graph-api/overview/rate-limiting`](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)
3. **[User Node Reference (`/user` / `/me`)](./user-node-reference.md)** — Extracted from [`https://developers.facebook.com/docs/graph-api/reference/user`](https://developers.facebook.com/docs/graph-api/reference/user)

---

## 1. FBUploadPro Account & Page Status Values

### 1.1 `facebook_accounts.status` (`FacebookAccountStatusSchema`)

Defined in [`packages/contracts/src/domain/facebook.ts`](../../packages/contracts/src/domain/facebook.ts) and enforced via `CHECK (status IN ('active', 'expired', 'disconnected'))` on the `facebook_accounts` PostgreSQL table:

| Status Value | Meaning | How It Is Triggered | User / System Action |
| :--- | :--- | :--- | :--- |
| **`'active'`** | The connected Facebook user account has a valid, non-expired long-lived OAuth 2.0 access token and can discover/import Pages (`GET /v26.0/me/accounts`). | Set automatically on initial OAuth connection or re-authentication (`GET /api/auth/facebook/callback`), and preserved during transient errors (such as API rate limits `4`, `17`, `32`, `341`, `613`, `80000+`, Page policy blocks `368`, or temporary downtime `1`, `2`). | Normal operation. All imported Pages under this account can be managed. |
| **`'expired'`** | The user's OAuth 2.0 access token has expired (`token_expires_at <= now()`), been revoked by the user, or been invalidated by a Facebook security checkpoint, password change, or missing permission. | 1. Time-based: `evaluateAccountHealth()` detects `tokenExpiresAt <= now()`.<br>2. API error-based: Graph API returns auth/token errors (`102`, `190` with any subcode `458`, `459`, `460`, `463`, `464`, `467`, `483`, or permission errors `10`, `200–299`). | The user must re-authenticate the Facebook account via OAuth (`POST /api/auth/facebook/connect`) to issue a fresh 60-day token. |
| **`'disconnected'`** | The user explicitly disconnected the Facebook account from their tenant workspace, wiping the encrypted access token. | Triggered when the tenant user calls `DELETE /api/tenant/[subdomain]/accounts/[accountId]`. Sets `encrypted_access_token = ''`, `status = 'disconnected'`, and cascades `status = 'disconnected'` to all child `facebook_pages`. | Account is inactive and excluded from publishing. Re-connecting via OAuth (`ON CONFLICT (user_id, fb_account_id) DO UPDATE`) restores it to `'active'`. |

---

### 1.2 `facebook_pages.status` (`FacebookPageStatusSchema`)

Defined in [`packages/contracts/src/domain/facebook.ts`](../../packages/contracts/src/domain/facebook.ts) and enforced on the `facebook_pages` PostgreSQL table:

| Status Value | Meaning | How It Is Triggered | User / System Action |
| :--- | :--- | :--- | :--- |
| **`'active'`** | The Facebook Page has a valid Page access token and is ready for scheduled post dispatching and insights syncing. | Set when importing a Page (`POST /api/tenant/[subdomain]/pages/import`), re-authenticating its parent Facebook account, or automatically after 3 days of `'fb_rate_limited'` cooldown. Preserved (`'active'`) during normal API call volume rate limits (`4`, `17`, `32`, `341`, `613`, `80000–80014`) and duplicate-post rejections (`368` / `1404082`). | Ready for publishing via the Cloudflare Worker dispatcher. |
| **`'fb_rate_limited'`** | **Exclusively for Error Code `368` + Subcode `1390008`** (or generic `368`): `"We limit how often you can post, comment or do other things..."` — Facebook temporarily restricted this Page from posting/commenting due to action frequency/policy limits. | Graph API returns **error code `368` with subcode `1390008`** (or default `368` without `4854002`/`1404082`). **Never** set for regular API call volume throttles (`4`, `17`, `32`, `341`, `613`, `80000–80014`). | Parent `facebook_accounts.status` remains `'active'`. The Page is marked `'fb_rate_limited'` and **automatically turns back to `'active'` after 3 days** (`FB_RATE_LIMITED_COOLDOWN_DAYS = 3`, evaluated via `evaluatePageHealth()`). |
| **`'page_checkpoint'`** | **Exclusively for Error Code `368` + Subcode `4854002`**: `"Confirm your identity before you can publish as this Page."` — Facebook placed an identity/verification checkpoint on the Page. | Graph API returns **error code `368` with subcode `4854002`** (`evaluateGraphApiError(368, 4854002)`). | **Requires manual verification & reactivation**: Prompt the user to log in to Facebook on a mobile device, switch to the Page, confirm verification, and then **manually turn the Page back to `'active'`** (an automation toggle button will be added for this later). |
| **`'invalid_token'`** | The Page access token is invalid, expired, revoked, or the user lost their Page admin/editor role (`CREATE_CONTENT` / `MANAGE`). | Graph API returns `190`, `102`, subcodes `458`, `459`, `460`, `463`, `464`, `467`, `483`, `492` (user lost Page role), or permission errors `10`, `200–299`. | **Non-transient (`isTransient = false`, `requiresReauth = true`)**. User must re-authenticate their Facebook account and re-import the Page. |
| **`'disconnected'`** | The Page was explicitly disconnected by the user, or its parent Facebook account was disconnected. | User disconnects the Page (`DELETE /api/tenant/[subdomain]/pages/[pageId]`) or disconnects the parent Facebook account. | Excluded from scheduling and publishing until re-imported. |

---

## 2. Master Error Code to Status Decision Matrix

Below is the unified mapping across all three Meta documentation guides showing what `facebook_accounts.status` and `facebook_pages.status` should be set to when an error occurs:

| Error Code | Subcode | Official Name / Category | Meaning | Target `facebook_accounts.status` | Target `facebook_pages.status` | Transient? | Requires Re-Auth? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`OAuthException`** | *(none)* | Invalid/Expired OAuth Token | Login status or access token has expired, been revoked, or is invalid. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`1`** | — | `API Unknown` | Temporary issue due to Facebook downtime or non-existent API endpoint. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Yes** | No |
| **`2`** | — | `API Service` | Temporary issue due to Facebook service downtime. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Yes** | No |
| **`3`** | — | `API Method` | Capability or permissions issue on the Meta App. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | No | No *(Check App config)* |
| **`4`** | — | `API Too Many Calls` | App-level Platform rate limit reached (`200 * DAU/hour`). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`10`** | — | `API Permission Denied` | Required OAuth permission was never granted or has been removed by the user. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** *(Re-request scopes)* |
| **`17`** | — | `API User Too Many Calls` | User-level Platform rate limit reached across rolling 1-hour window. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`17`** | **`2446079`** | `Ads API v3.3 Rate Limit` | Legacy Ads API v3.3 or older rate limit reached. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`32`** | — | `Page Request Limit Reached` | Page-level API call rate limit reached for Page API calls made with a User or App access token. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`100`** | — | `Invalid Parameter` | Malformed Graph API parameter, invalid field name, or unsupported node operation. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | No | No *(Fix request payload)* |
| **`102`** | *(none)* | `API Session` | Session key or access token is invalid, expired, or no longer valid. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`104`** | — | `Incorrect Signature` | Missing or invalid authentication signature / `appsecret_proof`. | **`'expired'`** *(if token corrupt)* | **`'invalid_token'`** | No | **Yes** |
| **`105`** | — | `Too Many Parameters` | The number of parameters exceeded the maximum allowed for this operation. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | No | No |
| **`190`** | *(none)* | `Invalid OAuth 2.0 Access Token` | Access token has expired, been revoked, or is otherwise invalid. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`190` / `102`** | **`458`** | `App Not Installed` | User has not logged into the app or revoked app installation in Facebook Settings. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`190` / `102`** | **`459`** | `User Checkpointed` | User account is security-checkpointed (`facebook.com` login required to resolve). | **`'expired'`** | **`'invalid_token'`** | No | **Yes** *(After checkpoint)* |
| **`190` / `102`** | **`460`** | `Password Changed` | User changed their Facebook password; existing OAuth sessions invalidated. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`190` / `102`** | **`463`** | `Expired` | Access token has passed its expiration timestamp (`token_expires_at`). | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`190` / `102`** | **`464`** | `Unconfirmed User` | User account is unconfirmed and must log in at `facebook.com` to confirm identity. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`190` / `102`** | **`467`** | `Invalid Access Token` | Access token is malformed, expired, revoked, or otherwise invalid. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`190` / `102`** | **`483`** | `Consent App Blocking` | Session is invalid because the user is in consent app blocking. | **`'expired'`** | **`'invalid_token'`** | No | **Yes** |
| **`190` / `102`** | **`492`** | `Invalid Session (Page Role)` | User associated with the Page access token no longer has an appropriate admin/editor role on the Page. | **`'active'`** *(User token still valid)* | **`'invalid_token'`** *(Page token lost role)* | No | **Yes** *(Re-verify Page role)* |
| **`194`** | — | `Missing Required Parameter` | At least one required Graph API parameter was omitted from the request. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | No | No |
| **`200–299`** | — | `API Permission Error` | Specific permission (e.g., `200` Permissions error, `240` Desktop app restriction) is not granted or was removed. | **`'expired'`** *(if user scope revoked)* | **`'invalid_token'`** | No | **Yes** *(Re-authorize scopes)* |
| **`341`** | — | `Application Limit Reached` | Temporary issue due to application-level daily action limit or throttling. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`368`** | **`1390008`** *(or default)* | `Page Action Frequency Limit` | `"We limit how often you can post, comment or do other things..."` — Mark Page as `'fb_rate_limited'` and **auto-turn to `'active'` after 3 days**. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** *(Auto `'active'` after 3d)* | **Yes** *(3-day cooldown)* | No |
| **`368`** | **`4854002`** | `Page Identity Checkpoint` | `"Confirm your identity before you can publish as this Page."` — Mark Page as `'page_checkpoint'`; ask user to log in on mobile, switch to Page, confirm verification, and **manually turn Page to `'active'`** (automation toggle planned later). | **`'active'`** *(unchanged)* | **`'page_checkpoint'`** *(Manual `'active'` after mobile verify)* | No *(Fail post item)* | No *(Mobile Page verification)* |
| **`368`** | **`1404082`** | `Duplicate Content Blocked` | `"You've already posted this. Posting the same content repeatedly..."` — Simply mark the post (`queue_items.status`) as `'failed'` and give the reason. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; mark post `'failed'`)* | No *(Fail post item)* | No |
| **`506`** | — | `Duplicate Post` | Duplicate posts cannot be published consecutively to the same Page. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; fail post item)* | No | No *(Modify post text)* |
| **`613`** | *(none)* | `Custom Rate Limit Exceeded` | Endpoint-specific custom rate limit reached. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`613`** | **`1996`** | `Inconsistent Request Volume` | Facebook detected sudden spikes/inconsistent behavior in API request volume. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`2500`** | — | `Error Parsing Graph Query` | Syntax error in field expansion, path, or Graph query string. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | No | No |
| **`2635`** | — | `Deprecated API Version` | Calling a deprecated Graph/Ads API version; upgrade to v26.0+. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | No | No |
| **`2650`** | — | `Custom Audience Update Failed` | Failed to update the custom audience node. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Yes** | No |
| **`2903` / `2904`** | — | `Test Account Deletion Error` | Cannot delete this test account (`2903`) or OG Test User (`2904`). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | No | No |
| **`3919`** | — | `Unexpected Technical Issue` | Transient Facebook server error; wait and retry. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Yes** | No |
| **`80000`** | **`2446079`** | `BUC Rate Limit: Ads Insights` | Business Use Case rate limit reached for Ads Insights. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80001`** | — | `BUC Rate Limit: Pages` | Too many API calls to this Page account using a Page or System User access token (`4800 * Engaged Users / 24h`). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80002`** | — | `BUC Rate Limit: Instagram` | Too many API calls to this Instagram professional account (`4800 * Impressions / 24h`). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80003`** | **`2446079`** | `BUC Rate Limit: Custom Audience` | Too many API calls to this ad account's Custom Audience API. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80004`** | **`2446079`** | `BUC Rate Limit: Ads Management` | Too many API calls to this ad account's Ads Management API. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80005`** | — | `BUC Rate Limit: LeadGen` | Too many API calls to LeadGen API (`4800 * Leads Generated / 24h`). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80006`** | — | `BUC Rate Limit: Messenger` | Too many Messenger API calls to this Page account (`200 * Engaged Users / 24h`). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80008`** | — | `BUC Rate Limit: WhatsApp` | Too many API calls to WhatsApp Business Management API (WABA). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80009`** | — | `BUC Rate Limit: Catalog Management` | Too many API calls to Catalog Management API (`1h` rolling window). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`80014`** | — | `BUC Rate Limit: Catalog Batch` | Too many API calls to Catalog Batch API (`1m` rolling window). | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; backoff retry)* | **Yes** | No |
| **`1609005`** | — | `Error Posting Link` | Facebook link scraper could not scrape metadata from the URL attached to the post. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; fail post item)* | No | No *(Fix link URL)* |
| **`throttled` / `backend_qps` / `complexity_score`** | — | `Stability Throttle Codes` | Query exceeded app `backend_qps` or `complexity_score` limits. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged; simplify query)* | **Yes** | No |
