import { describe, it, expect } from 'vitest';
import { assertRole, checkRouteAccess } from '../src/lib/rbac';
import { DomainError, DomainErrorCode } from '@fbuploadpro/contracts';

describe('RBAC Route Guard Contracts (User Story 3)', () => {
  describe('assertRole helper', () => {
    it('allows standard user for user role requirement', () => {
      expect(() => assertRole('user', 'user')).not.toThrow();
    });

    it('rejects standard user for seller role requirement with 403 FORBIDDEN', () => {
      expect(() => assertRole('user', 'seller')).toThrow(DomainError);
      try {
        assertRole('user', 'seller');
      } catch (err: unknown) {
        const error = err as DomainError;
        expect(error.code).toBe(DomainErrorCode.FORBIDDEN);
        expect(error.statusCode).toBe(403);
      }
    });

    it('rejects standard user for admin role requirement with 403 FORBIDDEN', () => {
      expect(() => assertRole('user', 'admin')).toThrow(DomainError);
    });

    it('allows seller role for user and seller requirements', () => {
      expect(() => assertRole('seller', 'user')).not.toThrow();
      expect(() => assertRole('seller', 'seller')).not.toThrow();
      expect(() => assertRole('seller', 'admin')).toThrow(DomainError);
    });

    it('allows admin role for all role requirements as superuser', () => {
      expect(() => assertRole('admin', 'user')).not.toThrow();
      expect(() => assertRole('admin', 'seller')).not.toThrow();
      expect(() => assertRole('admin', 'admin')).not.toThrow();
    });
  });

  describe('checkRouteAccess helper', () => {
    it('returns authorized for role satisfying requirement', () => {
      const res = checkRouteAccess('seller', 'seller');
      expect(res.authorized).toBe(true);
    });

    it('returns unauthorized with status 403 for insufficient role', () => {
      const res = checkRouteAccess('user', 'seller');
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(403);
    });
  });
});
