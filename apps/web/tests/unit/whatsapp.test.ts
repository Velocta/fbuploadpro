import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sanitizePhoneNumber,
  buildWhatsAppSupportUrl,
  DEFAULT_WHATSAPP_SUPPORT_MESSAGE,
} from '@/lib/whatsapp';

describe('WhatsApp Support Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER;
    delete process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sanitizePhoneNumber', () => {
    it('strips spaces, plus signs, hyphens, and parentheses', () => {
      expect(sanitizePhoneNumber('+1 (555) 123-4567')).toBe('15551234567');
      expect(sanitizePhoneNumber('+44 20 7946 0958')).toBe('442079460958');
      expect(sanitizePhoneNumber('+92-300-1234567')).toBe('923001234567');
    });

    it('handles digits-only strings unchanged', () => {
      expect(sanitizePhoneNumber('15551234567')).toBe('15551234567');
    });

    it('returns empty string for empty or non-string input', () => {
      expect(sanitizePhoneNumber('')).toBe('');
      expect(sanitizePhoneNumber('   ')).toBe('');
      expect(sanitizePhoneNumber('no-digits-here')).toBe('');
    });
  });

  describe('buildWhatsAppSupportUrl', () => {
    it('returns null if no phone number is provided in options or environment', () => {
      expect(buildWhatsAppSupportUrl()).toBeNull();
      expect(buildWhatsAppSupportUrl({ phone: '' })).toBeNull();
      expect(buildWhatsAppSupportUrl({ phone: '123' })).toBeNull(); // Less than 7 digits
    });

    it('builds URL from explicit options with default message', () => {
      const url = buildWhatsAppSupportUrl({ phone: '+1 (555) 123-4567' });
      expect(url).toBe(
        `https://wa.me/15551234567?text=${encodeURIComponent(DEFAULT_WHATSAPP_SUPPORT_MESSAGE)}`
      );
    });

    it('builds URL with custom message from options', () => {
      const customMessage = 'Need help connecting Facebook page!';
      const url = buildWhatsAppSupportUrl({
        phone: '+92 300 1234567',
        message: customMessage,
      });
      expect(url).toBe(`https://wa.me/923001234567?text=${encodeURIComponent(customMessage)}`);
    });

    it('omits ?text= if message is empty string', () => {
      const url = buildWhatsAppSupportUrl({
        phone: '+1 555 1234567',
        message: '',
      });
      expect(url).toBe('https://wa.me/15551234567');
    });

    it('reads phone number and message from environment variables when omitted in options', () => {
      process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER = '+1 (800) 555-0199';
      process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE = 'Support inquiry from FBUploadPro';

      const url = buildWhatsAppSupportUrl();
      expect(url).toBe(
        `https://wa.me/18005550199?text=${encodeURIComponent('Support inquiry from FBUploadPro')}`
      );
    });

    it('prefers options over environment variables', () => {
      process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER = '+18005550199';
      process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE = 'Env message';

      const url = buildWhatsAppSupportUrl({
        phone: '+15559876543',
        message: 'Options message',
      });
      expect(url).toBe(
        `https://wa.me/15559876543?text=${encodeURIComponent('Options message')}`
      );
    });
  });
});
