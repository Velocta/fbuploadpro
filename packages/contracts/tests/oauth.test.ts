import { describe, expect, it } from 'vitest';
import {
  FacebookOAuthCallbackQuerySchema,
  FacebookTokenExchangeResponseSchema,
  FacebookUserProfileResponseSchema,
  OAuthStatePayloadSchema,
  signOAuthState,
  verifyOAuthState,
} from '../src/domain/oauth';

describe('Facebook OAuth Contracts & State Signing', () => {
  const secret = 'test-secret-key-for-oauth-state-signing-32chars';
  const validStatePayload = {
    tenantSubdomain: 'acme',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    nonce: 'random_nonce_string_12345',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
  };

  it('should validate OAuthStatePayloadSchema correctly', () => {
    const parsed = OAuthStatePayloadSchema.parse(validStatePayload);
    expect(parsed.tenantSubdomain).toBe('acme');
    expect(parsed.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('should sign and verify OAuth state successfully', async () => {
    const signedToken = await signOAuthState(validStatePayload, secret);
    expect(signedToken).toContain('.');

    const verified = await verifyOAuthState(signedToken, secret);
    expect(verified.tenantSubdomain).toBe('acme');
    expect(verified.userId).toBe(validStatePayload.userId);
    expect(verified.nonce).toBe(validStatePayload.nonce);
  });

  it('should reject tampered OAuth state tokens', async () => {
    const signedToken = await signOAuthState(validStatePayload, secret);
    const [payload, sig] = signedToken.split('.');
    if (!sig) throw new Error('Invalid test setup');
    const tampered = `${payload}.${sig.slice(0, -1)}a`;

    await expect(verifyOAuthState(tampered, secret)).rejects.toThrow(
      /signature/i
    );
  });

  it('should reject expired OAuth state tokens', async () => {
    const expiredPayload = {
      ...validStatePayload,
      iat: Math.floor(Date.now() / 1000) - 1000,
      exp: Math.floor(Date.now() / 1000) - 100, // Expired 100s ago
    };
    const signedToken = await signOAuthState(expiredPayload, secret);

    await expect(verifyOAuthState(signedToken, secret)).rejects.toThrow(
      /expired/i
    );
  });

  it('should validate callback query parameters', () => {
    const validQuery = {
      code: 'AQB...mock_code',
      state: 'valid_state_token',
    };
    expect(FacebookOAuthCallbackQuerySchema.parse(validQuery)).toEqual(
      validQuery
    );
  });

  it('should validate token exchange response schema targeting Graph API v26.0', () => {
    const exchange = {
      access_token: 'EAAB...long_lived_token',
      token_type: 'bearer',
      expires_in: 5184000,
    };
    expect(FacebookTokenExchangeResponseSchema.parse(exchange)).toEqual(
      exchange
    );
  });

  it('should validate user profile response schema', () => {
    const profile = {
      id: '1000123456789',
      name: 'Taylor Mark',
    };
    expect(FacebookUserProfileResponseSchema.parse(profile)).toEqual(profile);
  });
});
