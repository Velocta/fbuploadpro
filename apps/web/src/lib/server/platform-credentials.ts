import { z } from 'zod';
import {
  encryptToken,
  getTokenEncryptionKey,
  type DatabaseClient,
  type DatabasePlatformCredentialsRow,
  type Platform,
} from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Per-platform credentials service (spec 123, Part A).
 *
 * All reads and writes go to the unified `platform_credentials` table
 * (spec 120), keyed by (workspace_id, platform). Rows exist ONLY for the
 * bring-your-own-app platforms — facebook, instagram, threads. YouTube and
 * TikTok connect through our publishing partner and X uses our own single
 * app, so this service refuses to read or write rows for them.
 */

export type ByocPlatform = 'facebook' | 'instagram' | 'threads';

export const BYOC_PLATFORMS: readonly ByocPlatform[] = ['facebook', 'instagram', 'threads'];

const PLATFORM_LABELS: Record<ByocPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
};

export function isByocPlatform(platform: string): platform is ByocPlatform {
  return (BYOC_PLATFORMS as readonly string[]).includes(platform);
}

export function platformLabel(platform: ByocPlatform): string {
  return PLATFORM_LABELS[platform];
}

export class UnsupportedPlatformError extends Error {
  readonly platform: string;

  constructor(platform: string) {
    super(
      `App credentials are only managed for Facebook, Instagram, and Threads. "${platform}" does not use app details you add here.`
    );
    this.name = 'UnsupportedPlatformError';
    this.platform = platform;
  }
}

function assertByocPlatform(platform: Platform | string): asserts platform is ByocPlatform {
  if (!isByocPlatform(platform)) {
    throw new UnsupportedPlatformError(platform);
  }
}

export type PlatformCredentialStatus = DatabasePlatformCredentialsRow['status'];

