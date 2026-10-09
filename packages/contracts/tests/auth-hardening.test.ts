import { describe, it, expect } from 'vitest';
import {
  canonicalizeGmailAddress,
  validateAndFormatE164Phone,
  validateClientPhoneNumber,
  SignupRequestSchema,
  LoginRequestSchema,
} from '../src/index.js';

describe('Auth Hardening Contracts (Spec 014)', () => {
  describe('canonicalizeGmailAddress', () => {
    it('normalizes standard gmail address', () => {
      expect(canonicalizeGmailAddress('john@gmail.com')).toBe('john@gmail.com');
      expect(canonicalizeGmailAddress('  JOHN@GMAIL.COM  ')).toBe('john@gmail.com');
    });

    it('strips all dots from username', () => {
      expect(canonicalizeGmailAddress('john.doe@gmail.com')).toBe('johndoe@gmail.com');
      expect(canonicalizeGmailAddress('j.o.h.n.d.o.e@gmail.com')).toBe('johndoe@gmail.com');
    });

    it('removes plus tags and everything up to @', () => {
      expect(canonicalizeGmailAddress('johndoe+promo@gmail.com')).toBe('johndoe@gmail.com');
      expect(canonicalizeGmailAddress('john.doe+reels+promo@gmail.com')).toBe('johndoe@gmail.com');
    });

    it('normalizes @googlemail.com to @gmail.com', () => {
      expect(canonicalizeGmailAddress('janedoe@googlemail.com')).toBe('janedoe@gmail.com');
      expect(canonicalizeGmailAddress('jane.doe+vip@googlemail.com')).toBe('janedoe@gmail.com');
    });

    it('rejects non-gmail domains', () => {
      expect(() => canonicalizeGmailAddress('user@yahoo.com')).toThrow(
        /Only @gmail\.com \(or @googlemail\.com\) email addresses are permitted/
      );
      expect(() => canonicalizeGmailAddress('user@outlook.com')).toThrow();
      expect(() => canonicalizeGmailAddress('user@tempmail.com')).toThrow();
      expect(() => canonicalizeGmailAddress('user@company.org')).toThrow();
    });

    it('rejects invalid or empty email formats', () => {
      expect(() => canonicalizeGmailAddress('')).toThrow();
      expect(() => canonicalizeGmailAddress('not-an-email')).toThrow();
      expect(() => canonicalizeGmailAddress('@gmail.com')).toThrow();
    });
  });

  describe('validateClientPhoneNumber', () => {
    it('validates and formats valid international phone numbers', () => {
      const res1 = validateClientPhoneNumber('+1 415 555 2671');
      expect(res1.isValid).toBe(true);
      expect(res1.formatted).toBe('+14155552671');
      expect(res1.error).toBeUndefined();

      const res2 = validateClientPhoneNumber('+92 300 1234567');
      expect(res2.isValid).toBe(true);
      expect(res2.formatted).toBe('+923001234567');
    });

    it('rejects empty phone input', () => {
      const res = validateClientPhoneNumber('');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/Phone number is required/);
    });

    it('rejects input without leading + (like asdf or 5551234567)', () => {
      const res1 = validateClientPhoneNumber('asdf');
      expect(res1.isValid).toBe(false);
      expect(res1.error).toMatch(/must include an international calling code starting with \+/);

      const res2 = validateClientPhoneNumber('5551234567');
      expect(res2.isValid).toBe(false);
      expect(res2.error).toMatch(/must include an international calling code starting with \+/);
    });

    it('rejects input containing letters after + (like +1asdf)', () => {
      const res = validateClientPhoneNumber('+1asdf');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/Phone numbers cannot contain letters/);
    });

    it('rejects incomplete numbers like +32433 with too short length or invalid code', () => {
      const res = validateClientPhoneNumber('+32433');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/Please enter a complete, valid international phone number/);
    });
  });

  describe('validateAndFormatE164Phone', () => {
    it('formats valid international phone numbers to E.164', () => {
      expect(validateAndFormatE164Phone('+1 415 555 2671')).toBe('+14155552671');
      expect(validateAndFormatE164Phone('+1 (415) 555-2671')).toBe('+14155552671');
      expect(validateAndFormatE164Phone('+92 300 1234567')).toBe('+923001234567');
      expect(validateAndFormatE164Phone('+44 7911 123456')).toBe('+447911123456');
    });

    it('rejects numbers without leading + international calling code', () => {
      expect(() => validateAndFormatE164Phone('03001234567')).toThrow(
        /must include an international calling code starting with \+/
      );
      expect(() => validateAndFormatE164Phone('5551234567')).toThrow();
    });

    it('rejects raw text strings, letters, and invalid country codes', () => {
      expect(() => validateAndFormatE164Phone('hello-world')).toThrow();
      expect(() => validateAndFormatE164Phone('+0000000000')).toThrow();
      expect(() => validateAndFormatE164Phone('+1')).toThrow();
    });
  });

  describe('SignupRequestSchema hardening', () => {
    it('transforms and canonicalizes email and phone on parse', () => {
      const valid = {
        name: 'Jane Doe',
        phone: '+1 (415) 555-2671',
        email: '  Jane.Doe+reels@GMAIL.COM  ',
        password: 'Password123!',
      };

      const result = SignupRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('janedoe@gmail.com');
        expect(result.data.phone).toBe('+14155552671');
      }
    });

    it('rejects non-gmail signup', () => {
      const invalid = {
        name: 'Jane Doe',
        phone: '+14155552671',
        email: 'jane@corporate.com',
        password: 'Password123!',
      };

      const result = SignupRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid phone format', () => {
      const invalid = {
        name: 'Jane Doe',
        phone: '1234567890',
        email: 'jane@gmail.com',
        password: 'Password123!',
      };

      const result = SignupRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('LoginRequestSchema hardening', () => {
    it('canonicalizes email on parse', () => {
      const valid = {
        email: 'Jane.Doe+promo@googlemail.com',
        password: 'Password123!',
      };

      const result = LoginRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('janedoe@gmail.com');
      }
    });

    it('rejects non-gmail login', () => {
      const result = LoginRequestSchema.safeParse({
        email: 'jane@yahoo.com',
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
    });
  });
});
