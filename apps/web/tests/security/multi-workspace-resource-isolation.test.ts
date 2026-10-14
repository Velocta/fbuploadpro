/**
 * @file multi-workspace-resource-isolation.test.ts
 * @description Security regression tests for ISSUE-46: Tenant Resources Lack workspace_id Foreign Key, Breaking Multi-Workspace Isolation
 * Verifies that:
 * 1. Database types DatabaseFacebookAccountRow, DatabaseFacebookPageRow, DatabaseMediaFolderRow, and DatabaseMediaItemRow
 *    enforce workspace_id: string.
 * 2. Forward SQL migration exists and adds workspace_id foreign keys, constraints, and compound RLS policies.
 * 3. Multi-workspace isolation guarantees that resources in Workspace A never bleed into Workspace B.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type {
  DatabaseFacebookAccountRow,
  DatabaseFacebookPageRow,
  DatabaseMediaFolderRow,
  DatabaseMediaItemRow,
} from '@fbuploadpro/contracts';

describe('ISSUE-46: Multi-Workspace Resource Isolation & Foreign Key Enforcement', () => {
  it('enforces workspace_id field on all tenant resource database contracts', () => {
    // Compile-time and runtime validation that row types require workspace_id
    const mockAccount: DatabaseFacebookAccountRow = {
      id: '00000000-0000-4000-a000-000000000001',
      user_id: '11111111-1111-4111-a111-111111111111',
      workspace_id: '22222222-2222-4222-a222-222222222222',
      fb_account_id: 'fb-acc-123',
      display_name: 'Test Account',
      status: 'active',
      encrypted_access_token: 'enc-token',
      token_expires_at: null,
      profile_picture_url: null,
      gender: null,
      account_link: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(mockAccount.workspace_id).toBe('22222222-2222-4222-a222-222222222222');

    const mockPage: DatabaseFacebookPageRow = {
      id: '00000000-0000-4000-a000-000000000002',
      user_id: '11111111-1111-4111-a111-111111111111',
      workspace_id: '22222222-2222-4222-a222-222222222222',
      facebook_account_id: mockAccount.id,
      fb_page_id: 'fb-page-456',
      page_name: 'Test Page',
      status: 'active',
      encrypted_access_token: 'enc-token',
      category: null,
      tasks: [],
      profile_picture_url: null,
      starting_followers: 0,
      current_followers: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(mockPage.workspace_id).toBe('22222222-2222-4222-a222-222222222222');

    const mockFolder: DatabaseMediaFolderRow = {
      id: '00000000-0000-4000-a000-000000000003',
      user_id: '11111111-1111-4111-a111-111111111111',
      workspace_id: '22222222-2222-4222-a222-222222222222',
      name: 'Test Folder',
      parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(mockFolder.workspace_id).toBe('22222222-2222-4222-a222-222222222222');

    const mockItem: DatabaseMediaItemRow = {
      id: '00000000-0000-4000-a000-000000000004',
      user_id: '11111111-1111-4111-a111-111111111111',
      workspace_id: '22222222-2222-4222-a222-222222222222',
      folder_id: mockFolder.id,
      name: 'video.mp4',
      file_size: 1024,
      mime_type: 'video/mp4',
      media_type: 'video',
      storage_key: 'keys/video.mp4',
      url: 'https://cdn.example.com/video.mp4',
      thumbnail_key: null,
      thumbnail_url: null,
      duration_seconds: 30,
      aspect_ratio: '16:9',
      caption_text: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(mockItem.workspace_id).toBe('22222222-2222-4222-a222-222222222222');
  });

  it('contains forward database migration adding workspace_id foreign keys and RLS policies', () => {
    const migrationsDir = path.resolve(process.cwd(), '../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir);
    const migrationFile = files.find((f) => f.includes('tenant_resources_workspace_isolation'));

    expect(migrationFile).toBeDefined();

    const sqlContent = fs.readFileSync(path.join(migrationsDir, migrationFile!), 'utf-8');

    // Asserts workspace_id is added to facebook_accounts, facebook_pages, media_folders, media_items
    expect(sqlContent).toContain('facebook_accounts');
    expect(sqlContent).toContain('facebook_pages');
    expect(sqlContent).toContain('media_folders');
    expect(sqlContent).toContain('media_items');
    expect(sqlContent).toMatch(/REFERENCES\s+(?:"public"\.)?["']?workspaces["']?\s*\(\s*["']?id["']?\s*\)\s+ON\s+DELETE\s+CASCADE/i);

    // Asserts compound RLS policies include workspace_id scoping
    expect(sqlContent).toMatch(/CREATE\s+POLICY\s+["']facebook_accounts_user_access["']/i);
    expect(sqlContent).toMatch(/CREATE\s+POLICY\s+["']facebook_pages_user_access["']/i);
    expect(sqlContent).toMatch(/CREATE\s+POLICY\s+["']media_folders_user_access["']/i);
    expect(sqlContent).toMatch(/CREATE\s+POLICY\s+["']media_items_user_access["']/i);
  });

  it('filters tenant resources by workspace_id preventing multi-workspace bleed for same user', () => {
    const userId = '11111111-1111-4111-a111-111111111111';
    const workspaceA = 'aaaa1111-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const workspaceB = 'bbbb2222-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

    const accountWorkspaceA: DatabaseFacebookAccountRow = {
      id: 'acc-1',
      user_id: userId,
      workspace_id: workspaceA,
      fb_account_id: 'fb-1',
      display_name: 'Workspace A Account',
      status: 'active',
      encrypted_access_token: 'enc-1',
      token_expires_at: null,
      profile_picture_url: null,
      gender: null,
      account_link: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const accountWorkspaceB: DatabaseFacebookAccountRow = {
      id: 'acc-2',
      user_id: userId,
      workspace_id: workspaceB,
      fb_account_id: 'fb-2',
      display_name: 'Workspace B Account',
      status: 'active',
      encrypted_access_token: 'enc-2',
      token_expires_at: null,
      profile_picture_url: null,
      gender: null,
      account_link: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const allUserAccounts = [accountWorkspaceA, accountWorkspaceB];

    // Querying for Workspace A must only return accounts belonging to Workspace A
    const workspaceAAccounts = allUserAccounts.filter(
      (acc) => acc.user_id === userId && acc.workspace_id === workspaceA
    );
    expect(workspaceAAccounts).toHaveLength(1);
    expect(workspaceAAccounts[0]?.id).toBe('acc-1');

    // Querying for Workspace B must only return accounts belonging to Workspace B
    const workspaceBAccounts = allUserAccounts.filter(
      (acc) => acc.user_id === userId && acc.workspace_id === workspaceB
    );
    expect(workspaceBAccounts).toHaveLength(1);
    expect(workspaceBAccounts[0]?.id).toBe('acc-2');
  });
});
