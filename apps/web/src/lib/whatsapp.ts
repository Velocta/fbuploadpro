/**
 * @file whatsapp.ts
 * @description Utility functions for formatting and building WhatsApp support URLs.
 */

export const DEFAULT_WHATSAPP_SUPPORT_MESSAGE = 'Hi! I need assistance with my FBUploadPro account.';

/**
 * Strips all non-digit characters from a phone string to comply with WhatsApp's wa.me standard.
 * Examples:
 *   "+1 (555) 123-4567" -> "15551234567"
 *   "0044 7123 456789" -> "00447123456789"
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export interface BuildWhatsAppUrlOptions {
  phone?: string | undefined;
  message?: string | undefined;
}

/**
 * Builds a universal WhatsApp deep-link / web URL.
 * Returns null if the phone number is missing or invalid (fewer than 7 digits).
 */
export function buildWhatsAppSupportUrl(options?: BuildWhatsAppUrlOptions): string | null {
  const rawPhone = options?.phone ?? process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER ?? '';
  const cleanedPhone = sanitizePhoneNumber(rawPhone);

  // International phone numbers must have at least 7 digits to be valid
  if (cleanedPhone.length < 7) {
    return null;
  }

  const rawMessage = options?.message ?? process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE ?? DEFAULT_WHATSAPP_SUPPORT_MESSAGE;
  const trimmedMessage = rawMessage.trim();

  if (trimmedMessage.length > 0) {
    return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(trimmedMessage)}`;
  }

  return `https://wa.me/${cleanedPhone}`;
}
