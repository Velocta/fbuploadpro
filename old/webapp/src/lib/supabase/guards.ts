import { requireRole } from '@/server/auth/guards'

/**
 * Validates that the currently logged-in user has one of the allowed roles.
 * Throws an error if unauthorized, otherwise returns the user object.
 */
export async function validateRole(allowedRoles: ('super_admin' | 'agency')[]) {
  return requireRole(allowedRoles)
}
