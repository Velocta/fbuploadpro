import { describe, it, expect } from 'vitest';
import {
  deriveSubdomainFromEmail,
  SignupRequestSchema,
  LoginRequestSchema,
  AuthSuccessResponseSchema,
} from '../src/index.js';

describe('Auth Contracts & Subdomain Derivation (Spec 009)', () => {
  describe('deriveSubdomainFromEmail', () => {
    it('strips dots from email username', () => {
      expect(deriveSubdomainFromEmail('john.doe@example.com')).toBe('johndoe');
      expect(deriveSubdomainFromEmail('first.middle.last@domain.com')).toBe('firstmiddlelast');
    });

    it('strips plus tags and dots from email username', () => {
      expect(deriveSubdomainFromEmail('john.doe+campaigns@example.com')).toBe('johndoe');
      expect(deriveSubdomainFromEmail('alex+fb@company.org')).toBe('alex');
    });

    it('sanitizes special characters and enforces lowercase', () => {
      expect(deriveSubdomainFromEmail('John_Doe!123@domain.com')).toBe('johndoe123');
    });

    it('avoids reserved subdomains by appending 1', () => {
      expect(deriveSubdomainFromEmail('admin@company.com')).toBe('admin1');
      expect(deriveSubdomainFromEmail('api@service.com')).toBe('api1');
      expect(deriveSubdomainFromEmail('app@domain.com')).toBe('app1');
    });

    it('handles short or empty emails gracefully', () => {
      expect(deriveSubdomainFromEmail('al@domain.com')).toBe('alworkspace');
      expect(deriveSubdomainFromEmail('')).toBe('workspace');
    });
  });

  describe('SignupRequestSchema', () => {
    it('validates a correct signup payload', () => {
      const valid = {
        name: 'Jane Doe',
        phone: '+15551234567',
        email: 'jane.doe+reels@example.com',
        password: 'Password123!',
      };
      const result = SignupRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects password shorter than 8 characters', () => {
      const invalid = {
        name: 'Jane Doe',
        phone: '+15551234567',
        email: 'jane@example.com',
        password: 'short',
      };
      const result = SignupRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('LoginRequestSchema', () => {
    it('validates a valid login request with returnUrl', () => {
      const valid = {
        email: 'jane@example.com',
        password: 'Password123!',
        returnUrl: 'https://jane.fbuploadpro.com/dashboard',
      };
      const result = LoginRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('AuthSuccessResponseSchema', () => {
    it('validates an auth success response', () => {
      const valid = {
        success: true,
        user: {
          id: '11111111-1111-4111-a111-111111111111',
          email: 'jane@example.com',
          name: 'Jane Doe',
          subdomain: 'janedoe',
          role: 'user',
          status: 'active',
        },
        redirectUrl: 'https://janedoe.fbuploadpro.com/dashboard',
      };
      const result = AuthSuccessResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});
