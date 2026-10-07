import { describe, it, expect } from 'vitest';
import {
  ROLE_HIERARCHY,
  hasRole,
  canAccessTenant,
} from '../src/domain/rbac';
import {
  mockUserSession,
  mockSellerSession,
  mockAdminSession,
  mockSuspendedSession,
} from './fixtures/session';

describe('Role-Based Access Control (RBAC) & Tenant Guard Contracts', () => {
  describe('ROLE_HIERARCHY & hasRole', () => {
    it('defines expected role levels', () => {
      expect(ROLE_HIERARCHY.user).toBeLessThan(ROLE_HIERARCHY.seller);
      expect(ROLE_HIERARCHY.seller).toBeLessThan(ROLE_HIERARCHY.admin);
    });

    it('evaluates user role permissions accurately', () => {
      expect(hasRole('user', 'user')).toBe(true);
      expect(hasRole('user', 'seller')).toBe(false);
      expect(hasRole('user', 'admin')).toBe(false);
    });

    it('evaluates seller role permissions accurately', () => {
      expect(hasRole('seller', 'user')).toBe(true);
      expect(hasRole('seller', 'seller')).toBe(true);
      expect(hasRole('seller', 'admin')).toBe(false);
    });

    it('evaluates admin role permissions as superuser', () => {
      expect(hasRole('admin', 'user')).toBe(true);
      expect(hasRole('admin', 'seller')).toBe(true);
      expect(hasRole('admin', 'admin')).toBe(true);
    });
  });

  describe('canAccessTenant', () => {
    it('grants access when user accesses their own subdomain', () => {
      const access = canAccessTenant(mockUserSession, 'acme');
      expect(access.allowed).toBe(true);
      expect(access.reason).toBeUndefined();
    });

    it('blocks cross-tenant access when standard user accesses foreign subdomain', () => {
      const access = canAccessTenant(mockUserSession, 'other-tenant');
      expect(access.allowed).toBe(false);
      expect(access.reason).toBe('mismatch');
    });

    it('blocks cross-tenant access when seller accesses foreign subdomain', () => {
      const access = canAccessTenant(mockSellerSession, 'other-tenant');
      expect(access.allowed).toBe(false);
      expect(access.reason).toBe('mismatch');
    });

    it('grants cross-tenant inspection access to admin role on any subdomain', () => {
      const access = canAccessTenant(mockAdminSession, 'foreign-tenant');
      expect(access.allowed).toBe(true);
    });

    it('blocks access for suspended user even on their own subdomain', () => {
      const access = canAccessTenant(mockSuspendedSession, 'suspended-org');
      expect(access.allowed).toBe(false);
      expect(access.reason).toBe('suspended');
    });
  });
});