export interface PlatformCredentialsRecord {
  id: string | null;
  workspaceId: string;
  platform: ByocPlatform;
  clientId: string;
  encryptedClientSecret: string;
  status: PlatformCredentialStatus;
  lastTestedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SavePlatformCredentialsInput {
  clientId: string;
  clientSecret?: string | undefined;
}

export type PlatformCredentialsMutationResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

type CredentialsClient = DatabaseClient | SupabaseClient<any> | null | undefined;

const CREDENTIAL_COLUMNS =
  'id, workspace_id, platform, client_id, encrypted_client_secret, status, last_tested_at, created_at, updated_at';

interface CredentialsRowShape {
  id?: string | null;
  workspace_id?: string;
  platform?: string;
  client_id?: string;
  encrypted_client_secret?: string;
  status?: string;
  last_tested_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function toRecord(row: CredentialsRowShape, workspaceId: string, platform: ByocPlatform): PlatformCredentialsRecord {
  return {
    id: row.id ?? null,
    workspaceId: row.workspace_id ?? workspaceId,
    platform,
    clientId: row.client_id ?? '',
    encryptedClientSecret: row.encrypted_client_secret ?? '',
    status: (row.status as PlatformCredentialStatus) || 'unverified',
    lastTestedAt: row.last_tested_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/** Request body for saving a platform's app details (generic instagram/threads route). */
export const SavePlatformCredentialsRequestSchema = z.object({
  appId: z
    .string()
    .trim()
    .min(1, 'Enter the App ID for this platform.')
    .max(100, 'That App ID is too long. Check it and try again.'),
  appSecret: z
    .string()
    .trim()
    .max(128, 'That App Secret is too long. Check it and try again.')
    .optional()
    .or(z.literal('')),
});
export type SavePlatformCredentialsRequest = z.infer<typeof SavePlatformCredentialsRequestSchema>;

/**
 * Returns the stored credentials row for a workspace + BYOC platform, or
 * null when none has been saved yet. Throws UnsupportedPlatformError for
 * youtube / x / tiktok.
 */
export async function getCredentials(
  workspaceId: string,
  platform: Platform | string,
  client?: CredentialsClient
): Promise<PlatformCredentialsRecord | null> {
  assertByocPlatform(platform);

  if (isLegacyClient(client ?? undefined)) {
    const legacyClient = client as DatabaseClient;
    try {
      const rows = (await legacyClient.query(
        `SELECT ${CREDENTIAL_COLUMNS}
         FROM platform_credentials
         WHERE workspace_id = $1 AND platform = $2
         LIMIT 1`,
        [workspaceId, platform]
      )) as CredentialsRowShape[];
      const row = rows?.[0];
      return row ? toRecord(row, workspaceId, platform) : null;
    } catch (err) {
      console.error('[Platform Credentials] Failed to read credentials (legacy client):', err);
      return null;
    }
  }

  const supabase = getRouteSupabase(client ?? undefined);
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('platform_credentials')
      .select(CREDENTIAL_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('platform', platform)
      .maybeSingle();

    if (error || !data) return null;
    return toRecord(data as CredentialsRowShape, workspaceId, platform);
  } catch (err) {
    console.error('[Platform Credentials] Failed to read credentials:', err);
    return null;
  }
}

/**
 * Saves a workspace's app details for a BYOC platform. A supplied secret is
 * encrypted before storage; when no new secret is supplied, the previously
 * saved secret is kept (and saving fails if there is none yet). Saving
 * always resets the status to 'unverified' until the details are tested.
 * Only the platform_credentials row is written — connected accounts and
 * their tokens are never touched.
 */
export async function saveCredentials(
  workspaceId: string,
  platform: Platform | string,
  input: SavePlatformCredentialsInput,
  client?: CredentialsClient
): Promise<PlatformCredentialsMutationResult> {
  assertByocPlatform(platform);
  const label = PLATFORM_LABELS[platform];
  const now = new Date().toISOString();
  const hasNewSecret = Boolean(input.clientSecret && input.clientSecret.length > 0);

  if (!hasNewSecret) {
    const existing = await getCredentials(workspaceId, platform, client);
    if (!existing?.encryptedClientSecret) {
      return {
        ok: false,
        error: `Enter your ${label} App Secret to complete setup.`,
        status: 400,
      };
    }
  }

  if (isLegacyClient(client ?? undefined)) {
    const legacyClient = client as DatabaseClient;
    try {
      if (hasNewSecret) {
        const encryptedSecret = await encryptToken(
          input.clientSecret as string,
          getTokenEncryptionKey()
        );
        await legacyClient.query(
          `INSERT INTO platform_credentials (workspace_id, platform, client_id, encrypted_client_secret, status, updated_at)
           VALUES ($1, $2, $3, $4, 'unverified', $5)
           ON CONFLICT (workspace_id, platform) DO UPDATE SET
             client_id = EXCLUDED.client_id,
             encrypted_client_secret = EXCLUDED.encrypted_client_secret,
             status = 'unverified',
             updated_at = EXCLUDED.updated_at`,
          [workspaceId, platform, input.clientId, encryptedSecret, now]
        );
        return { ok: true };
      }

      await legacyClient.query(
        `UPDATE platform_credentials
         SET client_id = $3, status = 'unverified', updated_at = $4
         WHERE workspace_id = $1 AND platform = $2`,
        [workspaceId, platform, input.clientId, now]
      );
      return { ok: true };
    } catch (err) {
      console.error('[Platform Credentials] Failed to save credentials (legacy client):', err);
      return {
        ok: false,
        error: hasNewSecret ? 'Failed to save credentials' : 'Failed to update credentials',
        status: 500,
      };
    }
  }

  const supabase = getRouteSupabase(client ?? undefined);
  if (!supabase) {
    return { ok: false, error: 'Database service unavailable', status: 503 };
  }

  try {
    if (hasNewSecret) {
      const encryptedSecret = await encryptToken(
        input.clientSecret as string,
        getTokenEncryptionKey()
      );

      const { error: upsertErr } = await supabase.from('platform_credentials').upsert(
        {
          workspace_id: workspaceId,
          platform,
          client_id: input.clientId,
          encrypted_client_secret: encryptedSecret,
          status: 'unverified',
          updated_at: now,
        },
        { onConflict: 'workspace_id,platform' }
      );

      if (upsertErr) {
        console.error('[Platform Credentials] Upsert credentials error:', upsertErr);
        return { ok: false, error: 'Failed to save credentials', status: 500 };
      }
      return { ok: true };
    }

    const { error: updateErr } = await supabase
      .from('platform_credentials')
      .update({
        client_id: input.clientId,
        status: 'unverified',
        updated_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('platform', platform);

    if (updateErr) {
      console.error('[Platform Credentials] Update credentials error:', updateErr);
      return { ok: false, error: 'Failed to update credentials', status: 500 };
    }
    return { ok: true };
  } catch (err) {
    console.error('[Platform Credentials] Failed to save credentials:', err);
    return { ok: false, error: 'Failed to save credentials', status: 500 };
  }
}

/**
 * Deletes ONLY the credentials row for a workspace + BYOC platform.
 * Connected accounts, destinations, media, and scheduled posts remain
 * fully intact — posting continues, but no new accounts can be connected
 * for that platform until details are added again.
 */
export async function deleteCredentials(
  workspaceId: string,
  platform: Platform | string,
  client?: CredentialsClient
): Promise<PlatformCredentialsMutationResult> {
  assertByocPlatform(platform);
  const label = PLATFORM_LABELS[platform];

  if (isLegacyClient(client ?? undefined)) {
    const legacyClient = client as DatabaseClient;
    try {
      await legacyClient.query(
        `DELETE FROM platform_credentials WHERE workspace_id = $1 AND platform = $2`,
        [workspaceId, platform]
      );
      return { ok: true };
    } catch (err) {
      console.error('[Platform Credentials] Failed to delete credentials (legacy client):', err);
      return { ok: false, error: `Failed to disconnect ${label}`, status: 500 };
    }
  }

  const supabase = getRouteSupabase(client ?? undefined);
  if (!supabase) {
    return { ok: false, error: 'Database service unavailable', status: 503 };
  }

  try {
    const { error: deleteErr } = await supabase
      .from('platform_credentials')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('platform', platform);

    if (deleteErr) {
      console.error('[Platform Credentials] Delete credentials error:', deleteErr);
      return { ok: false, error: `Failed to disconnect ${label}`, status: 500 };
    }
    return { ok: true };
  } catch (err) {
    console.error('[Platform Credentials] Failed to delete credentials:', err);
    return { ok: false, error: `Failed to disconnect ${label}`, status: 500 };
  }
}

/**
 * Records the outcome of a credentials test: updates the row's status and
 * the time it was last tested, without changing the stored details.
 */
export async function updateCredentialsTestResult(
  workspaceId: string,
  platform: Platform | string,
  result: { status: PlatformCredentialStatus; lastTestedAt?: string },
  client?: CredentialsClient
): Promise<PlatformCredentialsMutationResult> {
  assertByocPlatform(platform);
  const testedAt = result.lastTestedAt ?? new Date().toISOString();
  const now = new Date().toISOString();

  if (isLegacyClient(client ?? undefined)) {
    const legacyClient = client as DatabaseClient;
    try {
      await legacyClient.query(
        `UPDATE platform_credentials
         SET status = $3, last_tested_at = $4, updated_at = $5
         WHERE workspace_id = $1 AND platform = $2`,
        [workspaceId, platform, result.status, testedAt, now]
      );
      return { ok: true };
    } catch (err) {
      console.error('[Platform Credentials] Failed to update test result (legacy client):', err);
      return { ok: false, error: 'Failed to update credentials status', status: 500 };
    }
  }

  const supabase = getRouteSupabase(client ?? undefined);
  if (!supabase) {
    return { ok: false, error: 'Database service unavailable', status: 503 };
  }

  try {
    const { error: updateErr } = await supabase
      .from('platform_credentials')
      .update({
        status: result.status,
        last_tested_at: testedAt,
        updated_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('platform', platform);

    if (updateErr) {
      console.error('[Platform Credentials] Update test result error:', updateErr);
      return { ok: false, error: 'Failed to update credentials status', status: 500 };
    }
    return { ok: true };
  } catch (err) {
    console.error('[Platform Credentials] Failed to update test result:', err);
    return { ok: false, error: 'Failed to update credentials status', status: 500 };
  }
}
