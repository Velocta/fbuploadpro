# Facebook Graph API — `/user` (`/me`) Node Reference & Error Codes

**Source**: [`https://developers.facebook.com/docs/graph-api/reference/user`](https://developers.facebook.com/docs/graph-api/reference/user)

---

## 1. `/user` (`/me`) Fields & Edges Used by FBUploadPro

During the Facebook OAuth 2.0 callback (`GET /api/auth/facebook/callback`), FBUploadPro queries:

```http
GET https://graph.facebook.com/v26.0/me?fields=id,name,gender,link,picture{url}&access_token={long_lived_user_token}
```

And during Page discovery (`GET /api/tenant/[subdomain]/accounts/[accountId]/pages/discover`) and Page import (`POST /api/tenant/[subdomain]/pages/import`), FBUploadPro queries the `/me/accounts` edge:

```http
GET https://graph.facebook.com/v26.0/me/accounts?fields=id,name,category,tasks,access_token,followers_count,picture{url}&access_token={long_lived_user_token}
```

### Field Specifications from Meta `/user` Reference

| Field / Edge | Graph Type | Classification & Permission Notes | FBUploadPro Database Column |
| :--- | :--- | :--- | :--- |
| **`id`** | `numeric string` | **Core / Default**. The app-scoped ID of this person's user account (`fb_account_id`). Unique to each app and cannot be used across different apps. | `facebook_accounts.fb_account_id` (`VARCHAR(100) NOT NULL`) |
| **`name`** | `string` | **Core / Default**. The person's full name (`display_name`). | `facebook_accounts.display_name` (`VARCHAR(255) NOT NULL`) |
| **`gender`** | `string` | **Core**. The gender selected by this person (`male`, `female`, or custom string). Requires `user_gender` permission if accessed beyond basic profile context; nullable if omitted or restricted by privacy settings. | `facebook_accounts.gender` (`VARCHAR(50) NULL`) |
| **`link`** | `string` (URL) | **Core**. A link to the person's Timeline. Requires `user_link` permission; valid only if theauthenticated user granted `user_link`. Nullable if omitted. | `facebook_accounts.account_link` (`TEXT NULL`) |
| **`picture`** (`picture{url}`) | `Edge<ProfilePictureSource>` | **Core**. The person's profile picture (`picture.data.url`). | `facebook_accounts.profile_picture_url` (`TEXT NULL`) |
| **`accounts`** (`/me/accounts`) | `Edge<Page>` | Pages the User has a role on (`id`, `name`, `category`, `tasks`, `access_token`, `followers_count`, `picture{url}`). | `facebook_pages` table |

---

## 2. Error Codes on `GET /{user-id}` (Reading `/me`)

From the **Reading -> Error Codes** table of `https://developers.facebook.com/docs/graph-api/reference/user`:

| Error Code | Official Description | Meaning & Root Cause | `facebook_accounts.status` | `facebook_pages.status` | FBUploadPro Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`100`** | `Invalid parameter` | A requested field, parameter, or syntax on `/me` is invalid or unsupported in Graph API v26.0. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Do not expire the user's token. Fix the requested `fields` parameter in application code. |
| **`104`** | `Incorrect signature` | The request signature or authentication proof (`appsecret_proof` / OAuth signature) is invalid or missing. | **`'expired'`** *(if token corrupt)* | **`'invalid_token'`** | Verify app secret configuration; if token is corrupted, prompt user to re-authenticate (`'expired'`). |
| **`190`** | `Invalid OAuth 2.0 Access Token` | The user access token has expired, been revoked by the user, or was invalidated by a password change/logout. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child `facebook_pages.status` to `'invalid_token'`. Require user re-authentication via OAuth. |
| **`200`** | `Permissions error` | The user has not granted (or has removed) a required permission for the requested node/edge. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` so the user re-authenticates and grants required scopes. |
| **`368`** | `The action attempted has been deemed abusive or is otherwise disallowed` | Temporary Facebook policy/security block on the action. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | Keep account `'active'`, pause automated operations (`'fb_rate_limited'`), and surface the policy block message. |
| **`459`** | `The session is invalid because the user has been checkpointed` | Facebook placed a security checkpoint on the user's personal Facebook account. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child Pages to `'invalid_token'`. User must log in at `facebook.com` to clear the checkpoint, then reconnect. |
| **`613`** | `Calls to this api have exceeded the rate limit.` | Custom rate limit exceeded on the `/user` endpoint. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Transient throttle**. Keep `facebook_accounts.status = 'active'`, mark Page `'fb_rate_limited'`, and back off. |
| **`80002`** | `There have been too many calls to this Instagram account. Wait a bit and try again.` | Business Use Case (BUC) rate limit exceeded for linked Instagram account. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Transient throttle**. Keep `facebook_accounts.status = 'active'` and back off. |
| **`80004`** | `There have been too many calls to this ad-account. Wait a bit and try again.` | Business Use Case (BUC) rate limit exceeded for Ads Management. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Transient throttle**. Keep `facebook_accounts.status = 'active'` and back off. |
| **`80006`** | `There have been too many messenger api calls to this Page account. Wait a bit and try again.` | Business Use Case (BUC) rate limit exceeded for Messenger API on the Page. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Transient throttle**. Keep `facebook_accounts.status = 'active'`, mark Page `'fb_rate_limited'`, and back off. |

---

## 3. Error Codes on `POST /{user-id}` (Updating `/user` & Custom Audience Users)

From the **Updating -> Error Codes** tables of `https://developers.facebook.com/docs/graph-api/reference/user`:

| Error Code | Official Description | Meaning & Root Cause | `facebook_accounts.status` | `facebook_pages.status` | FBUploadPro Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`100`** | `Invalid parameter` | Invalid parameter supplied in the POST body. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Fix request payload; do not alter account status. |
| **`102`** | `Session key invalid or no longer valid` | User session or OAuth token is no longer valid. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child Pages to `'invalid_token'`. |
| **`105`** | `The number of parameters exceeded the maximum for this operation` | Request payload contains too many parameters. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Split batch or reduce parameters; keep account `'active'`. |
| **`190`** | `Invalid OAuth 2.0 Access Token` | Access token is expired or revoked. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child Pages to `'invalid_token'`. |
| **`194`** | `Missing at least one required parameter` | Required parameter was omitted from the request. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Fix request payload; keep account `'active'`. |
| **`200`** | `Permissions error` | Missing required permission to perform the update. | **`'expired'`** | **`'invalid_token'`** | Prompt user to re-authenticate with required permissions. |
| **`240`** | `Desktop applications cannot call this function for other users` | App type/capability restriction for desktop apps. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | App configuration error; keep account `'active'`. |
| **`368`** | `The action attempted has been deemed abusive or is otherwise disallowed` | Temporary policy violation block. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | Keep account `'active'`; pause Page activity. |
| **`459`** | `The session is invalid because the user has been checkpointed` | User account is under a Facebook security checkpoint. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child Pages to `'invalid_token'`. |
| **`483`** | `The session is invalid because the user is in consent app blocking` | User session blocked pending regulatory/privacy consent flow on Facebook. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child Pages to `'invalid_token'`. User must complete consent on Facebook and reconnect. |
| **`2500`** | `Error parsing graph query` | Malformed Graph API query syntax or path. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Code-level query syntax error; keep account `'active'`. |
| **`2635`** | `You are calling a deprecated version of the Ads API. Please update to the latest version.` | Outdated Graph/Ads API version in request URL. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Ensure all endpoints target `v26.0`; keep account `'active'`. |
| **`2650`** | `Failed to update the custom audience` | Server-side failure updating Custom Audience. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Retry transiently; keep account `'active'`. |

---

## 4. Error Codes on `DELETE /{user-id}` (Deleting / Dissociating `/user`)

From the **Deleting -> Error Codes** tables of `https://developers.facebook.com/docs/graph-api/reference/user`:

| Error Code | Official Description | Meaning & Root Cause | `facebook_accounts.status` | `facebook_pages.status` | FBUploadPro Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`100`** | `Invalid parameter` | Invalid parameter passed to DELETE endpoint. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Fix request parameter; keep account `'active'`. |
| **`102`** | `Session key invalid or no longer valid` | Session or token is no longer valid. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child Pages to `'invalid_token'`. |
| **`190`** | `Invalid OAuth 2.0 Access Token` | Access token is expired or revoked. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child Pages to `'invalid_token'`. |
| **`200`** | `Permissions error` | Missing required permissions. | **`'expired'`** | **`'invalid_token'`** | Transition `facebook_accounts.status` to `'expired'` and child Pages to `'invalid_token'`. |
| **`240`** | `Desktop applications cannot call this function for other users` | Desktop app capability restriction. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Keep account `'active'`. |
| **`368`** | `The action attempted has been deemed abusive or is otherwise disallowed` | Temporary policy violation block. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | Keep account `'active'`; pause Page activity. |
| **`2635`** | `You are calling a deprecated version of the Ads API. Please update to the latest version.` | Deprecated API version. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Keep account `'active'`. |
| **`2650`** | `Failed to update the custom audience` | Custom audience mutation failed. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Keep account `'active'`. |
| **`2903`** | `Cannot delete this test account` | Test user deletion restricted. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Keep account `'active'`. |
| **`2904`** | `Cannot delete the OG Test User` | Original Graph test user cannot be deleted. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Keep account `'active'`. |
| **`3919`** | `There was an unexpected technical issue. Please try again.` | Transient Facebook server error. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Transient**. Retry with backoff; keep account `'active'`. |
| **`80003`** | `There have been too many calls to this ad-account. Wait a bit and try again.` | Custom Audience BUC rate limit reached. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Transient throttle**. Keep account `'active'`. |
