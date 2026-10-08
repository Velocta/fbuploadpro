import { describe, expect, it } from 'vitest';
import {
  RESERVED_SUBDOMAINS,
  SubdomainSchema,
  UserRoleSchema,
  UserSchema,
  UserStatusSchema,
} from '../src/domain/user.js';

describe('User Domain Schemas & Invariants', () => {
  describe('SubdomainSchema', () => {
    it('accepts valid alphanumeric subdomains', () => {
      const validCases = ['a', '0', 'acme', 'team-alpha', 'store-123', 'a-b-c-d'];
      for (const slug of validCases) {
        const result = SubdomainSchema.safeParse(slug);
        expect(result.success, `Expected valid: ${slug}`).toBe(true);
      }
    });

    it('rejects invalid subdomain formatting and characters', () => {
      const invalidCases = [
        '',
        '-leading',
        'trailing-',
        'UPPERCASE',
        'has_underscore',
        'has.dot',
        'has space',
        'a'.repeat(51),
      ];
      for (const slug of invalidCases) {
        const result = SubdomainSchema.safeParse(slug);
        expect(result.success, `Expected invalid: ${slug}`).toBe(false);
      }
    });

    it('rejects all reserved subdomain slugs', () => {
      for (const reserved of RESERVED_SUBDOMAINS) {
        const result = SubdomainSchema.safeParse(reserved);
        expect(result.success, `Expected reserved rejection: ${reserved}`).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0]?.message).toMatch(/reserved/i);
        }
      }
    });
  });

  describe('UserRoleSchema', () => {
    it('accepts allowed user roles (user, seller, admin)', () => {
      expect(UserRoleSchema.parse('user')).toBe('user');
      expect(UserRoleSchema.parse('seller')).toBe('seller');
      expect(UserRoleSchema.parse('admin')).toBe('admin');
    });

    it('rejects removed legacy roles and unknown roles', () => {
      expect(UserRoleSchema.safeParse('agency').success).toBe(false);
      expect(UserRoleSchema.safeParse('super_admin').success).toBe(false);
      expect(UserRoleSchema.safeParse('guest').success).toBe(false);
    });
  });

  describe('UserStatusSchema', () => {
    it('accepts active and suspended statuses', () => {
      expect(UserStatusSchema.parse('active')).toBe('active');
      expect(UserStatusSchema.parse('suspended')).toBe('suspended');
    });

    it('rejects invalid statuses', () => {
      expect(UserStatusSchema.safeParse('pending').success).toBe(false);
      expect(UserStatusSchema.safeParse('deleted').success).toBe(false);
    });
  });

  describe('UserSchema', () => {
    const validUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'alex@example.com',
      name: 'Alex Operator',
      subdomain: 'alex-workspace',
      role: 'seller' as const,
      status: 'active' as const,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('validates a complete user object without tokensBalance', () => {
      const parsed = UserSchema.parse(validUser);
      expect(parsed.id).toBe(validUser.id);
      expect(parsed.subdomain).toBe('alex-workspace');
      expect('tokensBalance' in parsed).toBe(false);
    });

    it('ignores or strips any legacy tokensBalance property', () => {
      const parsed = UserSchema.parse({ ...validUser, tokensBalance: 500 });
      expect('tokensBalance' in parsed).toBe(false);
    });

    it('applies defaults for role and status', () => {
      const minimalUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'minimal@example.com',
        subdomain: 'minimal-hub',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const parsed = UserSchema.parse(minimalUser);
      expect(parsed.role).toBe('user');
      expect(parsed.status).toBe('active');
      expect(parsed.createdAt).toBeInstanceOf(Date);
    });

    it('rejects invalid email and non-UUID id', () => {
      expect(UserSchema.safeParse({ ...validUser, email: 'not-an-email' }).success).toBe(false);
      expect(UserSchema.safeParse({ ...validUser, id: 'not-a-uuid' }).success).toBe(false);
    });
  });
});
