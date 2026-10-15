# Data Model: First Comment Scope Alignment

## Existing Database Entities (No Migrations Required)

The data substrate already possesses the necessary fields to persist and track automated first comments:

1. **`queue_items` Table**:
   - `first_comment`: `TEXT NULL` (User-specified text to publish as the initial comment on the post).
   - `fb_comment_id`: `VARCHAR(255) NULL` (Stores the returned Meta Graph API comment identifier after successful comment creation).
   - Constraint: `chk_queue_items_story_no_comment` enforces that stories must have `first_comment = NULL`.

2. **`workspace_byoc_credentials` Table**:
   - `fb_app_id`: `VARCHAR(255) NOT NULL` (Target Meta App ID used in OAuth dialog).
   - `encrypted_fb_app_secret`: `TEXT NOT NULL` (AES-256-GCM encrypted App Secret).
   - `webhook_verify_token`: `VARCHAR(255) NULL` (Token for Webhook verification).

3. **`facebook_pages` Table**:
   - `encrypted_access_token`: `TEXT NOT NULL` (Page Access Token containing the granted scopes, including `pages_manage_engagement` upon new OAuth authorization).

## Scope String Definition

```typescript
export const FACEBOOK_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_engagement',
  'business_management',
] as const;
```
