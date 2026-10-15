# Quickstart & Verification Guide: 047 Workspace Subdomain BYOC OAuth

**Feature Directory**: `specs/047-workspace-subdomain-oauth`  
**Status**: In Implementation  
**Created**: 2026-10-15  

---

## 1. Verifying Workspace Subdomain OAuth

### Direct Browser Test
1. Set workspace Meta App credentials in Settings (`/settings?tab=byoc`).
2. Copy the "Valid OAuth Redirect URI" displayed in the UI:
   `https://shahzebpycozgy.vinsmokemedia.online/api/auth/facebook/callback`
3. Paste it into your Meta Developer App Dashboard -> **Facebook Login** -> **Settings** -> **Valid OAuth Redirect URIs**.
4. Navigate to `/accounts` and click **Connect Facebook Account**.
5. Observe the redirected Meta OAuth dialog URL:
   `https://www.facebook.com/v26.0/dialog/oauth?...&redirect_uri=https%3A%2F%2Fshahzebpycozgy.vinsmokemedia.online%2Fapi%2Fauth%2Ffacebook%2Fcallback&...`
6. Upon approval, Meta redirects back to `https://shahzebpycozgy.vinsmokemedia.online/api/auth/facebook/callback`.
7. The server completes token exchange with Meta using the exact same redirect URI and redirects the browser back to `https://shahzebpycozgy.vinsmokemedia.online/accounts?connected=1`.

---

## 2. Automated Unit Tests

- `packages/contracts/tests/oauth.test.ts`: Tests `OAuthStatePayloadSchema` accepting valid `redirectUri`.
- `apps/web/tests/api/auth-facebook.test.ts`: Tests `/api/auth/facebook` generating subdomain-specific `redirect_uri` when `NEXT_PUBLIC_ROOT_DOMAIN` is set.
- `apps/web/tests/api/auth-facebook.test.ts`: Tests `/api/auth/facebook/callback` exchanging token with the subdomain redirect URI from state.
