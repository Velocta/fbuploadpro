import type { UserRole } from './user.js';
import type { SessionPayload } from './session.js';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  seller: 2,
  user: 1,
} as const;

export function hasRole(currentRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[requiredRole];
}

export interface TenantAccessResult {
  allowed: boolean;
  reason?: 'mismatch' | 'suspended' | 'unauthorized_role';
}

export function canAccessTenant(
  session: SessionPayload,
  targetSubdomain: string
): TenantAccessResult {
  if (session.status === 'suspended') {
    return {
      allowed: false,
      reason: 'suspended',
    };
  }

  // Admin has global cross-tenant visibility
  if (session.role === 'admin') {
    return {
      allowed: true,
    };
  }

  // Standard users and sellers can only access their assigned tenant subdomain
  if (session.subdomain.toLowerCase() === targetSubdomain.toLowerCase()) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason: 'mismatch',
  };
}
