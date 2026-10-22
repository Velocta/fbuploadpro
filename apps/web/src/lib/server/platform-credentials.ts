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

/** Outcome of a low-level write: success, a database error, or no database available. */
type WriteOutcome = 'ok' | 'error' | 'unavailable';

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

function legacyDb(client: CredentialsClient): DatabaseClient | null {
  return isLegacyClient(client ?? undefined) ? (client as DatabaseClient) : null;
}

function supabaseDb(client: CredentialsClient): SupabaseClient<any> | null {
  if (legacyDb(client)) return null;
  return getRouteSupabase(client ?? undefined);
}

async function fetchRow(
  workspaceId: string,
  platform: ByocPlatform,
  client: CredentialsClient
): Promise<CredentialsRowShape | null> {
  const legacy = legacyDb(client);
  if (legacy) {
    try {
      const rows = (await legacy.query(
        `SELECT ${CREDENTIAL_COLUMNS}
         FROM platform_credentials
         WHERE workspace_id = $1 AND platform = $2
         LIMIT 1`,
        [workspaceId, platform]
      )) as CredentialsRowShape[];
      return rows?.[0] ?? null;
    } catch (err) {
      console.error('[Platform Credentials] Failed to read credentials (legacy client):', err);
      return null;
    }
  }

  const supabase = supabaseDb(client);
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('platform_credentials')
      .select(CREDENTIAL_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('platform', platform)
      .maybeSingle();
    if (error || !data) return null;
    return data as CredentialsRowShape;
  } catch (err) {
    console.error('[Platform Credentials] Failed to read credentials:', err);
    return null;
  }
}

async function upsertRow(
  workspaceId: string,
  platform: ByocPlatform,
  clientId: string,
  encryptedClientSecret: string,
  now: string,
  client: CredentialsClient
): Promise<WriteOutcome> {
  const legacy = legacyDb(client);
  if (legacy) {
    try {
      await legacy.query(
        `INSERT INTO platform_credentials (workspace_id, platform, client_id, encrypted_client_secret, status, updated_at)
         VALUES ($1, $2, $3, $4, 'unverified', $5)
         ON CONFLICT (workspace_id, platform) DO UPDATE SET
           client_id = EXCLUDED.client_id,
           encrypted_client_secret = EXCLUDED.encrypted_client_secret,
           status = 'unverified',
           updated_at = EXCLUDED.updated_at`,
        [workspaceId, platform, clientId, encryptedClientSecret, now]
      );
      return 'ok';
    } catch (err) {
      console.error('[Platform Credentials] Failed to save credentials (legacy client):', err);
      return 'error';
    }
  }

  const supabase = supabaseDb(client);
  if (!supabase) return 'unavailable';

  const { error } = await supabase.from('platform_credentials').upsert(
    {
      workspace_id: workspaceId,
      platform,
      client_id: clientId,
      encrypted_client_secret: encryptedClientSecret,
      status: 'unverified',
      updated_at: now,
    },
    { onConflict: 'workspace_id,platform' }
  );
  if (error) {
    console.error('[Platform Credentials] Upsert credentials error:', error);
    return 'error';
  }
  return 'ok';
}

