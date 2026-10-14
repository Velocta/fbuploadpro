# Security & Multi-Tenancy Checklist: 041-strict-workspace-byoc-isolation

**Purpose**: Validate security boundaries, credential isolation, and tenancy constraints
**Feature**: [spec.md](../spec.md)

## Credential & BYOC Security

- [ ] Zero `process.env.FACEBOOK_APP_ID` or `process.env.FACEBOOK_APP_SECRET` fallbacks exist in runtime code
- [ ] Example env files (`.env.production.example`, `apps/web/.env.example`) have global Facebook App credentials removed
- [ ] Shared helper `resolveWorkspaceFacebookCredentials` verifies `subdomain` AND `owner_id = session.userId`
- [ ] App Secret is encrypted at rest using AES-256-GCM (`encryptToken`) with `TOKEN_ENCRYPTION_KEY`
- [ ] Stored App Secret is never returned in client-facing API responses (only `hasSecret: boolean` is emitted)
- [ ] Initial BYOC credential setup requires an App Secret; empty secret cannot silently succeed

## Multi-Workspace Isolation

- [ ] `facebook_accounts` and `facebook_pages` queries filter strictly by `workspace_id = workspace.id`
- [ ] Facebook OAuth callback persists `workspace_id` from state payload (`onConflict: 'workspace_id,fb_account_id'`)
- [ ] Disconnecting an account or page validates that the entity belongs to the active `workspace_id`
- [ ] Discovering pages verifies that the parent account belongs to the active `workspace_id`
- [ ] Importing pages persists `workspace_id: workspace.id` (`onConflict: 'workspace_id,fb_page_id'`)
- [ ] Queue slot management verifies target page belongs to the active `workspace_id`
- [ ] Publishing queue and publish logs routes filter items/logs strictly by the active `workspace_id`
- [ ] Page insights endpoint verifies target page belongs to the active `workspace_id`

## Global Media Library Tenancy

- [ ] `media_folders` and `media_items` allow global access across all workspaces owned by the user (`auth.uid() = user_id`)
- [ ] `workspace_id` on `media_folders` and `media_items` is nullable
- [ ] Sibling folder uniqueness is scoped per user (`user_id, parent_id, LOWER(name)`)
- [ ] Cross-user access to media items and folders is strictly prevented by RLS policies
