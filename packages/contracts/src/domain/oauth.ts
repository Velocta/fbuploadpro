import { z } from 'zod';
import { UnauthorizedError, ValidationError } from '../errors/domain-error.js';

export const OAuthStatePayloadSchema = z.object({
  tenantSubdomain: z.string().min(1).max(50),
  userId: z.string().uuid(),
  nonce: z.string().min(16),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type OAuthStatePayload = z.infer<typeof OAuthStatePayloadSchema>;

export const FacebookOAuthCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1),
  error: z.string().optional(),
  error_reason: z.string().optional(),
  error_description: z.string().optional(),
});

export type FacebookOAuthCallbackQuery = z.infer<
  typeof FacebookOAuthCallbackQuerySchema
>;

export const FacebookTokenExchangeResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().default('bearer'),
  expires_in: z.number().int().optional(),
});

export type FacebookTokenExchangeResponse = z.infer<
  typeof FacebookTokenExchangeResponseSchema
>;

export const FacebookUserProfileResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type FacebookUserProfileResponse = z.infer<
  typeof FacebookUserProfileResponseSchema
>;

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      binary += String.fromCharCode(b);
    }
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < byteArray.length; i++) {
    const byte = byteArray[i];
    if (byte !== undefined) {
      hexString += byte.toString(16).padStart(2, '0');
    }
  }
  return hexString;
}

export async function signOAuthState(
  payload: OAuthStatePayload,
  secret: string
): Promise<string> {
  const validatedPayload = OAuthStatePayloadSchema.parse(payload);
  const encodedPayload = base64UrlEncode(JSON.stringify(validatedPayload));

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(encodedPayload)
  );

  const signatureHex = bufferToHex(signatureBuffer);
  return `${encodedPayload}.${signatureHex}`;
}

export async function verifyOAuthState(
  token: string,
  secret: string
): Promise<OAuthStatePayload> {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new ValidationError('Invalid OAuth state format');
  }

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    throw new ValidationError('Invalid OAuth state format');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const expectedSignatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(encodedPayload)
  );
  const expectedSignatureHex = bufferToHex(expectedSignatureBuffer);

  if (expectedSignatureHex !== providedSignature) {
    throw new UnauthorizedError('OAuth state signature verification failed');
  }

  let parsed: unknown;
  try {
    const jsonStr = base64UrlDecode(encodedPayload);
    parsed = JSON.parse(jsonStr);
  } catch (_e) {
    throw new ValidationError('Failed to decode OAuth state payload');
  }

  const payload = OAuthStatePayloadSchema.parse(parsed);

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSeconds) {
    throw new UnauthorizedError('OAuth state has expired');
  }

  return payload;
}
