/**
 * Shared parsing for the stable public platform callbacks (deauthorize and
 * data deletion). Platforms send these as JSON, as form fields, or as a
 * Meta-style `signed_request`.
 *
 * These endpoints are public and unauthenticated, so a bare account ID in
 * a body is NEVER trusted: revocation happens only for a `signed_request`
 * whose HMAC-SHA256 signature verifies against the app secret of the
 * workspace that owns the account row. Anything else — unsigned bodies,
 * malformed or wrongly-signed requests, accounts whose workspace has no
 * resolvable secret — is treated as unidentified and changes nothing.
 * Platform-specific refinements belong to spec 124+.
 */
import type { NextRequest } from 'next/server';
import type { Platform } from '@fbuploadpro/contracts';
import {
  findSocialAccountsByExternalId,
  markSocialAccountRevoked,
  resolvePlatformClientCredentials,
  type ConnectDbClient,
} from './persist';
import { resolveConnectDbClient } from './session';

function base64UrlToBytes(segment: string): Uint8Array | null {
  if (!segment) return null;
  try {
    let base64 = segment.replaceAll('-', '+').replaceAll('_', '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.codePointAt(i) ?? 0;
    }
    return bytes;
  } catch {
    return null;
  }
}

function decodeSignedRequestPayload(
  signedRequest: string
): Record<string, unknown> | null {
  const parts = signedRequest.split('.');
  if (parts.length !== 2 || !parts[1]) return null;
  const bytes = base64UrlToBytes(parts[1]);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

interface SignedRequestParts {
  signatureSegment: string;
  payloadSegment: string;
  payload: Record<string, unknown> | null;
}

function parseSignedRequest(signedRequest: string): SignedRequestParts | null {
  const parts = signedRequest.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return {
    signatureSegment: parts[0],
    payloadSegment: parts[1],
    payload: decodeSignedRequestPayload(signedRequest),
  };
}

/**
 * Verifies a Meta-style signed_request signature: HMAC-SHA256 over the
 * payload segment, keyed with the platform app secret, base64url-encoded.
 * Uses WebCrypto's verify (the repo's existing HMAC path, as in state.ts),
 * which compares in constant time.
 */
async function verifySignedRequestSignature(
  signed: SignedRequestParts,
  appSecret: string
): Promise<boolean> {
  const signatureBytes = base64UrlToBytes(signed.signatureSegment);
  if (!signatureBytes) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as unknown as BufferSource,
      new TextEncoder().encode(signed.payloadSegment)
    );
  } catch {
    return false;
  }
}

function pickAccountId(
  record: Record<string, unknown> | null
): string | null {
  if (!record) return null;
  for (const key of ['user_id', 'userId', 'account_id', 'accountId', 'id']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function pickAccountIdFromRecord(
  record: Record<string, unknown> | null
): string | null {
  const direct = pickAccountId(record);
  if (direct) return direct;
  if (record && typeof record.signed_request === 'string') {
    return pickAccountId(decodeSignedRequestPayload(record.signed_request));
  }
  return null;
}

function recordFromFormData(
  form: Awaited<ReturnType<NextRequest['formData']>>
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    record[key] = typeof value === 'string' ? value : '';
  }
  return record;
}

async function parseCallbackRecord(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      return (await request.json()) as Record<string, unknown>;
    }
    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      return recordFromFormData(await request.formData());
    }
  } catch (err) {
    console.error('[connect/platform-callback] Failed to parse body:', err);
  }
  return null;
}

/**
 * Parses the account ID a callback body claims, without trusting it.
 * Parsing only — revocation goes through processPlatformRevocation, which
 * requires a verified signed_request.
 */
export async function extractExternalAccountId(
  request: NextRequest
): Promise<string | null> {
  const record = await parseCallbackRecord(request);
  if (!record) return null;
  return pickAccountIdFromRecord(record);
}

/**
 * Revokes the account in one workspace, but only when the signed_request
 * signature verifies against that workspace's own platform app secret.
 * Returns how many rows were revoked (0 when unverifiable).
 */
async function revokeForWorkspaceIfVerified(
  client: ConnectDbClient,
  platform: Platform,
  externalAccountId: string,
  workspaceId: string,
  signed: SignedRequestParts,
  logLabel: string
): Promise<number> {
  let clientSecret: string | null = null;
  try {
    const credentials = await resolvePlatformClientCredentials(
      client,
      workspaceId,
      platform
    );
    clientSecret = credentials?.clientSecret ?? null;
  } catch (err) {
    console.error(
      `[connect/${logLabel}] Failed to resolve app secret for revocation check`,
      { platform, externalAccountId, workspaceId, err }
    );
    return 0;
  }
  if (!clientSecret) {
    console.info(
      `[connect/${logLabel}] No app secret available to verify revocation; ignoring`,
      { platform, externalAccountId, workspaceId }
    );
    return 0;
  }
  const verified = await verifySignedRequestSignature(signed, clientSecret);
  if (!verified) {
    console.warn(
      `[connect/${logLabel}] signed_request signature did not verify; ignoring`,
      { platform, externalAccountId, workspaceId }
    );
    return 0;
  }
  const { updated } = await markSocialAccountRevoked(
    client,
    platform,
    externalAccountId,
    workspaceId
  );
  return updated;
}

/**
 * Shared body of the deauthorize / data-deletion callbacks. Only a
 * signed_request payload is considered, and only rows in workspaces whose
 * app secret verifies its signature are revoked. Every other request is
 * an unidentified no-op.
 */
export async function processPlatformRevocation(
  request: NextRequest,
  platform: Platform,
  logLabel: string,
  dbClient?: ConnectDbClient
): Promise<{ externalAccountId: string | null; updated: number }> {
  const record = await parseCallbackRecord(request);
  const signedRequest =
    record && typeof record.signed_request === 'string'
      ? record.signed_request
      : null;
  const signed = signedRequest ? parseSignedRequest(signedRequest) : null;
  const externalAccountId = signed ? pickAccountId(signed.payload) : null;
  console.info(`[connect/${logLabel}] Received platform notice`, {
    platform,
    identified: Boolean(externalAccountId),
  });

  if (!signed || !externalAccountId) {
    if (record && !signedRequest) {
      console.warn(
        `[connect/${logLabel}] Unsigned callback body ignored; a verified signed_request is required`,
        { platform }
      );
    }
    return { externalAccountId: null, updated: 0 };
  }

  const client = resolveConnectDbClient(dbClient);
  if (!client) {
    console.error(
      `[connect/${logLabel}] No database client available to record revocation`,
      { platform }
    );
    return { externalAccountId: null, updated: 0 };
  }

  const candidates = await findSocialAccountsByExternalId(
    client,
    platform,
    externalAccountId
  );
  if (candidates.length === 0) {
    console.info(`[connect/${logLabel}] No matching account to revoke`, {
      platform,
      externalAccountId,
    });
    return { externalAccountId: null, updated: 0 };
  }

  const workspaceIds = [
    ...new Set(candidates.map((candidate) => candidate.workspaceId)),
  ];
  const perWorkspace = await Promise.all(
    workspaceIds.map((workspaceId) =>
      revokeForWorkspaceIfVerified(
        client,
        platform,
        externalAccountId,
        workspaceId,
        signed,
        logLabel
      )
    )
  );
  const updated = perWorkspace.reduce((sum, n) => sum + n, 0);

  if (updated === 0) {
    return { externalAccountId: null, updated: 0 };
  }
  console.info(`[connect/${logLabel}] Accounts marked revoked`, {
    platform,
    updated,
  });
  return { externalAccountId, updated };
}
