# Research & Architecture Decisions: 041-strict-workspace-byoc-isolation

## Decision 1: Shared Server Helper `resolveWorkspaceFacebookCredentials`

- **Context**: Multiple routes (`/api/auth/facebook`, `/api/auth/facebook/callback`, `/connect/facebook`, `/api/tenant/[subdomain]/accounts/magic-link`) need to resolve the active workspace's Facebook App ID and decrypted App Secret.
- **Decision**: Create a shared server helper in `apps/web/src/lib/server/byoc-resolver.ts`:
  ```ts
  export async function resolveWorkspaceFacebookCredentials(
    supabase: SupabaseClient<Database>,
    subdomain: string,
    userId: string
  ): Promise<
    | { ok: true; workspaceId: string; fbAppId: string; decryptedAppSecret: string }
    | { ok: false; error: 'WORKSPACE_NOT_FOUND' | 'BYOC_NOT_CONFIGURED'; message: string }
  >
  ```
- **Rationale**: Eliminates duplicate SQL/PostgREST queries, ensures consistent ownership checks (`subdomain` + `owner_id`), and provides a uniform typed error envelope without relying on `process.env`.
- **Alternatives Considered**: Inlining queries into each route. Rejected because inlined queries led to inconsistency (some queried `owner_id`, others did not; some fell back to `process.env`, others did not).

---

## Decision 2: Global User Media Library Database Migration

- **Context**: In migration `20261014140000_tenant_resources_workspace_isolation.sql`, `workspace_id` was made `NOT NULL` on `media_folders` and `media_items`, and unique constraint `uq_media_folders_workspace_name UNIQUE (workspace_id, name)` was created, restricting media to a single workspace.
- **Decision**: In forward migration `20261014180000_global_user_media_library.sql`:
  1. Alter `media_folders` and `media_items` to make `workspace_id` nullable (`ALTER COLUMN workspace_id DROP NOT NULL`).
  2. Drop `uq_media_folders_workspace_name`.
  3. Enforce sibling-scoped uniqueness per user (`user_id`):
     - For root folders (`parent_id IS NULL`): unique index on `(user_id, LOWER(name)) WHERE parent_id IS NULL`.
     - For nested folders (`parent_id IS NOT NULL`): unique index on `(user_id, parent_id, LOWER(name)) WHERE parent_id IS NOT NULL`.
  4. Update RLS policies `media_folders_user_access` and `media_items_user_access` to strictly check `auth.uid() = user_id`.
- **Rationale**: Media assets belong to the user's account and creative library, not a single workspace. This allows creators with multiple brand workspaces to reuse uploaded videos and images across workspaces without duplicating storage in Cloudflare R2.
- **Alternatives Considered**: Duplicating media records per workspace. Rejected because it wastes R2 storage, confuses users, and requires re-uploading the same videos multiple times.

---

## Decision 3: BYOC Empty Secret Validation on Initial Save

- **Context**: In `PUT /api/tenant/[subdomain]/settings/byoc`, when `fbAppSecret` is empty, the route executed an `UPDATE ... WHERE workspace_id = $workspaceId`. If no row existed yet, the update matched 0 rows, but returned `{ success: true, hasSecret: true }`.
- **Decision**: When `fbAppSecret` is omitted/empty, check whether an existing row with `encrypted_fb_app_secret` exists in `workspace_byoc_credentials`. If absent, return HTTP 400 Bad Request with `"Enter your Facebook App Secret to complete setup."`
- **Rationale**: Guarantees users cannot leave BYOC in an incomplete "half-saved" state.

---

## Decision 4: Multi-Workspace Isolation for Accounts, Pages, Queues, Logs, and Insights

- **Context**: Previously, routes like `GET /api/tenant/[subdomain]/accounts`, `GET /pages`, `/publishing/queue`, and `/publishing/logs` filtered only by `user_id = session.userId`.
- **Decision**:
  1. Resolve `workspace.id` from `workspaces.subdomain = subdomain AND workspaces.owner_id = session.userId`.
  2. Filter `facebook_accounts` and `facebook_pages` by `workspace_id = workspace.id`.
  3. Filter slots, queue items, publish logs, and insights by ensuring the target `fb_page_id` belongs to `workspace_id`.
- **Rationale**: Enforces complete tenant separation so brand A never sees or modifies brand B's pages or queues.
