/**
 * Shared parsing for the stable public platform callbacks (deauthorize and
 * data deletion). Platforms send these as JSON, as form fields, or as a
 * Meta-style `signed_request`; this extracts the platform's account ID when
 * one is present. Platform-specific refinements belong to spec 124+.
 */
import type { NextRequest } from 'next/server';

function decodeSignedRequestPayload(
  signedRequest: string
): Record<string, unknown> | null {
  const parts = signedRequest.split('.');
  if (parts.length !== 2 || !parts[1]) return null;
  try {
    let base64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.codePointAt(i) ?? 0;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
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

export async function extractExternalAccountId(
  request: NextRequest
): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as Record<string, unknown>;
      const direct = pickAccountId(body);
      if (direct) return direct;
      if (typeof body.signed_request === 'string') {
        return pickAccountId(decodeSignedRequestPayload(body.signed_request));
      }
      return null;
    }
    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      const record: Record<string, unknown> = {};
      for (const [key, value] of form.entries()) {
        record[key] = typeof value === 'string' ? value : '';
      }
      const direct = pickAccountId(record);
      if (direct) return direct;
      if (typeof record.signed_request === 'string') {
        return pickAccountId(
          decodeSignedRequestPayload(record.signed_request)
        );
      }
      return null;
    }
  } catch (err) {
    console.error('[connect/platform-callback] Failed to parse body:', err);
  }
  return null;
}
