import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from '../src/crypto/token';

describe('Web Crypto AES-256-GCM Token Encryption', () => {
  const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const sampleToken = 'EAABsbCS1iHgBA...mock_long_lived_user_access_token_60_days...';

  it('should encrypt and decrypt a token successfully (round-trip)', async () => {
    const encrypted = await encryptToken(sampleToken, validKey);
    expect(encrypted).toBeTypeOf('string');
    expect(encrypted).toContain(':');

    const decrypted = await decryptToken(encrypted, validKey);
    expect(decrypted).toBe(sampleToken);
  });

  it('should generate distinct ciphertexts for identical plaintext due to random 12-byte IV', async () => {
    const enc1 = await encryptToken(sampleToken, validKey);
    const enc2 = await encryptToken(sampleToken, validKey);

    expect(enc1).not.toBe(enc2);
    expect(await decryptToken(enc1, validKey)).toBe(sampleToken);
    expect(await decryptToken(enc2, validKey)).toBe(sampleToken);
  });

  it('should reject tampered ciphertext with authentication tag failure', async () => {
    const encrypted = await encryptToken(sampleToken, validKey);
    const [ivHex, cipherHex] = encrypted.split(':');
    if (!cipherHex) throw new Error('Invalid test setup');

    // Flip last character
    const tamperedCipher =
      cipherHex.slice(0, -1) + (cipherHex.slice(-1) === 'a' ? 'b' : 'a');
    const tamperedPayload = `${ivHex}:${tamperedCipher}`;

    await expect(decryptToken(tamperedPayload, validKey)).rejects.toThrow();
  });

  it('should fail decryption when using an incorrect secret key', async () => {
    const wrongKey = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    const encrypted = await encryptToken(sampleToken, validKey);

    await expect(decryptToken(encrypted, wrongKey)).rejects.toThrow();
  });

  it('should reject malformed payload strings lacking iv:ciphertext delimiter', async () => {
    await expect(decryptToken('invalidpayloadwithoutcolon', validKey)).rejects.toThrow(
      /format/i
    );
  });

  it('should reject invalid key lengths not meeting 256-bit requirement', async () => {
    await expect(encryptToken(sampleToken, 'short-key')).rejects.toThrow(/key/i);
    await expect(decryptToken('iv:cipher', 'short-key')).rejects.toThrow(/key/i);
  });

  it('should never leak raw plaintext token in thrown errors', async () => {
    const sensitiveSecret = 'SUPER_SECRET_PLAINTEXT_TOKEN_VALUE_NEVER_LEAK';
    const wrongKey = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    const encrypted = await encryptToken(sensitiveSecret, validKey);

    try {
      await decryptToken(encrypted, wrongKey);
      expect.unreachable('Should have failed decryption');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(sensitiveSecret);
    }
  });
});
