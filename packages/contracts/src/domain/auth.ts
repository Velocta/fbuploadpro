import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { SubdomainSchema, UserRoleSchema, UserStatusSchema, RESERVED_SUBDOMAINS, type ReservedSubdomain } from './user.js';

/**
 * Strict Gmail address canonicalization:
 * 1. Trim whitespace and convert to lowercase.
 * 2. Validate domain is exclusively @gmail.com or @googlemail.com.
 * 3. Extract username portion.
 * 4. Remove plus subaddressing tags and everything following up to @ (johndoe+xyz -> johndoe).
 * 5. Strip all dots from username (john.doe -> johndoe).
 * 6. Recombine as <clean_username>@gmail.com.
 */
export function canonicalizeGmailAddress(rawEmail: string): string {
  if (!rawEmail || typeof rawEmail !== 'string') {
    throw new Error('Valid email address is required');
  }

  const trimmed = rawEmail.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === trimmed.length - 1) {
    throw new Error('Valid email address is required');
  }

  const username = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
    throw new Error('Only @gmail.com (or @googlemail.com) email addresses are permitted');
  }

  // 1. Remove plus tags and everything following up to @: e.g. 'johndoe+xyz' -> 'johndoe'
  const withoutPlusTag = username.split('+')[0] ?? '';
  // 2. Strip all dots from username: e.g. 'john.doe' -> 'johndoe'
  const withoutDots = withoutPlusTag.replace(/\./g, '');

  if (!withoutDots) {
    throw new Error('Email username cannot be empty');
  }

  return `${withoutDots}@gmail.com`;
}

/**
 * International E.164 phone number validation and normalization:
 * 1. Requires leading + international country calling code.
 * 2. Strips spaces, dashes, brackets, and non-numeric characters (except leading +).
 * 3. Validates country code and numeric length using libphonenumber-js.
 * 4. Returns formatted standard E.164 string (e.g. +923001234567, +15551234567).
 */
export function validateAndFormatE164Phone(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Phone number is required');
  }

  const trimmed = rawPhone.trim();
  if (!trimmed.startsWith('+')) {
    throw new Error('Phone number must include an international calling code starting with + (e.g. +15551234567 or +923001234567)');
  }

  // Strip non-numeric characters except leading +
  const sanitized = '+' + trimmed.slice(1).replace(/\D/g, '');
  if (sanitized.length < 8 || sanitized.length > 16) {
    throw new Error('Please enter a valid international phone number in E.164 format (e.g. +15551234567)');
  }

  const parsed = parsePhoneNumberFromString(sanitized);
  if (!parsed || !parsed.isValid()) {
    throw new Error('Please enter a valid international phone number with a recognized country code (e.g. +15551234567)');
  }

  return parsed.format('E.164');
}

export function deriveSubdomainFromEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return 'workspace';
  }

  const usernamePart = email.split('@')[0] || '';
  // 1. Strip plus subaddress tags: e.g. 'john.doe+reels' -> 'john.doe'
  const withoutPlusTag = usernamePart.split('+')[0] || '';
  // 2. Strip all dots: e.g. 'john.doe' -> 'johndoe'
  const withoutDots = withoutPlusTag.replace(/\./g, '');
  // 3. Lowercase and keep alphanumeric and hyphens
  let slug = withoutDots
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // 4. Pad if shorter than 3 chars
  if (slug.length === 0) {
    slug = 'workspace';
  } else if (slug.length < 3) {
    slug = (slug + 'workspace').slice(0, 50);
  } else if (slug.length > 50) {
    slug = slug.slice(0, 50).replace(/-+$/, '');
  }

  // 5. If slug matches a reserved subdomain, append '1' to avoid conflict
  if (RESERVED_SUBDOMAINS.includes(slug as ReservedSubdomain)) {
    slug = `${slug}1`;
  }

  return slug;
}

export const GmailSchema = z
  .string()
  .trim()
  .email('Valid email address is required')
  .max(255, 'Email cannot exceed 255 characters')
  .superRefine((val, ctx) => {
    try {
      canonicalizeGmailAddress(val);
    } catch (err: unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Only @gmail.com addresses are permitted',
      });
    }
  })
  .transform((val) => canonicalizeGmailAddress(val));

export const E164PhoneSchema = z
  .string()
  .trim()
  .min(5, 'Valid phone number is required')
  .max(50, 'Phone number cannot exceed 50 characters')
  .superRefine((val, ctx) => {
    try {
      validateAndFormatE164Phone(val);
    } catch (err: unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Please enter a valid international phone number in E.164 format',
      });
    }
  })
  .transform((val) => validateAndFormatE164Phone(val));

export const SignupRequestSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required').max(100, 'Full name cannot exceed 100 characters'),
  phone: E164PhoneSchema,
  email: GmailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters long').max(128, 'Password cannot exceed 128 characters'),
});

export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: GmailSchema,
  password: z.string().min(1, 'Password is required'),
  returnUrl: z.string().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthSuccessResponseSchema = z.object({
  success: z.literal(true),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable().optional(),
    subdomain: SubdomainSchema,
    role: UserRoleSchema,
    status: UserStatusSchema,
  }),
  redirectUrl: z.string(),
});

export type AuthSuccessResponse = z.infer<typeof AuthSuccessResponseSchema>;
