# Interface Contract: Web Crypto AES-256-GCM Token Encryption

This document defines the cryptographic interface for zero-trust token encryption at rest.

---

## 1. Cryptographic Specifications

- **Algorithm**: `AES-GCM` (authenticated symmetric encryption with 128-bit authentication tag).
- **Key Length**: 256 bits (32 bytes).
- **IV / Nonce**: 12 bytes (96 bits) cryptographically random per operation via `crypto.getRandomValues()`.
- **Runtime Standard**: W3C Web Cryptography API (`crypto.subtle`), supported natively across Node.js 18+, Next.js Edge Runtime, and Cloudflare Workers.
- **Wire / Storage Format**: Compact delimited string:
  ```text
  {iv_hex}:{ciphertext_with_tag_hex}
  ```
  Example: `a1b2c3d4e5f6a1b2c3d4e5f6:89abcdef0123...456789`

---

## 2. TypeScript Contract

```typescript
/**
 * Encrypts a sensitive plaintext string (such as an OAuth access token)
 * using AES-256-GCM with a random 12-byte IV.
 *
 * @param plaintext - The raw token string to encrypt.
 * @param secretHexOrKey - 256-bit encryption key (32 bytes / 64 hex characters).
 * @returns Serialized encrypted string '{iv_hex}:{ciphertext_hex}'.
 */
export async function encryptToken(
  plaintext: string,
  secretHexOrKey: string
): Promise<string>;

/**
 * Decrypts an AES-256-GCM encrypted token string.
 *
 * @param encryptedPayload - Serialized string '{iv_hex}:{ciphertext_hex}'.
 * @param secretHexOrKey - 256-bit encryption key matching the key used to encrypt.
 * @returns Decrypted raw token string.
 * @throws DomainError if payload format is invalid or authentication tag check fails.
 */
export async function decryptToken(
  encryptedPayload: string,
  secretHexOrKey: string
): Promise<string>;
```

---

## 3. Error Handling

- **Invalid Format**: Throws `DomainError.invalidPayload('Invalid encrypted token payload format')`.
- **Decryption / Authentication Tag Failure**: Throws `DomainError.unauthorized('Failed to decrypt token: authentication tag mismatch or invalid key')`.
- **Zero Plaintext Leakage**: Exceptions thrown during cryptographic operations must never include the input plaintext, ciphertext, or key material in error messages or stack traces.
