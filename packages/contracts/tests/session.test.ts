import { describe, it, expect } from 'vitest';
import {
  SessionPayloadSchema,
  signSessionToken,
  verifySessionToken,
} from '../src/domain/session';
import { DomainError, DomainErrorCode } from '../src/errors/domain-error';
import {
  TEST_SESSION_SECRET,
  mockUserSession,
} from './fixtures/session';

describe('Session Authentication Contracts (SessionPayload & Web Crypto Tokens)', () => {
  it('validates a conformant SessionPayload', () => {
    const result = SessionPayloadSchema.safeParse(mockUserSession);
    expect(result.success).toBe(true);
  });

  it('rejects SessionPayload with invalid UUID', () => {
    const invalid = { ...mockUserSession, userId: 'not-a-uuid' };
    const result = SessionPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects SessionPayload with reserved or malformed subdomain', () => {
    const invalidSubdomain = { ...mockUserSession, subdomain: 'api' };
    const result = SessionPayloadSchema.safeParse(invalidSubdomain);
    expect(result.success).toBe(false);
  });

  it('rejects SessionPayload with invalid role or status', () => {
    const invalidRole = { ...mockUserSession, role: 'super-hacker' };
    expect(SessionPayloadSchema.safeParse(invalidRole).success).toBe(false);

    const invalidStatus = { ...mockUserSession, status: 'banned' };
    expect(SessionPayloadSchema.safeParse(invalidStatus).success).toBe(false);
  });

  it('signs and verifies a valid session token using Web Crypto API', async () => {
    const token = await signSessionToken(mockUserSession, TEST_SESSION_SECRET);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = await verifySessionToken(token, TEST_SESSION_SECRET);
    expect(decoded.userId).toBe(mockUserSession.userId);
    expect(decoded.email).toBe(mockUserSession.email);
    expect(decoded.subdomain).toBe(mockUserSession.subdomain);
    expect(decoded.role).toBe(mockUserSession.role);
    expect(decoded.status).toBe(mockUserSession.status);
  });

  it('rejects session token verified with wrong secret', async () => {
    const token = await signSessionToken(mockUserSession, TEST_SESSION_SECRET);
    await expect(
      verifySessionToken(token, 'different-wrong-secret-minimum-32-chars-long')
    ).rejects.toThrow(DomainError);

    try {
      await verifySessionToken(token, 'different-wrong-secret-minimum-32-chars-long');
    } catch (err: unknown) {
      const error = err as DomainError;
      expect(error.code).toBe(DomainErrorCode.UNAUTHORIZED);
    }
  });

  it('rejects tampered session token payload', async () => {
    const token = await signSessionToken(mockUserSession, TEST_SESSION_SECRET);
    const [header, payload, sig] = token.split('.');
    
    // Tamper payload by modifying characters
    const tamperedPayload = payload + 'x';
    const tamperedToken = `${header}.${tamperedPayload}.${sig}`;

    await expect(verifySessionToken(tamperedToken, TEST_SESSION_SECRET)).rejects.toThrow();
  });

  it('rejects expired session token', async () => {
    const expiredSession = {
      ...mockUserSession,
      exp: Math.floor(Date.now() / 1000) - 100, // expired in past
    };
    const token = await signSessionToken(expiredSession, TEST_SESSION_SECRET);

    await expect(verifySessionToken(token, TEST_SESSION_SECRET)).rejects.toThrow(DomainError);
    try {
      await verifySessionToken(token, TEST_SESSION_SECRET);
    } catch (err: unknown) {
      const error = err as DomainError;
      expect(error.code).toBe(DomainErrorCode.UNAUTHORIZED);
      expect(error.message).toContain('expired');
    }
  });
});
