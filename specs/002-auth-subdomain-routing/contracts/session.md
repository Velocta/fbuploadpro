# Contract: Session Authentication & Cryptographic Token

This document specifies the session authentication schema and cryptographic token interface contracts in `@fbuploadpro/contracts`.

---

## 1. Schema Definition (`SessionPayloadSchema`)

```typescript
import { z } from 'zod';
import { SubdomainSchema, UserRoleSchema, UserStatusSchema } from './user';

export const SessionPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().max(100).nullable().optional(),
  subdomain: SubdomainSchema,
  role: UserRoleSchema,
  status: UserStatusSchema,
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export type SessionPayload = z.infer<typeof SessionPayloadSchema>;
```

---

## 2. Cryptographic Token Functions

### `signSessionToken`
Signs a session payload using HMAC-SHA256 via standard Web Crypto (`crypto.subtle`).

- **Parameters**:
  - `payload`: `Omit<SessionPayload, 'iat' | 'exp'>` or `SessionPayload`
  - `secret`: `string`
  - `expiresInSeconds`: `number` (optional, default `86400` = 24 hours)
- **Returns**: `Promise<string>` — Compact signed token: `<base64url-header>.<base64url-payload>.<base64url-signature>`

### `verifySessionToken`
Verifies the cryptographic signature and expiration of a session token.

- **Parameters**:
  - `token`: `string`
  - `secret`: `string`
- **Returns**: `Promise<SessionPayload>`
- **Errors**:
  - Throws `DomainError(UNAUTHORIZED, 'Invalid or corrupted session token')` if signature is invalid or payload malformed.
  - Throws `DomainError(UNAUTHORIZED, 'Session token has expired')` if `exp <= now`.
