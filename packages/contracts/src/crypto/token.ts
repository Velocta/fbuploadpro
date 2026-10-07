import { UnauthorizedError, ValidationError } from '../errors/domain-error.js';

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new ValidationError('Invalid hex string format');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new ValidationError('Invalid hex character');
    }
    bytes[i] = byte;
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      hex += byte.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

function parseSecretKey(secretHexOrKey: string): Uint8Array {
  if (typeof secretHexOrKey !== 'string') {
    throw new ValidationError('Secret key must be a string');
  }
  // If 64 hex chars, parse as 32-byte hex
  if (secretHexOrKey.length === 64 && /^[0-9a-fA-F]+$/.test(secretHexOrKey)) {
    return hexToBytes(secretHexOrKey);
  }
  // Otherwise if utf-8 string, must be 32 bytes
  const bytes = new TextEncoder().encode(secretHexOrKey);
  if (bytes.length !== 32) {
    throw new ValidationError(
      `Secret key must be exactly 256 bits (32 bytes or 64 hex characters), got ${bytes.length} bytes`
    );
  }
  return bytes;
}

/**
 * Encrypts a sensitive plaintext string (such as an OAuth access token)
 * using AES-256-GCM with a random 12-byte IV.
 *
 * @param plaintext - The raw token string to encrypt.
 * @param secretHexOrKey - 256-bit encryption key (32 bytes or 64 hex characters).
 * @returns Serialized encrypted string '{iv_hex}:{ciphertext_hex}'.
 */
export async function encryptToken(
  plaintext: string,
  secretHexOrKey: string
): Promise<string> {
  const keyBytes = parseSecretKey(secretHexOrKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encodedData = new TextEncoder().encode(plaintext);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    cryptoKey,
    encodedData as unknown as BufferSource
  );

  const ivHex = bytesToHex(iv);
  const cipherHex = bytesToHex(new Uint8Array(encryptedBuffer));

  return `${ivHex}:${cipherHex}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token string.
 *
 * @param encryptedPayload - Serialized string '{iv_hex}:{ciphertext_hex}'.
 * @param secretHexOrKey - 256-bit encryption key matching the key used to encrypt.
 * @returns Decrypted raw token string.
 * @throws UnauthorizedError if authentication tag fails or ValidationError if payload format is invalid.
 */
export async function decryptToken(
  encryptedPayload: string,
  secretHexOrKey: string
): Promise<string> {
  if (typeof encryptedPayload !== 'string' || !encryptedPayload.includes(':')) {
    throw new ValidationError('Invalid encrypted token payload format');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ValidationError('Invalid encrypted token payload format');
  }

  const [ivHex, cipherHex] = parts;
  const keyBytes = parseSecretKey(secretHexOrKey);
  const iv = hexToBytes(ivHex);
  const cipherBytes = hexToBytes(cipherHex);

  if (iv.length !== 12) {
    throw new ValidationError('Invalid IV length: expected 12 bytes');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      cryptoKey,
      cipherBytes as unknown as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (_err) {
    throw new UnauthorizedError(
      'Failed to decrypt token: authentication tag mismatch or invalid key'
    );
  }
}
