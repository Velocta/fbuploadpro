# Facebook Graph API — Error Handling Reference

**Source**: [`https://developers.facebook.com/docs/graph-api/guides/error-handling`](https://developers.facebook.com/docs/graph-api/guides/error-handling)

---

## 1. Graph API Error Response Payload Structure

When a Facebook Graph API v26.0 request fails, Meta returns a JSON error envelope with the following properties:

```json
{
  "error": {
    "message": "Message describing the error",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 460,
    "error_user_title": "A title",
    "error_user_msg": "A message",
    "fbtrace_id": "EJplcsCHuLu"
  }
}
```

| Field | Description |
| :--- | :--- |
| `message` | A human-readable description of the error. |
| `type` | The error classification (most commonly `OAuthException` for authentication, permission, and rate-limit errors, or `GraphMethodException` for invalid endpoints/parameters). |
| `code` | Primary numeric error code indicating the broad failure category. |
| `error_subcode` | Granular numeric subcode providing specific root-cause context (especially for authentication codes `102` and `190`). |
| `error_user_title` | Localized dialog title suitable for displaying to the end user (based on request locale). |
| `error_user_msg` | Localized explanation message suitable for displaying to the end user. |
| `fbtrace_id` | Internal Meta support trace identifier for debugging with Facebook Developer Support. |

---

## 2. Primary Error Codes (`#errorcodes`)

| Code or Type | Official Name | Official Meaning & What To Do | `facebook_accounts.status` | `facebook_pages.status` | FBUploadPro Handling Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`OAuthException`** *(without subcode)* | OAuth Exception | If no subcode is present, the login status or access token has expired, been revoked, or is otherwise invalid. Get a new access token. If a subcode is present, inspect the subcode. | **`'expired'`** | **`'invalid_token'`** | Mark account `'expired'` and Page `'invalid_token'`. Prompt user to reconnect via OAuth. |
| **`102`** | `API Session` | If no subcode is present, the login status or access token has expired, been revoked, or is otherwise invalid. Get a new access token. If a subcode is present, inspect the subcode. | **`'expired'`** | **`'invalid_token'`** | Mark account `'expired'` and Page `'invalid_token'`. Requires user re-authentication. |
| **`1`** | `API Unknown` | Possibly a temporary issue due to downtime. Wait and retry the operation. If it occurs again, check that you are requesting an existing API. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Transient**. Do not invalidate tokens. Apply exponential backoff in the worker queue (`attempts + 1`). |
| **`2`** | `API Service` | Temporary issue due to downtime. Wait and retry the operation. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Transient**. Keep account and Page `'active'`. Retry with exponential backoff. |
| **`3`** | `API Method` | Capability or permissions issue. Make sure your app has the necessary capability or permissions to make this call. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | Configuration/capability error on the Meta App. Fail the specific job without marking the user's OAuth token expired unless paired with permission revocation. |
| **`4`** | `API Too Many Calls` | Temporary issue due to app-level throttling. Wait and retry the operation, or examine your API request volume. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Transient throttle**. Keep `facebook_accounts.status = 'active'`, set `facebook_pages.status = 'fb_rate_limited'`, pause dispatching for the cooldown window, then resume. |
| **`17`** | `API User Too Many Calls` | Temporary issue due to user-level throttling. Wait and retry the operation, or examine your API request volume. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Transient throttle**. Keep `facebook_accounts.status = 'active'`, set `facebook_pages.status = 'fb_rate_limited'`, back off and retry after the rolling 1-hour window. |
| **`10`** | `API Permission Denied` | Permission is either not granted or has been removed. Handle the missing permissions by re-requesting scopes via Facebook Login. | **`'expired'`** | **`'invalid_token'`** | User declined or revoked required publishing/page scopes (`pages_manage_posts`, `pages_read_engagement`, `pages_show_list`). Set account to `'expired'` and Page to `'invalid_token'` so the user re-authorizes with full scopes. |
| **`190`** | `Access token has expired` | Access token has expired, been revoked, or is otherwise invalid. Get a new access token. | **`'expired'`** | **`'invalid_token'`** | Handled directly in `evaluateGraphApiError(190)`. Transitions `facebook_accounts.status` to `'expired'` and `facebook_pages.status` to `'invalid_token'` (`requiresReauth = true`). |
| **`200–299`** | `API Permission` *(Multiple values depending on permission)* | Permission is either not granted or has been removed. Handle the missing permissions. | **`'expired'`** | **`'invalid_token'`** | Missing or revoked granular permission (e.g. `200` Permissions error). Mark account `'expired'` and Page `'invalid_token'`; prompt user to re-authenticate and grant all required permissions. |
| **`341`** | `Application limit reached` | Temporary issue due to downtime or application action throttling. Wait and retry the operation, or examine your API request volume. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Transient throttle**. Keep `facebook_accounts.status = 'active'`, set `facebook_pages.status = 'fb_rate_limited'`, and defer queued posts. |
| **`368`** | `Temporarily blocked for policies violations` | The action attempted has been deemed abusive or is otherwise disallowed due to policy violations. Wait and retry the operation. | **`'active'`** *(unchanged)* | **`'fb_rate_limited'`** | **Policy / Anti-Spam Block**. The OAuth token itself is still valid (`facebook_accounts.status = 'active'`), but publishing to the Page is temporarily blocked by Facebook Integrity systems (`facebook_pages.status = 'fb_rate_limited'`). Do not retry aggressively; surface `error_user_msg` to the tenant. |
| **`506`** | `Duplicate Post` | Duplicate posts cannot be published consecutively. Change the content of the post and try again. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Post-level validation error**. Both account and Page remain `'active'`. Mark the individual `scheduled_posts` item as `'failed'` with a clear user message that identical consecutive posts are rejected by Facebook. |
| **`1609005`** | `Error Posting Link` | There was a problem scraping data from the provided link. Check the URL and try again. | **`'active'`** *(unchanged)* | **`'active'`** *(unchanged)* | **Post-level validation error**. Both account and Page remain `'active'`. Mark the individual `scheduled_posts` item as `'failed'` and instruct the user to verify the target URL is publicly reachable. |

---

## 3. Authentication Error Subcodes (`#errorsubcodes`)

These subcodes accompany primary error codes `190` (`Invalid OAuth 2.0 Access Token`) or `102` (`API Session`):

| Subcode | Official Name | Official Meaning & What To Do | `facebook_accounts.status` | `facebook_pages.status` | FBUploadPro Handling Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`458`** | `App Not Installed` | The User has not logged into your app (or removed the app from their Facebook Business Integrations settings). Reauthenticate the User. | **`'expired'`** | **`'invalid_token'`** | Handled in `evaluateGraphApiError(190, 458)`. Sets account to `'expired'` and Page to `'invalid_token'` (`requiresReauth = true`). |
| **`459`** | `User Checkpointed` | The User needs to log in at `https://www.facebook.com` or `https://m.facebook.com` to correct a security checkpoint issue. | **`'expired'`** | **`'invalid_token'`** | Sets account to `'expired'` and Page to `'invalid_token'`. User must first clear the security checkpoint on Facebook and then reconnect their account in FBUploadPro. |
| **`460`** | `Password Changed` | The user changed their Facebook password, invalidating existing OAuth sessions. They must log in to the app again. | **`'expired'`** | **`'invalid_token'`** | Handled in `evaluateGraphApiError(190, 460)`. Sets account to `'expired'` and Page to `'invalid_token'` (`requiresReauth = true`). |
| **`463`** | `Expired` | Login status or access token has expired, been revoked, or is otherwise invalid. Handle expired access tokens by re-authenticating. | **`'expired'`** | **`'invalid_token'`** | Handled in `evaluateGraphApiError(190, 463)`. Sets account to `'expired'` and Page to `'invalid_token'` (`requiresReauth = true`). |
| **`464`** | `Unconfirmed User` | The User needs to log in at `https://www.facebook.com` or `https://m.facebook.com` to confirm their account identity/contact info. | **`'expired'`** | **`'invalid_token'`** | Sets account to `'expired'` and Page to `'invalid_token'`. User must confirm their Facebook account on `facebook.com` and reconnect. |
| **`467`** | `Invalid Access Token` | Access token has expired, been revoked, or is otherwise invalid. Handle expired access tokens. | **`'expired'`** | **`'invalid_token'`** | Sets account to `'expired'` and Page to `'invalid_token'` (`requiresReauth = true`). |
| **`492`** | `Invalid Session` | User associated with the Page access token does not have an appropriate role on the Page. | **`'active'`** *(User token remains valid)* | **`'invalid_token'`** *(Page token lost role)* | The user's personal Facebook account token is still valid (`facebook_accounts.status = 'active'`), but their admin/editor role on this specific Page was removed. Set `facebook_pages.status = 'invalid_token'` for that Page only. |
