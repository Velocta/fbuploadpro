# Implementation Plan: Facebook Accounts Resilience, Page Token Sync, Expandable Linked Pages & Reconnect Mismatch Guard

**Branch**: `031-facebook-accounts-resilience-and-page-sync` | **Date**: 2026-10-11 | **Spec**: [`spec.md`](./spec.md)

## Summary

Deliver 5 cohesive improvements across `@fbuploadpro/contracts` and `@fbuploadpro/web`:
1. **Remote Magic Link Error Isolation (`isMagic` Leak Fix)**: Ensure `/api/auth/facebook/callback` routes upstream OAuth cancellations (`access_denied`, `user_cancelled`) and token/profile failures to `/connect/facebook/error?reason=...` whenever `statePayload?.isMagic === true`, and render reason-specific messaging on `/connect/facebook/error/page.tsx`.
2. **Auto-Refresh Linked Page Tokens on Account Re-Auth**: In `/api/auth/facebook/callback`, after upserting `facebook_accounts`, query `/me/accounts?fields=id,access_token` and update `encrypted_page_token` (and `token_expires_at`) for all linked `facebook_pages` (`status != 'disconnected'`) belonging to that account, setting `status = 'active'` strictly for pages whose status was `'invalid_token'`.
3. **Broken Avatar Fallback (`onError`)**: In `AccountCard`, track `imgError` state on `<img data-testid="account-avatar-img" />` (resetting when `account.profilePictureUrl` changes) so expired Facebook CDN URLs fall back cleanly to monogram initials (`data-testid="account-avatar-initials"`).
4. **Show Which Pages Are Linked (On Card & In Disconnect Dialog)**: Extend `GET /api/tenant/[subdomain]/accounts` and `FacebookAccountSummarySchema` to include `connectedPages: Array<{ id, pageName, profilePictureUrl }>`. Add an expandable toggle button on `"X page(s) linked"` in `AccountCard` (`data-testid="account-pages-toggle"` / `data-testid="account-linked-pages-list"`) and render the list of linked page names inside `DisconnectAccountDialog`.
5. **Wrong-Account Mismatch Detection on Reconnect & Already-Connected Refresh**: Pass `expectedFbAccountId` and `expectedDisplayName` through `/api/auth/facebook`, `/api/tenant/[subdomain]/accounts/magic-link`, `/connect/facebook`, and `ConnectAccountModal`. Detect both mismatch on reconnect (`"You signed into {newAccountName} instead of {expectedAccountName}. {expectedAccountName} still needs to be reconnected."` while still saving the newly authorized account) and already-connected refresh on standard connect (`"This Facebook account ({accountName}) is already connected — its session was refreshed."` while setting status to `'active'` if expired).

## Technical Context

- **Contracts (`packages/contracts/src/domain/facebook.ts`)**:
  - Extend `OAuthStatePayloadSchema` and `MagicLinkTokenPayloadSchema` with optional `expectedFbAccountId?: z.string().optional()` and `expectedDisplayName?: z.string().optional()`.
  - Extend `FacebookAccountSummarySchema` with optional `connectedPages: z.array(z.object({ id: z.string().uuid(), pageName: z.string(), profilePictureUrl: z.string().nullable().optional() })).optional()`.
