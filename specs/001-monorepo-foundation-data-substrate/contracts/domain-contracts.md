# Contract: Domain Schemas & Error Taxonomy

This document specifies the contracts exposed by `@fbuploadpro/contracts` for the unified User model.

---

## 1. Subdomain Contract & Invariants

```typescript
export const RESERVED_SUBDOMAINS = [
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'dashboard',
  'internal',
  'mail',
  'status',
  'system',
  'test',
  'webhook',
  'www',
] as const;

export const SubdomainSchema = z
  .string()
  .min(1, 'Subdomain cannot be empty')
  .max(50, 'Subdomain cannot exceed 50 characters')
  .regex(
    /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/,
    'Subdomain must be lowercase alphanumeric and may contain internal hyphens'
  )
  .refine(
    (val) => !RESERVED_SUBDOMAINS.includes(val as (typeof RESERVED_SUBDOMAINS)[number]),
    { message: 'Subdomain is a reserved identifier' }
  );
```

---

## 2. Core Domain Schemas

```typescript
// User
export const UserRoleSchema = z.enum(['agency', 'super_admin']);
export const UserStatusSchema = z.enum(['active', 'suspended']);
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(255),
  name: z.string().max(100).nullable().optional(),
  subdomain: SubdomainSchema,
  role: UserRoleSchema.default('agency'),
  tokensBalance: z.number().int().nonnegative().default(0),
  status: UserStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Social Account & Page
export const FacebookAccountStatusSchema = z.enum(['active', 'disconnected', 'expired']);
export const FacebookAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fbAccountId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  status: FacebookAccountStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const FacebookPageStatusSchema = z.enum(['active', 'fb_rate_limited', 'invalid_token', 'disconnected']);
export const FacebookPageSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  facebookAccountId: z.string().uuid(),
  fbPageId: z.string().min(1).max(100),
  pageName: z.string().min(1).max(255),
  followersCount: z.number().int().nonnegative().default(0),
  status: FacebookPageStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Billing Ledger
export const TokenTransactionTypeSchema = z.enum(['credit', 'debit', 'refund', 'adjustment']);
export const TokenTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().int().positive('Transaction amount must be strictly positive'),
  transactionType: TokenTransactionTypeSchema,
  referenceId: z.string().max(100).nullable().optional(),
  description: z.string().min(1).max(255),
  createdAt: z.coerce.date(),
});
```

---

## 3. Domain Error Taxonomy

```typescript
export type DomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT_STATE'
  | 'INSUFFICIENT_FUNDS'
  | 'INTERNAL_ERROR';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const ERROR_HTTP_MAPPINGS: Record<DomainErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT_STATE: 409,
  INSUFFICIENT_FUNDS: 402,
  INTERNAL_ERROR: 500,
};
```