async function updateRow(
  workspaceId: string,
  platform: ByocPlatform,
  patch: { client_id: string; status: PlatformCredentialStatus },
  client: CredentialsClient,
  now: string
): Promise<WriteOutcome>;
async function updateRow(
  workspaceId: string,
  platform: ByocPlatform,
  patch: { status: PlatformCredentialStatus; last_tested_at: string },
  client: CredentialsClient,
  now: string
): Promise<WriteOutcome>;
async function updateRow(
  workspaceId: string,
  platform: ByocPlatform,
  patch: { client_id?: string; status: PlatformCredentialStatus; last_tested_at?: string },
  client: CredentialsClient,
  now: string
): Promise<WriteOutcome> {
  const legacy = legacyDb(client);
  if (legacy) {
    try {
      if (patch.last_tested_at !== undefined) {
        await legacy.query(
          `UPDATE platform_credentials
           SET status = $3, last_tested_at = $4, updated_at = $5
           WHERE workspace_id = $1 AND platform = $2`,
          [workspaceId, platform, patch.status, patch.last_tested_at, now]
        );
      } else {
        await legacy.query(
          `UPDATE platform_credentials
           SET client_id = $3, status = $4, updated_at = $5
           WHERE workspace_id = $1 AND platform = $2`,
          [workspaceId, platform, patch.client_id, patch.status, now]
        );
      }
      return 'ok';
    } catch (err) {
      console.error('[Platform Credentials] Failed to update credentials (legacy client):', err);
      return 'error';
    }
  }

  const supabase = supabaseDb(client);
  if (!supabase) return 'unavailable';

  const { error } = await supabase
    .from('platform_credentials')
    .update({ ...patch, updated_at: now })
    .eq('workspace_id', workspaceId)
    .eq('platform', platform);
  if (error) {
    console.error('[Platform Credentials] Update credentials error:', error);
    return 'error';
  }
  return 'ok';
}

async function deleteRow(
  workspaceId: string,
  platform: ByocPlatform,
  client: CredentialsClient
): Promise<WriteOutcome> {
  const legacy = legacyDb(client);
  if (legacy) {
    try {
      await legacy.query(
        `DELETE FROM platform_credentials WHERE workspace_id = $1 AND platform = $2`,
        [workspaceId, platform]
      );
      return 'ok';
    } catch (err) {
      console.error('[Platform Credentials] Failed to delete credentials (legacy client):', err);
      return 'error';
    }
  }

  const supabase = supabaseDb(client);
  if (!supabase) return 'unavailable';

  const { error } = await supabase
    .from('platform_credentials')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('platform', platform);
  if (error) {
    console.error('[Platform Credentials] Delete credentials error:', error);
    return 'error';
  }
  return 'ok';
}

function outcomeToResult(outcome: WriteOutcome, errorMessage: string): PlatformCredentialsMutationResult {
  if (outcome === 'ok') return { ok: true };
  if (outcome === 'unavailable') {
    return { ok: false, error: 'Database service unavailable', status: 503 };
  }
  return { ok: false, error: errorMessage, status: 500 };
}

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
  const row = await fetchRow(workspaceId, platform, client);
  return row ? toRecord(row, workspaceId, platform) : null;
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
  const now = new Date().toISOString();
  const hasNewSecret = Boolean(input.clientSecret && input.clientSecret.length > 0);

  if (!hasNewSecret) {
    const existing = await fetchRow(workspaceId, platform, client);
    if (!existing?.encrypted_client_secret) {
      return {
        ok: false,
        error: `Enter your ${PLATFORM_LABELS[platform]} App Secret to complete setup.`,
        status: 400,
      };
    }
    const outcome = await updateRow(
      workspaceId,
      platform,
      { client_id: input.clientId, status: 'unverified' },
      client,
      now
    );
    return outcomeToResult(outcome, 'Failed to update credentials');
  }

  let encryptedSecret: string;
  try {
    encryptedSecret = await encryptToken(input.clientSecret as string, getTokenEncryptionKey());
  } catch (err) {
    console.error('[Platform Credentials] Failed to encrypt client secret:', err);
    return { ok: false, error: 'Failed to save credentials', status: 500 };
  }

  const outcome = await upsertRow(workspaceId, platform, input.clientId, encryptedSecret, now, client);
  return outcomeToResult(outcome, 'Failed to save credentials');
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
  const outcome = await deleteRow(workspaceId, platform, client);
  return outcomeToResult(outcome, `Failed to disconnect ${PLATFORM_LABELS[platform]}`);
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
  const outcome = await updateRow(
    workspaceId,
    platform,
    { status: result.status, last_tested_at: result.lastTestedAt ?? new Date().toISOString() },
    client,
    new Date().toISOString()
  );
  return outcomeToResult(outcome, 'Failed to update credentials status');
}
