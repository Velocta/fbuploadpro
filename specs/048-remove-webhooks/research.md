# Research: Complete Elimination of Webhooks

## Decisions & Technical Choices

### 1. Database Column Dropping Strategy
- **Decision**: Execute forward migration `supabase/migrations/20261020000000_drop_byoc_webhook_verify_token.sql` with `ALTER TABLE public.workspace_byoc_credentials DROP COLUMN IF EXISTS webhook_verify_token;`.
- **Rationale**: Cleanly removes the column without blocking reads or writes on the remaining columns (`workspace_id`, `fb_app_id`, `encrypted_fb_app_secret`, `status`, `last_tested_at`). Follows Constitution Principle 30 (Pure Supabase Migration Standards).

### 2. Contracts Schema Adjustments
- **Decision**: Update `packages/contracts/src/domain/workspace.ts` to remove `webhookVerifyToken` from `BYOCCredentialsViewSchema` and `SaveBYOCCredentialsRequestSchema`.
- **Rationale**: Removes dead schema properties so client and server code maintain strict typed contract validation without unexpected property mismatches.

### 3. Reserved Subdomains Update
- **Decision**: Remove `'webhook'` from `RESERVED_SUBDOMAINS` in `packages/contracts/src/domain/user.ts` per the user's explicit clarification directive.
- **Rationale**: Fulfills complete eradication requirement across the repository.

### 4. UI Simplification in BYOC Settings
- **Decision**: In `MetaAppSetupSection` (`apps/web/src/components/settings/byoc-settings-view.tsx`), remove `webhookUrl` prop and the "Webhook Callback URL" copy box. Retain only the OAuth Redirect URI copy box.
- **Rationale**: Streamlines the Meta App setup experience to only what is required for Facebook OAuth connection.
