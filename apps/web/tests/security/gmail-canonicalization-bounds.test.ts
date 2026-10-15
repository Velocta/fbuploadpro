import { describe, it, expect } from 'vitest';
import {
  canonicalizeGmailAddress,
  SignupRequestSchema,
  LoginRequestSchema,
} from '@fbuploadpro/contracts';

describe('[ISSUE-30] Gmail Username Bounds and Reserved Keywords Enforcement', () => {
  describe('canonicalizeGmailAddress', () => {
    it('rejects usernames under 6 characters', () => {
      expect(() => canonicalizeGmailAddress('a@gmail.com')).toThrow();
      expect(() => canonicalizeGmailAddress('ab@gmail.com')).toThrow();
      expect(() => canonicalizeGmailAddress('admin@gmail.com')).toThrow();
      expect(() => canonicalizeGmailAddress('user@gmail.com')).toThrow();
    });

    it('rejects usernames over 30 characters', () => {
      const longUsername = 'a'.repeat(31);
      expect(() => canonicalizeGmailAddress(`${longUsername}@gmail.com`)).toThrow();
    });

    it('rejects reserved system keywords', () => {
      expect(() => canonicalizeGmailAddress('billing@gmail.com')).toThrow();
      expect(() => canonicalizeGmailAddress('dashboard@gmail.com')).toThrow();
      expect(() => canonicalizeGmailAddress('internal@gmail.com')).toThrow();
    });

    it('accepts valid 6-30 character Gmail addresses', () => {
      expect(canonicalizeGmailAddress('johndoe@gmail.com')).toBe('johndoe@gmail.com');
      expect(canonicalizeGmailAddress('alexander@gmail.com')).toBe('alexander@gmail.com');
    });
  });

  describe('SignupRequestSchema validation', () => {
    it('rejects signup payload with username under 6 characters', () => {
      const payload = {
        name: 'Short User',
        phone: '+14155552671',
        email: 'user@gmail.com',
        password: 'Password123!',
      };
      const result = SignupRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects signup payload with reserved keyword username', () => {
      const payload = {
        name: 'Billing Operator',
        phone: '+14155552671',
        email: 'billing@gmail.com',
        password: 'Password123!',
      };
      const result = SignupRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('accepts valid signup payload with 6+ character username', () => {
      const payload = {
        name: 'Valid Operator',
        phone: '+14155552671',
        email: 'operator@gmail.com',
        password: 'Password123!',
      };
      const result = SignupRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('LoginRequestSchema validation', () => {
    it('rejects login payload with username under 6 characters', () => {
      const payload = {
        email: 'admin@gmail.com',
        password: 'Password123!',
      };
      const result = LoginRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects login payload with reserved keyword username', () => {
      const payload = {
        email: 'dashboard@gmail.com',
        password: 'Password123!',
      };
      const result = LoginRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('accepts valid login payload with 6+ character username', () => {
      const payload = {
        email: 'operator@gmail.com',
        password: 'Password123!',
      };
      const result = LoginRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
