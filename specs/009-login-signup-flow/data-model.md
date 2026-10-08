# Data Models & Schema Design: Supabase Authentication Flow (Spec 009)

## 1. Relational Entities & PostgreSQL Schema

### `public.users` (Existing, Migration 0001)
```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100),
    phone VARCHAR(50),
    subdomain VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'seller', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration: `0006_users_phone_number.sql`
Adds optional `phone` column to `users` if not already present:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
```

### `public.storage_quotas` (Existing, Migration 0003)
Initializes user quotas automatically upon signup:
```sql
INSERT INTO storage_quotas (user_id, max_bytes, used_bytes, max_assets, used_assets)
VALUES ($1, 5368709120, 0, 50, 0)
ON CONFLICT (user_id) DO NOTHING;
```

---

## 2. Shared Data Contracts (`packages/contracts/src/domain/auth.ts`)

```typescript
import { z } from 'zod';
import { SubdomainSchema, UserRoleSchema, UserStatusSchema } from './user.js';

export const SignupRequestSchema = z.object({
  name: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().min(5, 'Valid phone number is required').max(50),
  email: z.string().email('Valid email address is required').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(128),
});

export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
  returnUrl: z.string().url().optional().or(z.string().regex(/^\/[a-zA-Z0-9_/-]*$/).optional()),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthSuccessResponseSchema = z.object({
  success: z.literal(true),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    subdomain: SubdomainSchema,
    role: UserRoleSchema,
    status: UserStatusSchema,
  }),
  redirectUrl: z.string(),
});

export type AuthSuccessResponse = z.infer<typeof AuthSuccessResponseSchema>;
```
