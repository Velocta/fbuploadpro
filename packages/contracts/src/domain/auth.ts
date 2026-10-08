import { z } from 'zod';
import { SubdomainSchema, UserRoleSchema, UserStatusSchema, RESERVED_SUBDOMAINS, type ReservedSubdomain } from './user.js';

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

export const SignupRequestSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required').max(100, 'Full name cannot exceed 100 characters'),
  phone: z.string().trim().min(5, 'Valid phone number is required').max(50, 'Phone number cannot exceed 50 characters'),
  email: z.string().trim().email('Valid email address is required').max(255, 'Email cannot exceed 255 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(128, 'Password cannot exceed 128 characters'),
});

export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().trim().email('Valid email address is required'),
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
