# Quickstart: Verification Guide for Webhook Removal

## Automated Verification

### 1. Run Contracts Domain Tests
```bash
pnpm --filter @fbuploadpro/contracts test
```
**Expected Outcome**: Validates that workspace BYOC schemas and user subdomain schemas parse and validate correctly without `webhookVerifyToken` or `'webhook'` in `RESERVED_SUBDOMAINS`.

### 2. Run Web API & UI Tests
```bash
pnpm --filter @fbuploadpro/web test tests/api/byoc-settings-api.test.ts tests/ui/byoc-settings.test.tsx tests/lib/byoc-resolver.test.ts
```
**Expected Outcome**: Validates that BYOC API routes and UI views load and update credentials cleanly without webhook verify tokens or webhook callback URL fields.

## Manual Visual Verification Scenarios

1. **Meta App Setup Section**:
   - Navigate to `/tenant/acme/settings`.
   - Verify that under "Configure your Facebook Developer App", only the OAuth Redirect URI (`https://app.fbuploadpro.com/api/auth/facebook/callback`) is displayed.
   - Verify that no "Webhook Callback URL" or webhook verification fields are present.
