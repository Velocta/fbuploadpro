# Contract: Role-Based Access Control (RBAC) & Tenant Guard

This document specifies the authorization contracts and guard logic in `@fbuploadpro/contracts`.

---

## 1. RBAC Utility Contract

```typescript
import type { UserRole } from './user';
import type { SessionPayload } from './session';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  seller: 2,
  user: 1,
};

export function hasRole(currentRole: UserRole, requiredRole: UserRole): boolean;

export function canAccessTenant(
  session: SessionPayload,
  targetSubdomain: string
): { allowed: boolean; reason?: 'mismatch' | 'suspended' | 'unauthorized_role' };
```

### Authorization Rules
1. If `session.status === 'suspended'`, `allowed = false`, `reason = 'suspended'`.
2. If `session.role === 'admin'`, `allowed = true` (Admin has superuser access to all tenants).
3. If `session.subdomain === targetSubdomain`, `allowed = true`.
4. Otherwise, `allowed = false`, `reason = 'mismatch'`.
