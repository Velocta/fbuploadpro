import { hasRole, DomainError, DomainErrorCode, type UserRole } from '@fbuploadpro/contracts';

export function assertRole(currentRole: UserRole, requiredRole: UserRole): void {
  if (!hasRole(currentRole, requiredRole)) {
    throw new DomainError(
      DomainErrorCode.FORBIDDEN,
      "You don't have permission to perform this action in this workspace."
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
      error: "You don't have permission to perform this action in this workspace.",
    };
  }

  return { authorized: true };
}
