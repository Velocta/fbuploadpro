import { hasRole, DomainError, DomainErrorCode, type UserRole } from '@fbuploadpro/contracts';

export function assertRole(currentRole: UserRole, requiredRole: UserRole): void {
  if (!hasRole(currentRole, requiredRole)) {
    throw new DomainError(
      DomainErrorCode.FORBIDDEN,
      `Access denied: requires ${requiredRole} role or higher, current role is ${currentRole}`
    );
  }
}

export function checkRouteAccess(
  currentRole: UserRole,
  requiredRole: UserRole
): { authorized: boolean; statusCode?: number; error?: string } {
  if (!hasRole(currentRole, requiredRole)) {
    return {
      authorized: false,
      statusCode: 403,
      error: `Forbidden: role ${requiredRole} required`,
    };
  }

  return { authorized: true };
}
