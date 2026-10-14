# Data Model: 041-strict-workspace-byoc-isolation

## Database Entities & Schemas

### 1. `media_folders` (Updated)
- **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Columns**:
  - `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`
  - `workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE SET NULL` *(Changed from NOT NULL to NULL)*
  - `parent_id UUID NULL REFERENCES public.media_folders(id) ON DELETE CASCADE`
  - `name VARCHAR(255) NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Constraints & Indexes**:
  - `CHECK (id <> parent_id)`
  - Sibling unique indexes per user:
    - Root: `UNIQUE (user_id, LOWER(name)) WHERE parent_id IS NULL`
    - Subfolder: `UNIQUE (user_id, parent_id, LOWER(name)) WHERE parent_id IS NOT NULL`
- **RLS**:
  - `media_folders_user_access`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

### 2. `media_items` (Updated)
- **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Columns**:
  - `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`
  - `workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE SET NULL` *(Changed from NOT NULL to NULL)*
  - `folder_id UUID NULL REFERENCES public.media_folders(id) ON DELETE RESTRICT`
  - `name VARCHAR(255) NOT NULL`
  - `file_size BIGINT NOT NULL`
  - `mime_type VARCHAR(100) NOT NULL`
  - `media_type VARCHAR(20) NOT NULL`
  - `storage_key TEXT NOT NULL`
  - `url TEXT NOT NULL`
  - `thumbnail_key TEXT NULL`
  - `thumbnail_url TEXT NULL`
  - `duration_seconds NUMERIC(8,2) NULL`
  - `aspect_ratio VARCHAR(10) NOT NULL`
  - `caption_text TEXT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **RLS**:
  - `media_items_user_access`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

### 3. `facebook_accounts` (Workspace Isolated)
- **Columns**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`
  - `workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE`
  - `fb_account_id VARCHAR(100) NOT NULL`
  - `display_name TEXT NOT NULL`
  - `status facebook_account_status NOT NULL DEFAULT 'active'`
  - `encrypted_access_token TEXT NOT NULL`
  - `token_expires_at TIMESTAMPTZ NULL`
  - `profile_picture_url TEXT NULL`
  - `gender VARCHAR(50) NULL`
  - `account_link TEXT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Unique Constraint**: `uq_fb_accounts_workspace_account UNIQUE (workspace_id, fb_account_id)`

### 4. `facebook_pages` (Workspace Isolated)
- **Columns**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`
  - `workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE`
  - `facebook_account_id UUID NOT NULL REFERENCES public.facebook_accounts(id) ON DELETE CASCADE`
  - `fb_page_id VARCHAR(100) NOT NULL`
  - `page_name TEXT NOT NULL`
  - `status facebook_page_status NOT NULL DEFAULT 'active'`
  - `encrypted_access_token TEXT NOT NULL`
  - `category VARCHAR(100) NULL`
  - `tasks JSONB NOT NULL DEFAULT '[]'`
  - `profile_picture_url TEXT NULL`
  - `starting_followers INT NOT NULL DEFAULT 0`
  - `current_followers INT NOT NULL DEFAULT 0`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Unique Constraint**: `uq_fb_pages_workspace_page UNIQUE (workspace_id, fb_page_id)`

### 5. `workspace_byoc_credentials`
- **Columns**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE`
  - `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`
  - `fb_app_id VARCHAR(100) NOT NULL`
  - `encrypted_fb_app_secret TEXT NOT NULL`
  - `webhook_verify_token TEXT NULL`
  - `status VARCHAR(20) NOT NULL DEFAULT 'unverified'`
  - `last_tested_at TIMESTAMPTZ NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