- **Backend Routes (`apps/web/src/app/api/...`)**:
  - `GET /api/auth/facebook/route.ts`: Read optional `expectedFbAccountId` and `expectedDisplayName` query params and include them in `signOAuthState`.
  - `POST /api/tenant/[subdomain]/accounts/magic-link/route.ts`: Parse optional JSON body `{ expectedFbAccountId, expectedDisplayName }` and include them in `signMagicLinkToken`.
  - `GET /connect/facebook/route.ts`: Forward `payload.expectedFbAccountId` and `payload.expectedDisplayName` from `verifyMagicLinkToken` into `signOAuthState`.
  - `GET /api/auth/facebook/callback/route.ts`:
    - Verify `state` early when `error` is present; if `statePayload?.isMagic`, redirect to `/connect/facebook/error?reason=cancelled` (when `error === 'access_denied' || error === 'user_cancelled'`) or `/connect/facebook/error?reason=oauth_failed`.
    - When `shortTokenRes`, `longTokenRes`, or `meRes` is not OK and `statePayload.isMagic` is true, redirect to `/connect/facebook/error?reason=oauth_failed`.
    - Check if `(user_id, fb_account_id)` already exists in `facebook_accounts` (`SELECT id, status FROM facebook_accounts WHERE user_id = $1 AND fb_account_id = $2`) prior to upsert.
    - Upsert `facebook_accounts` setting `status = 'active'` and `updated_at = now() RETURNING id`.
    - Call helper `refreshConnectedPageTokens(db, userId, accountId, longTokenData.access_token, expiresAt, encryptionKey)`:
      - Query existing linked pages: `SELECT id, fb_page_id, status FROM facebook_pages WHERE facebook_account_id = $1 AND user_id = $2 AND status != 'disconnected'`.
      - If at least 1 linked page exists, fetch `https://graph.facebook.com/v26.0/me/accounts?fields=id,access_token` with `Authorization: Bearer ${longAccessToken}`.
      - For each matching page, encrypt `page.access_token` and run:
        ```sql
        UPDATE facebook_pages
        SET encrypted_page_token = $1,
            token_expires_at = $2,
            status = CASE WHEN status = 'invalid_token' THEN 'active'::facebook_page_status ELSE status END,
            updated_at = now()
        WHERE id = $3 AND user_id = $4
        ```
    - Redirect logic for Direct OAuth (`!statePayload.isMagic`):
      - If `statePayload.expectedFbAccountId && meProfile.id !== statePayload.expectedFbAccountId`:
        Redirect with `?reconnected_mismatch=1&newAccountName=${meProfile.name}&expectedAccountName=${statePayload.expectedDisplayName || 'the expired account'}`.
      - Else if `!statePayload.expectedFbAccountId && alreadyExisted`:
        Redirect with `?connected=already&accountName=${meProfile.name}`.
      - Else:
        Redirect with `?connected=1`.
  - `GET /api/tenant/[subdomain]/accounts/route.ts`:
    - Include `COALESCE(json_agg(json_build_object('id', fp.id, 'pageName', fp.page_name, 'profilePictureUrl', fp.profile_picture_url) ORDER BY fp.page_name ASC) FILTER (WHERE fp.id IS NOT NULL), '[]'::json) AS connected_pages` in the query and map `connectedPages` onto each account summary.
- **Frontend Components (`apps/web/src/...`)**:
  - `apps/web/src/app/connect/facebook/error/page.tsx`: Read `searchParams.reason` (`cancelled`, `oauth_failed`, `expired_or_invalid`) and render tailored title & description.
  - `apps/web/src/components/accounts/account-card.tsx`:
    - Add `imgError` state (`onError` handler on `<img data-testid="account-avatar-img" />` and `<img />` for page avatars) falling back to initials.
    - When `account.connectedPagesCount > 0`, render `"X page(s) linked"` as an accessible toggle button (`data-testid="account-pages-toggle"`, `aria-expanded={isPagesExpanded}`) with a subtle chevron icon that expands `data-testid="account-linked-pages-list"` showing each linked page's avatar/initials and `pageName`.
  - `apps/web/src/components/accounts/disconnect-account-dialog.tsx`:
    - When `pagesCount > 0` and `account.connectedPages?.length > 0`, render a clean list (`data-testid="disconnect-linked-pages-list"`) inside `data-testid="disconnect-linked-pages-warning"` showing each page's name.
  - `apps/web/src/components/accounts/connect-account-modal.tsx` & `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx`:
    - Pass `reconnectingAccount.fbAccountId` and `reconnectingAccount.displayName` into Direct OAuth (`/api/auth/facebook?expectedFbAccountId=...&expectedDisplayName=...`) and Magic Link (`POST /api/tenant/[subdomain]/accounts/magic-link`).
    - Enhance `evaluateAccountPollingOutcome` in `connect-account-modal.tsx` to distinguish:
      - `'connected'` (new account added or target `reconnectingAccount` reconnected),
      - `'already_connected'` (standard Connect flow where an already-existing account's `updatedAt` or `status` was refreshed -> displays `"This Facebook account ({accountName}) is already connected — its session was refreshed."`),
      - `'reconnected_mismatch'` (Reconnect flow where a *different* account was added or updated while `reconnectingAccount` was not the one authorized -> displays `"You signed into {newAccountName} instead of {expectedAccountName}. {expectedAccountName} still needs to be reconnected."` and still refreshes the accounts grid so the newly connected account is saved and visible).
