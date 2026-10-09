# Data Model: Authentication Flow Audit Remediation

**Feature**: `specs/017-auth-flow-audit-remediation`  
**Date**: 2026-10-09  

## Entities

### 1. `PendingSignupEntry` (Staged in `otp-service.ts`)
Staging representation for unverified accounts waiting for OTP confirmation.

```typescript
export interface StagedSignupData {
  name: string;
  phone: string;
  email: string;
  hashedPassword: string; // PBKDF2 hash (saltHex:hashHex), NEVER plaintext
}

export interface PendingSignupEntry {
  data: StagedSignupData;
  otp: string;             // Cryptographic 6-digit numeric string
  createdAt: number;       // Epoch milliseconds
  expiresAt: number;       // Epoch milliseconds (createdAt + 10 min)
  lastSentAt: number;      // Epoch milliseconds
  attempts: number;        // Failed verification attempts (max 5)
}
```

### 2. `SessionPayload` (in `@fbuploadpro/contracts`)
Signed JWT payload stored in `fbup_session` cookie.

```typescript
export interface SessionPayload {
  userId: string;          // UUID v4
  email: string;           // Canonical Gmail address
  name?: string | null;    // Full name
  subdomain: string;       // Tenant subdomain slug
  role: 'user' | 'admin' | 'seller';
  status: 'active' | 'suspended';
  iat: number;             // Issued at (seconds)
  exp: number;             // Expires at (seconds) -> 30 days = iat + 2592000
  authTime?: number;       // Authentication timestamp (seconds)
}
```

### 3. `PasswordResetRequest` (in `contracts/src/domain/auth.ts`)
Schema validating `POST /api/auth/reset-password` payloads.

```typescript
export const ResetPasswordRequestSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters long').max(128),
  token: z.string().optional(),
  code: z.string().optional(),
}).refine(data => Boolean(data.token || data.code), {
  message: 'A valid recovery token or authorization code is required.',
  path: ['token'],
});
```

### 4. `AuthUser` (in `apps/web/src/lib/supabase-auth.ts`)
Database and in-memory representation of user credentials.

```typescript
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  subdomain: string;
  role: UserRole;
  status: UserStatus;
  passwordUpdatedAt?: number; // Epoch seconds for session invalidation
}
```
